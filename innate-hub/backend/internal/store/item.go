package store

import (
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/innate/hub/internal/model"
)

// ListItemsParams specifies filtering and pagination for item queries.
//
// Pointer fields (FeedID, GroupID, Unread) are optional filters - nil means "no filter".
// OrderBy accepts "pub_date" (default) or "created_at".
// Limit/Offset = 0 means no limit/offset.
type ListItemsParams struct {
	FeedID  *int64
	GroupID *int64
	Unread  *bool
	Limit   int
	Offset  int
	OrderBy string // "pub_date" or "created_at"
}

func (s *Store) ListItems(params ListItemsParams) ([]*model.Item, error) {
	query := `
		SELECT items.id, items.feed_id, items.guid, items.title, items.link, items.content, items.pub_date, items.unread, items.created_at
		FROM items
	`
	args := []any{}

	// Join feeds table if filtering by GroupID
	if params.GroupID != nil {
		query += ` INNER JOIN feeds ON items.feed_id = feeds.id`
	}

	query += ` WHERE 1=1`

	if params.FeedID != nil {
		query += ` AND items.feed_id = :feed_id`
		args = append(args, sql.Named("feed_id", *params.FeedID))
	}
	if params.GroupID != nil {
		query += ` AND feeds.group_id = :group_id`
		args = append(args, sql.Named("group_id", *params.GroupID))
	}
	if params.Unread != nil {
		query += ` AND items.unread = :unread`
		args = append(args, sql.Named("unread", boolToInt(*params.Unread)))
	}

	// ORDER BY cannot use named parameters, validated via allowlist instead
	orderBy := "items.pub_date DESC, items.id DESC"
	if params.OrderBy == "created_at" {
		orderBy = "items.created_at DESC, items.id DESC"
	}
	query += ` ORDER BY ` + orderBy

	if params.Limit > 0 {
		query += ` LIMIT :limit`
		args = append(args, sql.Named("limit", params.Limit))
	}
	if params.Offset > 0 {
		query += ` OFFSET :offset`
		args = append(args, sql.Named("offset", params.Offset))
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []*model.Item{}
	for rows.Next() {
		i := &model.Item{}
		var unread int
		if err := rows.Scan(&i.ID, &i.FeedID, &i.GUID, &i.Title, &i.Link, &i.Content, &i.PubDate, &unread, &i.CreatedAt); err != nil {
			return nil, err
		}
		i.Unread = intToBool(unread)
		items = append(items, i)
	}
	return items, rows.Err()
}

func (s *Store) GetItem(id int64) (*model.Item, error) {
	i := &model.Item{}
	var unread int
	err := s.db.QueryRow(`
		SELECT id, feed_id, guid, title, link, content, pub_date, unread, created_at
		FROM items
		WHERE id = :id
	`, sql.Named("id", id)).Scan(&i.ID, &i.FeedID, &i.GUID, &i.Title, &i.Link, &i.Content, &i.PubDate, &unread, &i.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: item", ErrNotFound)
		}
		return nil, fmt.Errorf("get item: %w", err)
	}

	i.Unread = intToBool(unread)
	return i, nil
}

func (s *Store) CreateItem(feedID int64, guid, title, link, content string, pubDate int64) (*model.Item, error) {
	result, err := s.db.Exec(`
		INSERT INTO items (feed_id, guid, title, link, content, pub_date)
		VALUES (:feed_id, :guid, :title, :link, :content, :pub_date)
	`, sql.Named("feed_id", feedID), sql.Named("guid", guid), sql.Named("title", title),
		sql.Named("link", link), sql.Named("content", content), sql.Named("pub_date", pubDate))
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetItem(id)
}

type BatchCreateItemInput struct {
	GUID      string
	Title     string
	Link      string
	Content   string
	PubDate   int64
	Embedding []byte // optional; serialized float32 vector
}

