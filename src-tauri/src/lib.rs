use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                                let _ = window.set_focus();
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
