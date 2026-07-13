use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Position, Size,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
fn show_settings_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "settings window not found".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn fit_main_window_to_current_monitor(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
        window
            .set_position(Position::Physical(*monitor.position()))
            .map_err(|error| error.to_string())?;
        window
            .set_size(Size::Physical(*monitor.size()))
            .map_err(|error| error.to_string())?;
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

#[cfg(not(target_os = "windows"))]
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
        .invoke_handler(tauri::generate_handler![
            show_settings_window,
            fit_main_window_to_current_monitor,
            update_tray_tooltip,
            show_native_notification,
            get_system_idle_seconds
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