// BatchCreateItemsIgnore inserts items in one transaction and ignores duplicates by (feed_id, guid).
// Returns the number of newly inserted rows.
func (s *Store) BatchCreateItemsIgnore(feedID int64, inputs []BatchCreateItemInput) (int, error) {
	if len(inputs) == 0 {
		return 0, nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO items (feed_id, guid, title, link, content, pub_date, embedding)
		VALUES (:feed_id, :guid, :title, :link, :content, :pub_date, :embedding)
		ON CONFLICT(feed_id, guid) DO NOTHING
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	created := 0
	for _, input := range inputs {
		result, err := stmt.Exec(
			sql.Named("feed_id", feedID),
			sql.Named("guid", input.GUID),
			sql.Named("title", input.Title),
			sql.Named("link", input.Link),
			sql.Named("content", input.Content),
			sql.Named("pub_date", input.PubDate),
			sql.Named("embedding", input.Embedding),
		)
		if err != nil {
			return 0, err
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return 0, err
		}
		if affected > 0 {
			created++
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return created, nil
}

func (s *Store) UpdateItemUnread(id int64, unread bool) error {
	result, err := s.db.Exec(`UPDATE items SET unread = :unread WHERE id = :id`,
		sql.Named("unread", boolToInt(unread)), sql.Named("id", id))
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("%w: item", ErrNotFound)
	}
	return nil
}

// BatchUpdateItemsUnread marks multiple items as read/unread.
// IDs are chunked to keep SQL statements bounded and avoid oversized IN clauses.
func (s *Store) BatchUpdateItemsUnread(ids []int64, unread bool) error {
	if len(ids) == 0 {
		return nil
	}

	const chunkSize = 500
	for start := 0; start < len(ids); start += chunkSize {
		end := min(start+chunkSize, len(ids))

		if err := s.batchUpdateItemsUnreadChunk(ids[start:end], unread); err != nil {
			return err
		}
	}

	return nil
}

func (s *Store) batchUpdateItemsUnreadChunk(ids []int64, unread bool) error {
	if len(ids) == 0 {
		return nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, 0, len(ids)+1)
	args = append(args, sql.Named("unread", boolToInt(unread)))
	for i, id := range ids {
		paramName := fmt.Sprintf("id%d", i)
		placeholders[i] = ":" + paramName
		args = append(args, sql.Named(paramName, id))
	}

	query := fmt.Sprintf(`UPDATE items SET unread = :unread WHERE id IN (%s)`, strings.Join(placeholders, ","))
	_, err := s.db.Exec(query, args...)
	return err
}

// MarkAllAsRead marks items as read. If feedID is nil, marks ALL items across all feeds.
// If feedID is non-nil, only marks items from that specific feed.
func (s *Store) MarkAllAsRead(feedID *int64) error {
	if feedID != nil {
		_, err := s.db.Exec(`UPDATE items SET unread = 0 WHERE feed_id = :feed_id`, sql.Named("feed_id", *feedID))
		return err
	}
	_, err := s.db.Exec(`UPDATE items SET unread = 0`)
	return err
}

func (s *Store) MarkGroupAsRead(groupID int64) error {
	_, err := s.db.Exec(`
		UPDATE items
		SET unread = 0
		WHERE feed_id IN (
			SELECT id
			FROM feeds
			WHERE group_id = :group_id
		)
	`, sql.Named("group_id", groupID))
	return err
}

func (s *Store) MarkFeedAsReadBefore(feedID, before int64) error {
	_, err := s.db.Exec(`
		UPDATE items
		SET unread = 0
		WHERE feed_id = :feed_id
		  AND (CASE WHEN pub_date > 0 THEN pub_date ELSE created_at END) <= :before
	`, sql.Named("feed_id", feedID), sql.Named("before", before))
	return err
}

func (s *Store) MarkGroupAsReadBefore(groupID, before int64) error {
	_, err := s.db.Exec(`
		UPDATE items
		SET unread = 0
		WHERE feed_id IN (
			SELECT id
			FROM feeds
			WHERE group_id = :group_id
		)
		  AND (CASE WHEN pub_date > 0 THEN pub_date ELSE created_at END) <= :before
	`, sql.Named("group_id", groupID), sql.Named("before", before))
	return err
}

func (s *Store) MarkAllAsReadBefore(before int64) error {
	_, err := s.db.Exec(`
		UPDATE items
		SET unread = 0
		WHERE (CASE WHEN pub_date > 0 THEN pub_date ELSE created_at END) <= :before
	`, sql.Named("before", before))
	return err
}

func (s *Store) ListUnreadItemIDs() ([]int64, error) {
	rows, err := s.db.Query(`
		SELECT id
		FROM items
		WHERE unread = 1
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}

	return ids, rows.Err()
}

type ListFeverItemsParams struct {
	WithIDs []int64
	SinceID *int64
	MaxID   *int64
	Limit   int
	SortAsc bool
}

func (s *Store) ListFeverItems(params ListFeverItemsParams) ([]*model.Item, error) {
	query := `
		SELECT id, feed_id, guid, title, link, content, pub_date, unread, created_at
		FROM items
		WHERE 1=1
	`
	args := []any{}

	if len(params.WithIDs) > 0 {
		placeholders := make([]string, len(params.WithIDs))
		for i, id := range params.WithIDs {
			name := fmt.Sprintf("with_id_%d", i)
			placeholders[i] = ":" + name
			args = append(args, sql.Named(name, id))
		}
		query += fmt.Sprintf(" AND id IN (%s)", strings.Join(placeholders, ","))
	}

	if params.SinceID != nil {
		query += ` AND id > :since_id`
		args = append(args, sql.Named("since_id", *params.SinceID))
	}

	if params.MaxID != nil {
		query += ` AND id <= :max_id`
		args = append(args, sql.Named("max_id", *params.MaxID))
	}

	orderBy := "DESC"
	if params.SortAsc {
		orderBy = "ASC"
	}
	query += ` ORDER BY id ` + orderBy

	if params.Limit > 0 {
		query += ` LIMIT :limit`
		args = append(args, sql.Named("limit", params.Limit))
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []*model.Item{}
	for rows.Next() {
		i := &model.Item{}
		var unread int
		if err := rows.Scan(&i.ID, &i.FeedID, &i.GUID, &i.Title, &i.Link, &i.Content, &i.PubDate, &unread, &i.CreatedAt); err != nil {
			return nil, err
		}
		i.Unread = intToBool(unread)
		items = append(items, i)
	}

	return items, rows.Err()
}

func (s *Store) ItemExists(feedID int64, guid string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM items WHERE feed_id = :feed_id AND guid = :guid)`,
		sql.Named("feed_id", feedID), sql.Named("guid", guid)).Scan(&exists)
	return exists, err
}

type SearchItemResult struct {
	ID      int64  `json:"id"`
	FeedID  int64  `json:"feed_id"`
	Title   string `json:"title"`
	PubDate int64  `json:"pub_date"`
}

func (s *Store) SearchItems(query string, limit int) ([]*SearchItemResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return s.searchItemsLike(query, limit)
	}

	if s.driver == "postgres" {
		return s.searchItemsPostgres(query, limit)
	}
	return s.searchItemsSQLite(query, limit)
}

func (s *Store) searchItemsSQLite(query string, limit int) ([]*SearchItemResult, error) {
	ftsQuery := buildSQLiteFTSQuery(query)
	if ftsQuery == "" {
		return s.searchItemsLike(query, limit)
	}

	rows, err := s.db.Query(`
		SELECT i.id, i.feed_id, i.title, i.pub_date
		FROM items_fts
		INNER JOIN items i ON i.id = items_fts.rowid
		WHERE items_fts MATCH :query
		ORDER BY i.pub_date DESC, i.id DESC
		LIMIT :limit
	`, sql.Named("query", ftsQuery), sql.Named("limit", limit))
	if err != nil {
		return s.searchItemsLike(query, limit)
	}
	defer rows.Close()

	items := []*SearchItemResult{}
	for rows.Next() {
		i := &SearchItemResult{}
		if err := rows.Scan(&i.ID, &i.FeedID, &i.Title, &i.PubDate); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (s *Store) UpdateItemEmbedding(id int64, embedding []float32) error {
	if len(embedding) == 0 {
		_, err := s.db.Exec(`UPDATE items SET embedding = NULL WHERE id = :id`, sql.Named("id", id))
		return err
	}
	blob := encodeFloat32(embedding)
	_, err := s.db.Exec(`UPDATE items SET embedding = :embedding WHERE id = :id`,
		sql.Named("embedding", blob), sql.Named("id", id))
	return err
}

// SearchItemsSemantic finds items by cosine similarity to a query vector.
// It scans all items with embeddings and returns the top-N most similar.
func (s *Store) SearchItemsSemantic(queryVec []float32, limit int) ([]*SearchItemResult, error) {
	rows, err := s.db.Query(`
		SELECT id, feed_id, title, pub_date, embedding
		FROM items
		WHERE embedding IS NOT NULL
		ORDER BY pub_date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type scored struct {
		*SearchItemResult
		score float64
	}
	candidates := []scored{}

	for rows.Next() {
		var id, feedID, pubDate int64
		var title string
		var embBlob []byte
		if err := rows.Scan(&id, &feedID, &title, &pubDate, &embBlob); err != nil {
			continue
		}
		vec := decodeFloat32(embBlob)
		if len(vec) != len(queryVec) {
			continue
		}
		sim := cosineSimilarity(queryVec, vec)
		candidates = append(candidates, scored{
			SearchItemResult: &SearchItemResult{ID: id, FeedID: feedID, Title: title, PubDate: pubDate},
			score:            sim,
		})
	}

	// Sort by similarity descending.
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	if limit > 0 && limit < len(candidates) {
		candidates = candidates[:limit]
	}

	results := make([]*SearchItemResult, len(candidates))
	for i, c := range candidates {
		results[i] = c.SearchItemResult
	}
	return results, rows.Err()
}

// SearchItemsHybrid combines keyword FTS search with semantic ranking.
// It takes the union of both result sets, deduplicates, and re-ranks
// by semantic similarity when available.
func (s *Store) SearchItemsHybrid(query string, queryVec []float32, limit int) ([]*SearchItemResult, error) {
	// 1. Keyword search.
	keywordResults, _ := s.SearchItems(query, limit*2)

	// 2. Semantic search.
	semanticResults, _ := s.SearchItemsSemantic(queryVec, limit*2)

	// 3. Merge and deduplicate.
	seen := make(map[int64]bool)
	merged := []*SearchItemResult{}

	// Prefer semantic results first (usually higher precision).
	for _, r := range semanticResults {
		if !seen[r.ID] {
			seen[r.ID] = true
			merged = append(merged, r)
		}
	}
	// Then keyword results.
	for _, r := range keywordResults {
		if !seen[r.ID] {
			seen[r.ID] = true
			merged = append(merged, r)
		}
	}

	if limit > 0 && limit < len(merged) {
		merged = merged[:limit]
	}
	return merged, nil
}

func encodeFloat32(v []float32) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

func decodeFloat32(buf []byte) []float32 {
	n := len(buf) / 4
	v := make([]float32, n)
	for i := 0; i < n; i++ {
		bits := binary.LittleEndian.Uint32(buf[i*4:])
		v[i] = math.Float32frombits(bits)
	}
	return v
}

func cosineSimilarity(a, b []float32) float64 {
	var dot, normA, normB float64
	for i := range a {
		xa := float64(a[i])
		xb := float64(b[i])
		dot += xa * xb
		normA += xa * xa
		normB += xb * xb
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

func (s *Store) searchItemsPostgres(query string, limit int) ([]*SearchItemResult, error) {
	rows, err := s.db.Query(`
		SELECT i.id, i.feed_id, i.title, i.pub_date
		FROM items_fts_doc
		INNER JOIN items i ON i.id = items_fts_doc.item_id
		WHERE items_fts_doc.search_vector @@ plainto_tsquery('simple', :query)
		ORDER BY i.pub_date DESC, i.id DESC
		LIMIT :limit
	`, sql.Named("query", query), sql.Named("limit", limit))
	if err != nil {
		return s.searchItemsLike(query, limit)
	}
	defer rows.Close()

	items := []*SearchItemResult{}
	for rows.Next() {
		i := &SearchItemResult{}
		if err := rows.Scan(&i.ID, &i.FeedID, &i.Title, &i.PubDate); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func buildSQLiteFTSQuery(query string) string {
	parts := strings.Fields(strings.TrimSpace(query))
	if len(parts) == 0 {
		return ""
	}

	terms := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		part = strings.ReplaceAll(part, `"`, `""`)
		terms = append(terms, `"`+part+`"*`)
	}

	return strings.Join(terms, " AND ")
}

func (s *Store) searchItemsLike(query string, limit int) ([]*SearchItemResult, error) {
	rows, err := s.db.Query(`
		SELECT id, feed_id, title, pub_date
		FROM items
		WHERE title LIKE :query OR content LIKE :query
		ORDER BY pub_date DESC, id DESC
		LIMIT :limit
	`, sql.Named("query", "%"+query+"%"), sql.Named("limit", limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []*SearchItemResult{}
	for rows.Next() {
		i := &SearchItemResult{}
		if err := rows.Scan(&i.ID, &i.FeedID, &i.Title, &i.PubDate); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// CountItems returns the total count of items matching the filter criteria.
func (s *Store) CountItems(params ListItemsParams) (int, error) {
	query := `SELECT COUNT(*) FROM items`
	args := []any{}

	if params.GroupID != nil {
		query += ` INNER JOIN feeds ON items.feed_id = feeds.id`
	}

	query += ` WHERE 1=1`

	if params.FeedID != nil {
		query += ` AND items.feed_id = :feed_id`
		args = append(args, sql.Named("feed_id", *params.FeedID))
	}
	if params.GroupID != nil {
		query += ` AND feeds.group_id = :group_id`
		args = append(args, sql.Named("group_id", *params.GroupID))
	}
	if params.Unread != nil {
		query += ` AND items.unread = :unread`
		args = append(args, sql.Named("unread", boolToInt(*params.Unread)))
	}

	var count int
	err := s.db.QueryRow(query, args...).Scan(&count)
	return count, err
}
