# Trending Aggregator Desktop

A Tauri v2 desktop application wrapping the Trending Aggregator web frontend.

## Features

- **System Tray Integration** - App stays running in the system tray when the window is closed
- **Native Menu Bar** - Keyboard shortcuts for all main views (Cmd/Ctrl+1-4)
- **Native Notifications** - Desktop notifications for trend updates
- **Cross-Platform** - Builds for Windows (.msi), macOS (.dmg), and Linux (.deb/.AppImage)

## Project Structure

```
trending-desktop/
  src-tauri/
    Cargo.toml          # Rust dependencies and package config
    tauri.conf.json     # Tauri application configuration
    build.rs            # Build script
    capabilities/       # Permission capabilities
      default.json
    src/
      main.rs           # Application entry point with tray, menu, window management
      lib.rs            # Library exports
    icons/              # Application icons (generated)
  trending-web/         # The web frontend (built separately)
    dist/               # Built frontend assets
  scripts/
    generate-icons.sh   # Helper for icon generation
```

## Prerequisites

- [Rust](https://rustup.rs/) (1.75+)
- [Node.js](https://nodejs.org/) (for the web frontend build)

## Development

```bash
# Install Tauri CLI
cargo install tauri-cli

# Run in development mode (requires the frontend dev server)
cd src-tauri
cargo tauri dev

# Build for production
cd src-tauri
cargo tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+R | Refresh page |
| Cmd/Ctrl+1 | Go to Dashboard |
| Cmd/Ctrl+2 | Go to GitHub Trending |
| Cmd/Ctrl+3 | Go to GitHub Starred |
| Cmd/Ctrl+4 | Go to Product Hunt |
| Cmd/Ctrl+, | Open Settings |

## System Tray

- **Left Click** - Show window
- **Show** - Bring window to front
- **Hide** - Hide window to tray
- **Quit** - Exit application

## Building Icons

Place a 1024x1024 PNG source image and run:

```bash
cargo install tauri-cli
cargo tauri icon /path/to/source.png
```

This generates all required icon sizes in `src-tauri/icons/`.
