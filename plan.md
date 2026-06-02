# plan.md — Plugin → RSS → Reader

## Goal

`innate-feeds` is a plugin-based aggregator. Each source is a Go adapter that
implements `adapter.Adapter` and returns normalized items. The aggregator
stores them in one database, then re-emits them as **standard RSS 2.0,
Atom 1.0, and JSON Feed** so any RSS reader — Fusion first — can subscribe.

```
source ──► adapter ──► puller ──► store ──► RSS / Atom / JSON-Feed ──► reader
                                       └──► REST API     ──► own UI (later)
                                       └──► Fever API    ──► mobile clients
```

The aggregator is the only product built from this repo. `fusion/` is the
reference consumer. `TrendRadar/` is one of several sources.

---

## Current state of `innate-hub`

Read this before changing anything — the bones are already there.

### What exists

- **Backend** (`innate-hub/backend/cmd/hub/main.go`) — Gin server, puller,
  scheduler, embedder, OIDC, login limiter.
- **Adapter system** (`innate-hub/backend/internal/adapter/`)
  - `adapter.go` — the `Adapter` interface and the `Result` struct.
  - `registry.go` — `Registry` keyed by `source_type`.
  - Implemented adapters: `rss`, `trendradar`, `githubtrending`,
    `producthunt`.
  - Optional `DiscoveryAdapter` for sources that can list their own feeds.
- **Store** (`innate-hub/backend/internal/store/`) — `groups`, `feeds`,
  `items`, `bookmarks`, `sessions`, `api_keys`, plus
  `migrate_legacy*` for one-time data import.
- **Handlers** (`innate-hub/backend/internal/handler/`)
  - `/api/*` — JSON REST for groups, feeds, items, bookmarks, search, sessions.
  - `/fever` — Fever API (Reeder, Unread, FeedMe).
  - `trending.go` — separate trending endpoints.
- **Puller** (`innate-hub/backend/internal/pull/`) — concurrent periodic
  pulls with ETag/Last-Modified/Retry-After support and exponential backoff.
- **Trending subsystem** (`innate-hub/backend/internal/trending/`) — GORM
  tables for GitHub Trending, GitHub Starred, Product Hunt. Used as raw
  analytics, **not** routed through the feed adapter pipeline.

### What is missing (the gap)

| # | Gap | Why it matters |
|---|---|---|
| 1 | **No RSS / Atom / JSON-Feed output endpoints.** | The whole goal of this repo. Readers can't subscribe. |
| 2 | **`fusion` is not a source plugin.** | Fusion is the reference consumer. A `fusion` adapter lets one Fusion instance pull from another (or from innate-hub itself for round-trip tests). |
| 3 | **Trending tables are not in the feed pipeline.** | GitHub Trending and Product Hunt have their own `/api/trending/*` route and never become items. The `githubtrending` and `producthunt` adapters do emit items, so this is mostly a docs/cleanup task. |
| 4 | **The bundled frontend in `innate-hub/frontend/` overlaps with Fusion.** | Per the goal, reuse Fusion's frontend first. Innate-hub's frontend stays as a future option. |
| 5 | **No plugin hot-load.** | Adapters are wired in `main.go` at compile time. Acceptable for v1; document it. |

---

## Stage 1 — RSS output layer (the missing core)

**Goal:** every feed, every group, and the global timeline is reachable as
RSS 2.0, Atom 1.0, and JSON Feed from an unauthenticated URL.

### Work items

- **1.1** New package `innate-hub/backend/internal/feedfmt/`
  - `rss.go` — emit RSS 2.0 with `<channel>`, `<item>` (title, link,
    description, guid, pubDate, author, category, enclosure).
  - `atom.go` — emit Atom 1.0 (feed, entry, author, updated, id, link rel).
  - `jsonfeed.go` — emit JSON Feed 1.1.
  - All three share one item→struct conversion so the formats stay in sync.
- **1.2** New handler group in `internal/handler/feeds_out.go`
  - `GET /feeds/:id/rss.xml`
  - `GET /feeds/:id/atom.xml`
  - `GET /feeds/:id/feed.json`
  - `GET /groups/:id/rss.xml` (and atom, json)
  - `GET /all/rss.xml` (and atom, json) — cross-feed timeline, default 50 most
    recent items, paginated with `?before=<unix>` and `?limit=`.
  - Optional `?unread=1` filter on all endpoints.
  - All responses: `Content-Type` set, `Cache-Control: public, max-age=60`,
    `ETag` derived from max `pub_date`.
- **1.3** New `FeedLinkProvider` (or extend the store) so each feed row knows
  its public URL. The host comes from `X-Forwarded-Proto`/`Host` if
  `FUSION_PUBLIC_URL` is unset.
- **1.4** Tests
  - Golden-file tests for each format with a fixed item set.
  - Handler test: hit `/feeds/1/rss.xml` and assert the body parses as valid
    RSS via a real XML decoder.
- **1.5** Docs — add an `Output Feeds` section to
  `innate-hub/README.md` with example `curl` and the list of supported
  formats.

**Done when:** subscribing to `http://localhost:8080/feeds/1/rss.xml` in any
reader shows the items the aggregator has pulled.

---

## Stage 2 — `fusion` as a source plugin

**Goal:** treat a remote Fusion instance (its `/fever` API or its SQLite DB)
as just another adapter.

### Work items

- **2.1** Decide on the data path.
  - **Option A (recommended):** the `fusion` adapter calls a remote Fusion's
    `/fever` endpoint. The aggregator becomes a meta-aggregator: one Fusion
    feeds the next.
  - **Option B:** the `fusion` adapter opens a remote Fusion's SQLite file
    over a shared volume. Faster, but couples deployments.
  - Implement A. Document B as a fallback.
