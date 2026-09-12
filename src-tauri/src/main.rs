#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn prefer_x11_for_desktop_pet() {
    let running_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    let xwayland_available = std::env::var_os("DISPLAY").is_some();
    let backend_overridden = std::env::var_os("GDK_BACKEND").is_some();

    if running_wayland && xwayland_available && !backend_overridden {
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    prefer_x11_for_desktop_pet();

    deskpet_rest_reminder_lib::run();
}
