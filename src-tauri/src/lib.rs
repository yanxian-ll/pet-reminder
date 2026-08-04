use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Position, Size, State, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

#[derive(Clone)]
struct BreakEnforcement(Arc<AtomicBool>);

#[tauri::command]
fn show_settings_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "settings window not found".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn fit_main_window_to_all_monitors_impl(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;

    if monitors.is_empty() {
        if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
            window
                .set_position(Position::Physical(*monitor.position()))
                .map_err(|error| error.to_string())?;
            window
                .set_size(Size::Physical(*monitor.size()))
                .map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let min_x = monitors
        .iter()
        .map(|monitor| monitor.position().x)
        .min()
        .unwrap_or(0);
    let min_y = monitors
        .iter()
        .map(|monitor| monitor.position().y)
        .min()
        .unwrap_or(0);
    let max_x = monitors
        .iter()
        .map(|monitor| {
            monitor
                .position()
                .x
                .saturating_add(monitor.size().width.min(i32::MAX as u32) as i32)
        })
        .max()
        .unwrap_or(min_x + 1);
    let max_y = monitors
        .iter()
        .map(|monitor| {
            monitor
                .position()
                .y
                .saturating_add(monitor.size().height.min(i32::MAX as u32) as i32)
        })
        .max()
        .unwrap_or(min_y + 1);

    let width = max_x.saturating_sub(min_x).max(1) as u32;
    let height = max_y.saturating_sub(min_y).max(1) as u32;

    window
        .set_position(Position::Physical((min_x, min_y).into()))
        .map_err(|error| error.to_string())?;
    window
        .set_size(Size::Physical((width, height).into()))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn fit_main_window_to_all_monitors(app: AppHandle) -> Result<(), String> {
    fit_main_window_to_all_monitors_impl(&app)
}

fn enforce_break_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_always_on_top(true);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn set_break_enforcement(
    app: AppHandle,
    state: State<'_, BreakEnforcement>,
    enabled: bool,
) -> Result<(), String> {
    state.0.store(enabled, Ordering::SeqCst);
    if enabled {
        fit_main_window_to_all_monitors_impl(&app)?;
        enforce_break_window(&app);
    }
    Ok(())
}

#[tauri::command]
fn update_tray_tooltip(app: AppHandle, tooltip: String) -> Result<(), String> {
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "tray icon not found".to_string())?;
    tray.set_tooltip(Some(tooltip))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn show_native_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_system_idle_seconds() -> u64 {
    system_idle_seconds()
}

#[cfg(target_os = "windows")]
fn system_idle_seconds() -> u64 {
    use std::mem::size_of;
    use windows_sys::Win32::{
        System::SystemInformation::GetTickCount,
        UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
    };

    let mut info = LASTINPUTINFO {
        cbSize: size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    let success = unsafe { GetLastInputInfo(&mut info) };
    if success == 0 {
        return 0;
    }
    let current = unsafe { GetTickCount() };
    current.wrapping_sub(info.dwTime) as u64 / 1000
}

#[cfg(target_os = "linux")]
fn system_idle_seconds() -> u64 {
    linux_idle_milliseconds().unwrap_or(0) / 1000
}

#[cfg(target_os = "linux")]
fn linux_idle_milliseconds() -> Option<u64> {
    command_last_number(
        "gdbus",
        &[
            "call",
            "--session",
            "--dest",
            "org.gnome.Mutter.IdleMonitor",
            "--object-path",
            "/org/gnome/Mutter/IdleMonitor/Core",
            "--method",
            "org.gnome.Mutter.IdleMonitor.GetIdletime",
        ],
    )
    .or_else(|| command_last_number("xprintidle", &[]))
}

#[cfg(target_os = "linux")]
fn command_last_number(program: &str, args: &[&str]) -> Option<u64> {
    use std::process::Command;

    let output = Command::new(program).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .split(|character: char| !character.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u64>().ok())
        .last()
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn system_idle_seconds() -> u64 {
    0
}

fn emit_main_command(app: &AppHandle, command: &str, force_show: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if force_show {
            let _ = window.show();
            let _ = window.set_focus();
        }
        let _ = window.emit("tray-command", command.to_string());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None,
                ))?;

                let enforcement_flag = Arc::new(AtomicBool::new(false));
                app.manage(BreakEnforcement(enforcement_flag.clone()));
                let app_handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    if enforcement_flag.load(Ordering::SeqCst) {
                        let app_for_closure = app_handle.clone();
                        let _ = app_handle.run_on_main_thread(move || {
                            enforce_break_window(&app_for_closure);
                        });
                    }
                    std::thread::sleep(Duration::from_millis(300));
                });

                let break_now = MenuItem::with_id(app, "break-now", "立即休息", true, None::<&str>)?;
                let pause_toggle = MenuItem::with_id(app, "pause-toggle", "暂停 / 继续", true, None::<&str>)?;
                let dnd = MenuItem::with_id(app, "dnd-30", "勿扰 30 分钟", true, None::<&str>)?;
                let extend_break = MenuItem::with_id(app, "extend-break-1", "再休息 1 分钟", true, None::<&str>)?;
                let show_panel = MenuItem::with_id(app, "show-panel", "显示桌宠", true, None::<&str>)?;
                let settings = MenuItem::with_id(app, "open-settings", "设置", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(
                    app,
                    &[&break_now, &pause_toggle, &dnd, &extend_break, &show_panel, &settings, &quit],
                )?;

                TrayIconBuilder::with_id("main-tray")
                    .tooltip("桌宠提醒休息")
                    .icon(app.default_window_icon().expect("missing app icon").clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "open-settings" => {
                            if let Some(window) = app.get_webview_window("settings") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        command => emit_main_command(app, command, true),
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let visible = window.is_visible().unwrap_or(false);
                                if visible {
                                    let _ = window.emit("tray-command", "hide-panel".to_string());
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = window.emit("tray-command", "show-panel".to_string());
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let enforcement = window.app_handle().state::<BreakEnforcement>();
                if enforcement.0.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            show_settings_window,
            fit_main_window_to_all_monitors,
            set_break_enforcement,
            update_tray_tooltip,
            show_native_notification,
            get_system_idle_seconds
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
