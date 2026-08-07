#!/usr/bin/env bash
#
# Package the built `Innate Feeds.app` into a distributable `.dmg` via hdiutil.
#
# Tauri's own `bundle_dmg.sh` (a create-dmg fork) is environment-sensitive and
# can fail opaquely on some macOS setups. This is a minimal, reliable fallback
# that produces a valid compressed DMG containing the .app and an Applications
# symlink (drag-to-install). It is wired into `tauri:build` so a single command
# yields both the .app and the .dmg.
set -euo pipefail

APP_NAME="Innate Feeds"
VERSION="0.1.0"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve the Cargo target dir. Prefer CARGO_TARGET_DIR env, else ask cargo
# (respects ~/.cargo/config.toml `build.target-dir`), else fall back to default.
if [ -n "${CARGO_TARGET_DIR:-}" ]; then
  TARGET_DIR="$CARGO_TARGET_DIR"
else
  TARGET_DIR="$(cd "$ROOT/src-tauri" && cargo metadata --format-version 1 --no-deps 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])' 2>/dev/null \
    || echo "$ROOT/src-tauri/target")"
fi

APP="$TARGET_DIR/release/bundle/macos/$APP_NAME.app"
OUT_DIR="$TARGET_DIR/release/bundle/dmg"

case "$(uname -m)" in
  arm64) ARCH="aarch64" ;;
  x86_64) ARCH="x64" ;;
  *) ARCH="$(uname -m)" ;;
esac
OUT="$OUT_DIR/${APP_NAME}_${VERSION}_${ARCH}.dmg"

if [ ! -d "$APP" ]; then
  echo "❌ App bundle not found at $APP" >&2
  echo "   Run 'bun run tauri:build' first (it builds the .app via 'tauri build --bundles app')." >&2
  exit 1
fi

# Ad-hoc sign the .app if it isn't already signed. macOS LaunchServices won't
# let an unsigned main binary spawn the bundled sidecar (which `bun build
# --compile` signs with hardened runtime) when launched via double-click/open,
# so the sidecar never starts and the app shows no data. Ad-hoc signing fixes
# the double-click launch. Skipped if a real signature is already present
# (e.g. a Developer ID applied by Tauri via bundle.macOS.signingIdentity).
if ! codesign --verify "$APP" >/dev/null 2>&1; then
  echo "🔏 Ad-hoc signing $APP (unsigned build) ..."
  if ! codesign --force --deep --sign - "$APP" >/dev/null 2>&1; then
    echo "⚠️  codesign failed; the app may not launch via double-click" >&2
  fi
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

echo "📦 Creating $OUT ..."
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  -imagekey zlib-level=9 \
  "$OUT" >/dev/null

echo "✅ Created $OUT"
