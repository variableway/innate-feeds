# AGENTS.md

Workspace index for `innate-feeds`. The repo bundles four sub-projects; the
aggregator is the only product. The rest are reference / source material.

## Sub-projects

| Path | Role | Read more |
|---|---|---|
| `innate-hub/` | The product. Go backend + DB, emits RSS/Atom/JSON-Feed. Source plugins live in `backend/internal/adapter/`. | `innate-hub/backend/cmd/hub/main.go`, `innate-hub/backend/internal/adapter/registry.go` |
| `fusion/` | Reference consumer. Not built or modified from this repo. Use as the canonical reader to verify the RSS output. | upstream `fusion/README.md` |
| `TrendRadar/` | Python hot-news crawler. Read-only input to the `trendradar` adapter. | upstream `TrendRadar/README.md` |
| `awesome-to-sites/` | A collection of published awesome-list websites, each a separate git submodule. **Out of scope for the aggregator.** | per-submodule `README.md` |

## Where to make changes

| If you are… | Go to… |
|---|---|
| Adding a new feed source | `innate-hub/backend/internal/adapter/<name>/` — implement `adapter.Adapter`, register in `innate-hub/backend/cmd/hub/main.go` |
| Changing RSS / Atom output | `innate-hub/backend/internal/handler/` (new feed-output routes) |
| Changing the Fever API | `innate-hub/backend/internal/handler/fever.go` |
| Changing puller / store | `innate-hub/backend/internal/pull/`, `innate-hub/backend/internal/store/` |
| Updating the embedded UI (fusion's frontend) | build the frontend in `fusion/frontend/`, drop the output into `innate-hub/backend/internal/web/dist/` (or wire a reverse proxy in `docker-compose.yml`) |
| Updating the planned work | `plan.md` |

## Conventions

- **Go**: `log/slog` for logging, `database/sql` for the main store, GORM only
  inside `internal/trending/`. Errors bubble up with `fmt.Errorf("...: %w", err)`.
- **Adapters**: a Go package exposing `Name() string` and
  `Pull(ctx, *model.Feed, timeout) (*adapter.Result, error)`. See
  `internal/adapter/adapter.go`.
- **Feed identity**: every pulled item is keyed by `GUID` inside its feed
  (`BatchCreateItemsIgnore`). Two sources can produce the same item only if
  they share a feed row, not a global GUID.
- **Auth**: session cookie or `X-API-Key` header on `/api/*`. Fever at
  `/fever` uses its own key derived from `FUSION_PASSWORD`. RSS output
  endpoints are unauthenticated by design (they are consumed by external
  readers).
- **Config**: every env var defaults are documented in
  `innate-hub/backend/internal/config/config.go`. There is **no** root
  `.env.example` — the canonical one lives at `innate-hub/.env.example`.

## Quick commands

```bash
# Run the aggregator
cd innate-hub/backend
cp .env.example .env  # edit FUSION_PASSWORD, GITHUB_TOKEN, etc.
go run ./cmd/hub

# Verify it works
curl http://localhost:8080/api/feeds
curl http://localhost:8080/feeds/1/rss.xml

# Point Fusion at it (consumer side)
FUSION_API_URL=http://localhost:8080  # in fusion's config
```
