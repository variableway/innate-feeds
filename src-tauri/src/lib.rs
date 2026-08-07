use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{Manager, RunEvent};

/// Runtime handle for the bundled backend sidecar.
struct BackendState {
    port: u16,
    ready: bool,
    child: Mutex<Option<Child>>,
}

#[derive(Serialize)]
struct BackendInfo {
    host: String,
    port: u16,
    ready: bool,
}

fn sidecar_name() -> String {
    if cfg!(target_os = "windows") {
        "innate-feeds-backend.exe".to_string()
    } else {
        "innate-feeds-backend".to_string()
    }
}

/// Minimal HTTP/1.1 GET to the sidecar `/api/health` endpoint (no extra deps).
fn health_check(port: u16) -> bool {
    let addr: SocketAddr = match format!("127.0.0.1:{}", port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let req = b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    if stream.write_all(req).is_err() {
        return false;
    }
    let mut buf = Vec::with_capacity(512);
    let _ = stream.read_to_end(&mut buf);
    String::from_utf8_lossy(&buf).contains("\"ok\":true")
}

/// Frontend calls this to learn where the sidecar is listening.
#[tauri::command]
fn get_backend_info(state: tauri::State<BackendState>) -> BackendInfo {
    BackendInfo {
        host: "127.0.0.1".to_string(),
        port: state.port,
        ready: state.ready,
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            let resource_dir: PathBuf = app.path().resource_dir()?;

            // Allocate a free port for the sidecar (avoids hardcoding 4000).
            let listener = TcpListener::bind("127.0.0.1:0")?;
            let port = listener.local_addr()?.port();
            drop(listener);

            let bin = resource_dir.join("binaries").join(sidecar_name());
            log::info!("Spawning sidecar {} on port {}", bin.display(), port);

            // The sidecar inherits its default DB path (~/.innate/feeds.db) so
            // the desktop app reads the same database the backend CLI syncs to.
            // We deliberately do NOT set DB_PATH/INNATE_HOME here: pinning them
            // to app_data isolated the desktop from the populated ~/.innate DB
            // and left it with an empty schema-only database.
            let child = Command::new(&bin)
                .env("HOST", "127.0.0.1")
                .env("PORT", port.to_string())
                .spawn()
                .map_err(|e| {
                    Box::<dyn std::error::Error>::from(format!(
                        "failed to spawn sidecar at {}: {}",
                        bin.display(),
                        e
                    ))
                })?;

            // Wait for the sidecar to become healthy (max ~15s).
            let deadline = Instant::now() + Duration::from_secs(15);
            let mut ready = false;
            while Instant::now() < deadline {
                if health_check(port) {
                    ready = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            if ready {
                log::info!("Sidecar ready on port {}", port);
            } else {
                log::error!(
                    "Sidecar did not become healthy on port {} within 15s",
                    port
                );
            }

            app.manage(BackendState {
                port,
                ready,
                child: Mutex::new(Some(child)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_info])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Kill the sidecar when the app exits so it is not orphaned.
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<BackendState>() {
                    if let Ok(mut guard) = state.child.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        });
}
