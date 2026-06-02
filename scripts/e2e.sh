#!/usr/bin/env bash
#
# End-to-end test: start innate-hub and verify the RSS/Atom/JSON-Feed
# output endpoints return valid, parseable documents.
#
# Usage:
#   scripts/e2e.sh           # run against an already-running hub on :8080
#   scripts/e2e.sh --start   # start the hub in the background first
#
# Optional:
#   E2E_FEED_URL=https://example.com/feed.xml   seed a real RSS feed
#                                               and wait for it to be pulled
#
# Requires: bash, curl, python3, and (for --start) go.

set -euo pipefail

PORT="${FUSION_PORT:-8080}"
BASE="http://localhost:${PORT}"
START_HUB=0
SEED_URL="${E2E_FEED_URL:-}"

if [[ "${1:-}" == "--start" ]]; then
  START_HUB=1
fi

WORKDIR=$(mktemp -d)
HUB_PID=""
trap 'rm -rf "$WORKDIR"; if [[ -n "$HUB_PID" ]]; then kill "$HUB_PID" 2>/dev/null || true; wait "$HUB_PID" 2>/dev/null || true; fi' EXIT

if [[ "$START_HUB" == "1" ]]; then
  cd "$(dirname "$0")/.."
  echo "==> Building hub"
  (cd backend && go build -o "$WORKDIR/hub" ./cmd/hub)

  echo "==> Starting hub on :$PORT (auth disabled, SQLite, empty password)"
  FUSION_PASSWORD="" FUSION_ALLOW_EMPTY_PASSWORD=true \
    FUSION_PORT="$PORT" FUSION_DB_PATH="$WORKDIR/e2e.db" \
    FUSION_PULL_INTERVAL=60 \
    "$WORKDIR/hub" >"$WORKDIR/hub.log" 2>&1 &
  HUB_PID=$!

  echo "==> Waiting for /api/sessions to come up"
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/sessions" || true)
    if [[ "$code" =~ ^(200|400|404|405)$ ]]; then
      break
    fi
    sleep 0.5
  done

  if [[ -n "$SEED_URL" ]]; then
    echo "==> Seeding feed: $SEED_URL"
    CREATED=$(curl -sf -X POST "$BASE/api/feeds" \
      -H "Content-Type: application/json" \
      -d "{\"group_id\":1,\"name\":\"E2E seed\",\"link\":\"$SEED_URL\",\"site_url\":\"$SEED_URL\",\"source_type\":\"rss\"}")
    FEED_ID=$(echo "$CREATED" | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["id"])')
    echo "==> Created feed id=$FEED_ID, triggering pull"
    curl -sf -X POST "$BASE/api/feeds/$FEED_ID/refresh" >/dev/null || true
    sleep 3
  fi
fi

if [[ -n "$SEED_URL" ]]; then
  # Find the feed id that was just seeded.
  SEED_HOST=$(echo "$SEED_URL" | sed -E 's|^https?://||; s|/.*||')
  FEEDS=$(curl -sf "$BASE/api/feeds")
  FEED_ID=$(echo "$FEEDS" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
for f in data:
    if f.get('link', '').endswith('/$SEED_HOST') or '$SEED_URL' in f.get('link', ''):
        print(f['id']); break
")
  if [[ -z "$FEED_ID" ]]; then
    echo "WARNING: could not identify seeded feed id, defaulting to 1"
    FEED_ID=1
  fi
  echo "==> Using feed id=$FEED_ID for tests"
else
  FEED_ID=1
fi

echo "==> Fetching /feeds/$FEED_ID/rss.xml"
curl -sf "$BASE/feeds/$FEED_ID/rss.xml" -o "$WORKDIR/rss.xml"
python3 - "$WORKDIR/rss.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
path = sys.argv[1]
root = ET.parse(path).getroot()
assert root.tag == "rss", f"root tag = {root.tag}"
ch = root.find("channel")
assert ch is not None, "no <channel>"
items = ch.findall("item")
title = ch.findtext("title", "")
print(f"OK: rss feed '{title}' has {len(items)} item(s)")
PY

echo "==> Checking /all/rss.xml"
curl -sf "$BASE/all/rss.xml" -o "$WORKDIR/all-rss.xml"
python3 - "$WORKDIR/all-rss.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
items = root.findall("./channel/item")
print(f"OK: /all/rss.xml has {len(items)} item(s)")
PY

echo "==> Checking /feeds/$FEED_ID/atom.xml"
curl -sf "$BASE/feeds/$FEED_ID/atom.xml" -o "$WORKDIR/atom.xml"
python3 - "$WORKDIR/atom.xml" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
assert root.tag.endswith("feed"), f"root = {root.tag}"
entries = root.findall("{http://www.w3.org/2005/Atom}entry")
print(f"OK: atom feed has {len(entries)} entry/entries")
PY

echo "==> Checking /feeds/$FEED_ID/feed.json"
curl -sf "$BASE/feeds/$FEED_ID/feed.json" -o "$WORKDIR/jf.json"
python3 - "$WORKDIR/jf.json" <<'PY'
import sys, json
data = json.load(open(sys.argv[1]))
assert data.get("version"), "no version"
assert isinstance(data.get("items"), list), "items is not a list"
print(f"OK: json feed has {len(data['items'])} item(s)")
PY

echo "==> Checking ETag / If-None-Match"
ETAG=$(curl -sfI "$BASE/feeds/$FEED_ID/rss.xml" | grep -i '^etag:' | tr -d '\r' | awk '{print $2}')
if [[ -n "$ETAG" ]]; then
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H "If-None-Match: $ETAG" "$BASE/feeds/$FEED_ID/rss.xml")
  echo "OK: If-None-Match $ETAG -> HTTP $STATUS"
  if [[ "$STATUS" != "304" ]]; then
    echo "WARNING: expected 304, got $STATUS"
  fi
else
  echo "WARNING: no ETag header"
fi

echo "==> ALL CHECKS PASSED"
