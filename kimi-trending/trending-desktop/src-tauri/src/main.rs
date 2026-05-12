// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    Manager, WindowEvent,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Set up system tray
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &hide, &quit])
                .build()?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Trending Aggregator")
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button,
                        button_state,
                        ..
                    } = event
                    {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Set up native menu bar
            let file_menu = SubmenuBuilder::new(app, "File")
                .text("refresh", "Refresh", Some("CmdOrCtrl+R"))
                .separator()
                .quit()
                .build()?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .text("dashboard", "Dashboard", Some("CmdOrCtrl+1"))
                .text("github-trending", "GitHub Trending", Some("CmdOrCtrl+2"))
                .text("github-starred", "GitHub Starred", Some("CmdOrCtrl+3"))
                .text("product-hunt", "Product Hunt", Some("CmdOrCtrl+4"))
                .separator()
                .text("settings", "Settings", Some("CmdOrCtrl+Comma"))
                .build()?;
            let help_menu = SubmenuBuilder::new(app, "Help")
                .text("about", "About Trending Aggregator", None::<&str>)
                .build()?;

            let menu_bar = MenuBuilder::new(app)
                .items(&[&file_menu, &view_menu, &help_menu])
                .build()?;
            app.set_menu(menu_bar)?;

            app.on_menu_event(|app, event| {
                if let Some(window) = app.get_webview_window("main") {
                    match event.id.as_ref() {
                        "refresh" => {
                            let _ = window.eval("window.location.reload()");
                        }
                        "dashboard" => {
                            let _ = window.eval("window.location.hash = '/'");
                        }
                        "github-trending" => {
                            let _ = window.eval("window.location.hash = '/github-trending'");
                        }
                        "github-starred" => {
                            let _ = window.eval("window.location.hash = '/github-starred'");
                        }
                        "product-hunt" => {
                            let _ = window.eval("window.location.hash = '/product-hunt'");
                        }
                        "settings" => {
                            let _ = window.eval("window.location.hash = '/settings'");
                        }
                        _ => {}
                    }
                }
            });

            // Handle window close to hide instead of quit (keep tray active)
            let window = app.get_webview_window("main").unwrap();
            window.on_window_event(|window, event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
