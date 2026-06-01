use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewWindow,
};
use tauri_plugin_autostart::MacosLauncher;

#[derive(serde::Serialize)]
struct CursorPosition {
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn cursor_position() -> Option<CursorPosition> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    let ok = unsafe { GetCursorPos(&mut point) };
    if ok == 0 {
        None
    } else {
        Some(CursorPosition {
            x: point.x,
            y: point.y,
        })
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn cursor_position() -> Option<CursorPosition> {
    None
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn is_escape_pressed() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE};

    unsafe { (GetAsyncKeyState(VK_ESCAPE as i32) & 0x8000u16 as i16) != 0 }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn is_escape_pressed() -> bool {
    false
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cursor_position,
            is_escape_pressed,
            set_click_through
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None,
                ))?;

                let break_now = MenuItem::with_id(app, "break-now", "立即休息", true, None::<&str>)?;
                let extend_break = MenuItem::with_id(app, "extend-break-1", "再休息 1 分钟", true, None::<&str>)?;
                let pause = MenuItem::with_id(app, "toggle-pause", "暂停/恢复提醒", true, None::<&str>)?;
                let settings = MenuItem::with_id(app, "toggle-settings", "设置", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&break_now, &extend_break, &pause, &settings, &quit])?;

                TrayIconBuilder::new()
                    .tooltip("桌宠提醒休息")
                    .icon(app.default_window_icon().expect("missing app icon").clone())
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => app.exit(0),
                        command => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                if command != "extend-break-1" {
                                    let _ = window.set_focus();
                                }
                                let _ = window.emit("tray-command", command.to_string());
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
