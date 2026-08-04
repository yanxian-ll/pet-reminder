#[cfg(target_os = "linux")]
mod platform {
    use std::{
        env,
        mem::MaybeUninit,
        ptr,
        sync::{
            mpsc::{self, Receiver, RecvTimeoutError, Sender},
            OnceLock,
        },
        thread,
        time::Duration,
    };
    use x11::xlib;

    enum Command {
        SetEnabled {
            enabled: bool,
            reply: Sender<Result<(), String>>,
        },
    }

    static COMMANDS: OnceLock<Sender<Command>> = OnceLock::new();

    struct ActiveGrab {
        display: *mut xlib::Display,
        root: xlib::Window,
    }

    impl ActiveGrab {
        unsafe fn acquire() -> Result<Self, String> {
            let display = xlib::XOpenDisplay(ptr::null());
            if display.is_null() {
                return Err("无法连接 X11 显示服务。请确认当前登录会话是 Ubuntu on Xorg。".to_string());
            }

            let root = xlib::XDefaultRootWindow(display);
            let keyboard_status = xlib::XGrabKeyboard(
                display,
                root,
                xlib::False,
                xlib::GrabModeAsync,
                xlib::GrabModeAsync,
                xlib::CurrentTime,
            );
            if keyboard_status != xlib::GrabSuccess {
                xlib::XCloseDisplay(display);
                return Err(format!("无法锁定键盘，XGrabKeyboard 返回状态 {keyboard_status}"));
            }

            let pointer_status = xlib::XGrabPointer(
                display,
                root,
                xlib::False,
                0,
                xlib::GrabModeAsync,
                xlib::GrabModeAsync,
                0,
                0,
                xlib::CurrentTime,
            );
            if pointer_status != xlib::GrabSuccess {
                xlib::XUngrabKeyboard(display, xlib::CurrentTime);
                xlib::XFlush(display);
                xlib::XCloseDisplay(display);
                return Err(format!("无法锁定鼠标，XGrabPointer 返回状态 {pointer_status}"));
            }

            xlib::XFlush(display);
            Ok(Self { display, root })
        }

        unsafe fn refresh(&mut self) {
            let _ = xlib::XGrabKeyboard(
                self.display,
                self.root,
                xlib::False,
                xlib::GrabModeAsync,
                xlib::GrabModeAsync,
                xlib::CurrentTime,
            );
            let _ = xlib::XGrabPointer(
                self.display,
                self.root,
                xlib::False,
                0,
                xlib::GrabModeAsync,
                xlib::GrabModeAsync,
                0,
                0,
                xlib::CurrentTime,
            );
            xlib::XFlush(self.display);
            self.drain_events();
        }

        unsafe fn drain_events(&mut self) {
            while xlib::XPending(self.display) > 0 {
                let mut event = MaybeUninit::<xlib::XEvent>::uninit();
                xlib::XNextEvent(self.display, event.as_mut_ptr());
            }
        }

        unsafe fn release(&mut self) {
            xlib::XUngrabPointer(self.display, xlib::CurrentTime);
            xlib::XUngrabKeyboard(self.display, xlib::CurrentTime);
            xlib::XFlush(self.display);
        }
    }

    impl Drop for ActiveGrab {
        fn drop(&mut self) {
            unsafe {
                self.release();
                xlib::XCloseDisplay(self.display);
            }
        }
    }

    fn worker(receiver: Receiver<Command>) {
        let mut active_grab: Option<ActiveGrab> = None;

        loop {
            match receiver.recv_timeout(Duration::from_millis(200)) {
                Ok(Command::SetEnabled { enabled, reply }) => {
                    let result = if enabled {
                        if active_grab.is_some() {
                            Ok(())
                        } else {
                            unsafe { ActiveGrab::acquire() }.map(|grab| {
                                active_grab = Some(grab);
                            })
                        }
                    } else {
                        active_grab.take();
                        Ok(())
                    };
                    let _ = reply.send(result);
                }
                Err(RecvTimeoutError::Timeout) => {
                    if let Some(grab) = active_grab.as_mut() {
                        unsafe { grab.refresh() };
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    }

    pub fn set_enabled(enabled: bool) -> Result<(), String> {
        if enabled {
            let session_type = env::var("XDG_SESSION_TYPE").unwrap_or_default();
            if !session_type.eq_ignore_ascii_case("x11") {
                return Err(
                    "严格休息输入锁需要 Ubuntu on Xorg 会话。请注销，在登录界面的齿轮菜单中选择“Ubuntu on Xorg”，然后重新登录。"
                        .to_string(),
                );
            }
        }

        let sender = COMMANDS
            .get_or_init(|| {
                let (sender, receiver) = mpsc::channel();
                thread::Builder::new()
                    .name("strict-break-input-lock".to_string())
                    .spawn(move || worker(receiver))
                    .expect("failed to start strict break input lock thread");
                sender
            })
            .clone();

        let (reply_sender, reply_receiver) = mpsc::channel();
        sender
            .send(Command::SetEnabled {
                enabled,
                reply: reply_sender,
            })
            .map_err(|_| "严格休息输入锁线程不可用".to_string())?;

        reply_receiver
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "严格休息输入锁响应超时".to_string())?
    }
}

#[cfg(target_os = "linux")]
pub use platform::set_enabled;

#[cfg(not(target_os = "linux"))]
pub fn set_enabled(_enabled: bool) -> Result<(), String> {
    Ok(())
}
