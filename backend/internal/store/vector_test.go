package store

import (
	"math"
	"path/filepath"
	"testing"
)

func TestEncodePgVector(t *testing.T) {
	cases := []struct {
		in   []float32
		want string
	}{
		{nil, ""},
		{[]float32{}, ""},
		{[]float32{1}, "1"},
		{[]float32{1, 2, 3}, "1,2,3"},
		{[]float32{0.1, -0.5, 0.0001}, "0.1,-0.5,0.0001"},
	}
	for _, c := range cases {
		if got := encodePgVector(c.in); got != c.want {
			t.Errorf("encodePgVector(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestStore_VectorReady_SQLite_DefaultsOff(t *testing.T) {
	// SQLite has no native vector operator; vectorReady must be false.
	st, err := New(":memory:")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer st.Close()

	if st.VectorReady() {
		t.Errorf("expected VectorReady()=false on SQLite, got true")
	}
	if st.VectorDim() != 0 {
		t.Errorf("expected VectorDim()=0 on SQLite, got %d", st.VectorDim())
	}
}

func TestStore_SearchItemsSemantic_BruteForce_Fallback(t *testing.T) {
	// SQLite path: brute force. Three items with embeddings, one aligned
	// with the query, one neutral, one orthogonal. Aligned should rank first.
	st, err := New(":memory:")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer st.Close()

	// Migration seeds group id=1 ("Default") — use it directly.
	feed, err := st.CreateFeed(1, "test", "https://example.com/feed", "", "")
	if err != nil {
		t.Fatalf("CreateFeed: %v", err)
	}

	// Three 4-dim vectors: aligned, neutral, orthogonal.
	aligned := []float32{1, 0, 0, 0}
	neutral := []float32{0.5, 0.5, 0.5, 0.5}
	orthogonal := []float32{0, 0, 0, 1}

	if err := seedItemWithEmbedding(st, feed.ID, "aligned", aligned); err != nil {
		t.Fatal(err)
	}
	if err := seedItemWithEmbedding(st, feed.ID, "neutral", neutral); err != nil {
		t.Fatal(err)
	}
	if err := seedItemWithEmbedding(st, feed.ID, "orthogonal", orthogonal); err != nil {
		t.Fatal(err)
	}

	query := []float32{1, 0, 0, 0}
	results, err := st.SearchItemsSemantic(query, 5)
	if err != nil {
		t.Fatalf("SearchItemsSemantic: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("got %d results, want 3", len(results))
	}
	// "aligned" should be the top result.
	if results[0].Title != "aligned" {
		t.Errorf("top result title = %q, want 'aligned'", results[0].Title)
	}
	// "orthogonal" should be the last.
	if results[2].Title != "orthogonal" {
		t.Errorf("last result title = %q, want 'orthogonal'", results[2].Title)
	}

	// Mismatched dim is skipped silently.
	if err := seedItemWithEmbedding(st, feed.ID, "wrong-dim", []float32{1, 0, 0, 0, 0}); err != nil {
		t.Fatal(err)
	}
	results, err = st.SearchItemsSemantic(query, 5)
	if err != nil {
		t.Fatalf("SearchItemsSemantic after mismatch: %v", err)
	}
	if len(results) != 3 {
		t.Errorf("expected 3 results after dim mismatch (mismatched skipped), got %d", len(results))
	}
}

func TestStore_UpdateItemEmbedding_ClearsBLOB(t *testing.T) {
	st, err := New(":memory:")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer st.Close()

	feed, err := st.CreateFeed(1, "test", "https://example.com/feed", "", "")
	if err != nil {
		t.Fatal(err)
	}
	x, err := st.CreateItem(feed.ID, "x", "x-title", "https://e/x", "", 0)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.UpdateItemEmbedding(x.ID, []float32{1, 0, 0}); err != nil {
		t.Fatal(err)
	}
	// Wipe the embedding.
	if err := st.UpdateItemEmbedding(x.ID, nil); err != nil {
		t.Fatal(err)
	}
	res, err := st.SearchItemsSemantic([]float32{1, 0, 0}, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 0 {
		t.Errorf("expected 0 results after clear, got %d", len(res))
	}
}

// TestVectorInit_LegacyFile simulates starting a Store on a pre-existing
// sqlite file with the migrations already applied. Vector init must
// be a no-op and not error.
func TestVectorInit_LegacySQLite(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "legacy.db")
	st, err := New(dbPath)
	if err != nil {
		t.Fatalf("first New: %v", err)
	}
	st.Close()

	st2, err := New(dbPath)
	if err != nil {
		t.Fatalf("second New: %v", err)
	}
	defer st2.Close()
	if st2.VectorReady() {
		t.Errorf("VectorReady should be false on SQLite")
	}
}

// Sanity: encode/decode roundtrip.
func TestEncodeDecodeFloat32_Roundtrip(t *testing.T) {
	in := []float32{1.0, -2.5, 0.0001, 12345.6789}
	blob := encodeFloat32(in)
	out := decodeFloat32(blob)
	if len(out) != len(in) {
		t.Fatalf("len mismatch: %d vs %d", len(out), len(in))
	}
	for i := range in {
		if math.Abs(float64(out[i]-in[i])) > 1e-5 {
			t.Errorf("[%d]: %v != %v", i, out[i], in[i])
		}
	}
}

// TestCosineSimilarity_Sanity ensures our similarity function gives the
// expected ordering. The exact numbers don't matter; the relative order
// does.
func TestCosineSimilarity_Sanity(t *testing.T) {
	v := []float32{1, 0, 0}
	aligned := []float32{1, 0, 0}
	neutral := []float32{0.7, 0.7, 0}
	opposite := []float32{-1, 0, 0}
	if cosineSimilarity(v, aligned) <= cosineSimilarity(v, neutral) {
		t.Error("aligned should beat neutral")
	}
	if cosineSimilarity(v, neutral) <= cosineSimilarity(v, opposite) {
		t.Error("neutral should beat opposite")
	}
	if cosineSimilarity(v, opposite) >= 0 {
		t.Error("opposite should be negative")
	}
}

// helper: create an item with the given title/embedding, return its id.
func seedItemWithEmbedding(st *Store, feedID int64, title string, vec []float32) error {
	created, err := st.CreateItem(feedID, "guid-"+title, title, "https://e/"+title, "", 0)
	if err != nil {
		return err
	}
	return st.UpdateItemEmbedding(created.ID, vec)
}
