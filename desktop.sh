#!/bin/bash
set -e

cd "$(dirname "$0")/trending-desktop/src-tauri"

if ! command -v cargo &>/dev/null; then
  echo "❌ Rust/Cargo not found. Install from https://rustup.rs/"
  exit 1
fi

if ! cargo tauri --version &>/dev/null; then
  echo "📦 Installing Tauri CLI..."
  cargo install tauri-cli
fi

MODE="${1:-dev}"

case "$MODE" in
  build)
    echo "🏗️  Building desktop app for production..."
    echo "   (this also builds trending-web first)"
    cargo tauri build
    echo ""
    echo "✅ Build complete! Find the app in:"
    echo "   trending-desktop/src-tauri/target/release/bundle/"
    ;;
  dev|*)
    echo "🚀 Launching desktop app in dev mode..."
    echo "   (starts trending-web dev server + Tauri window)"
    cargo tauri dev
    ;;
esac