- **2.2** New package `innate-hub/backend/internal/adapter/fusion/`
  - Implements `adapter.Adapter` with `Name() == "fusion"`.
  - `Pull` does: log in → `/fever?api=&groups=&feeds=&items=` with a
    `since_id` cursor → emit one feed per Fusion group, with items as
    `model.Item`.
  - Caches the `api_key` derived from `MD5(user:pass)` (same algo as
    `handler/fever.go`).
- **2.3** Per-Fusion-feeds config.
  - A new `FusionSource` struct: `BaseURL`, `Username`, `Password`,
    `SyncInterval`, optional `Groups` allowlist.
  - Loaded from env (`FUSION_SOURCES_JSON`) or a `fusion_sources` DB table.
  - At startup, `main.go` registers one adapter per source; each becomes a
    feed in the store with `source_type = "fusion"`.
- **2.4** Tests — mock a `/fever` response, assert the adapter emits the
  right `model.Item` list with stable GUIDs.
- **2.5** Docs — add `fusion` to the adapter table in
  `innate-hub/README.md` and to the Fever round-trip section of
  `plan.md` (Stage 4).

**Done when:** a single `FUSION_SOURCES_JSON` line adds a remote Fusion as a
feed source in innate-hub.

---

## Stage 3 — Reuse Fusion's frontend

**Goal:** innate-hub ships no custom UI; the reader experience is Fusion's
own React app pointed at innate-hub's RSS endpoints + Fever API.

### Work items

- **3.1** Pick the wiring.
  - **Option A (recommended):** Fusion runs as a separate service alongside
    innate-hub. `docker-compose.yml` (in `innate-hub/`) starts both.
    Fusion's `FUSION_API_URL` and Fever key point at innate-hub.
  - **Option B:** build Fusion's frontend in `fusion/`, copy `dist/` into
    `innate-hub/backend/internal/web/dist/`. Innate-hub serves it from the
    existing `frontend.go` static handler.
  - Implement A. Keep B as a fallback for single-binary users.
- **3.2** For Option A — author `innate-hub/docker-compose.yml` with two
  services:
  ```yaml
  services:
    innate-hub:
      build: ./backend
      ports: ["127.0.0.1:8080:8080"]
      volumes: ["./data:/data"]
    fusion:
      image: ghcr.io/0x2e/fusion:latest
      ports: ["127.0.0.1:8081:8080"]
      environment:
        FUSION_API_URL: http://innate-hub:8080
      depends_on: [innate-hub]
  ```
- **3.3** Verify the round trip:
  - Start both containers.
  - Open `http://localhost:8081` (Fusion UI).
  - Add a feed in Fusion pointing at `http://innate-hub:8080/all/rss.xml` —
    Fusion should show innate-hub's aggregated timeline.
  - Add a Fusion source in innate-hub — that source's items should also
    appear in the timeline (eventually).
- **3.4** Deprecate `innate-hub/frontend/` in this plan. Keep the directory
  for a future "innate-hub native UI" stage, but stop using it as the
  default.

**Done when:** the project's default run is `docker compose up` and a user
gets a working reader UI without any frontend code in this repo.

---

## Stage 4 — Verify the full plugin → RSS loop

**Goal:** confirm that every source plugin's items are reachable as RSS, and
that Fusion (or any reader) can subscribe.

### Work items

- **4.1** End-to-end test script `scripts/e2e.sh` (or a Go test) that:
  1. Starts innate-hub with a sample feed (`rss` adapter pointing at a
     local fixture).
  2. Curls `/feeds/:id/rss.xml`, asserts at least one `<item>`.
  3. Parses the body with a real XML parser to catch malformed output.
- **4.2** Manual subscription test in Fusion: subscribe to
  `http://localhost:8080/all/rss.xml`; check that items appear.
- **4.3** Plugin-coverage matrix in `innate-hub/README.md`:
  | Adapter | Source | In repo? | Status |
  |---|---|---|---|
  | `rss` | Standard RSS/Atom | yes | shipped |
  | `trendradar` | TrendRadar SQLite | yes | shipped |
  | `githubtrending` | GitHub Trending | yes | shipped |
  | `producthunt` | Product Hunt | yes | shipped |
  | `fusion` | Remote Fusion | no (Stage 2) | planned |
- **4.4** Backlog for future plugins (not in scope, listed for context):
  Hacker News, Lobsters, YouTube channels, podcast feeds, Mastodon timelines,
  Bluesky feeds, X/Twitter lists.

---

## Out of scope (for now)

- A custom React UI in `innate-hub/frontend/`. Fusion covers this.
- Hot-loadable plugins (Go plugin package or WASM). All adapters are
  compiled in.
- A new `fusion/` fork. The reference is upstream only.
- Migrating `awesome-to-sites/` into the aggregator. Those are
  publish-target websites, not feed sources.

---

## Order of execution

1. **Stage 1** — RSS output. Without it, the rest is unverifiable.
2. **Stage 3** — wire Fusion as the consumer. Now the loop is real, even
   with only the existing adapters.
3. **Stage 2** — `fusion` source plugin. Closes the loop.
4. **Stage 4** — verify and document.

---

## Status

| Stage | Status | Notes |
|---|---|---|
| 1. RSS output layer | **done** | `internal/feedfmt/` + `feeds_out.go` handler + tests |
| 2. `fusion` source plugin | **done** | `internal/adapter/fusion/` + `FUSION_SOURCES_JSON` |
| 3. Reuse Fusion frontend | **done** | `docker-compose.yml` `stack` profile |
| 4. Verify full loop | in progress | e2e script + plugin matrix |
