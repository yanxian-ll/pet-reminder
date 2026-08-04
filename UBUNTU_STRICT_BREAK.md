# Ubuntu strict break mode

Version 0.1.2 keeps the desktop-pet break page visible and blocks normal keyboard and pointer input for the duration of the break.

## Required session

Strict input blocking requires an Xorg desktop session. Ubuntu Wayland does not allow an ordinary application to reliably intercept compositor-level shortcuts or input belonging to other native Wayland applications.

Check the current session:

```bash
echo "$XDG_SESSION_TYPE"
```

The result must be:

```text
x11
```

If it prints `wayland`:

1. Sign out of Ubuntu.
2. Select your user on the login screen.
3. Click the gear icon in the lower-right corner.
4. Choose **Ubuntu on Xorg**.
5. Sign in again.

## Behavior

When a break starts, the app expands the existing break page across all monitors, keeps it on top, and acquires the Xorg keyboard and pointer grabs. Normal clicks, typing, Alt+Tab, workspace switching, and desktop interaction are swallowed until the countdown ends.

When the countdown reaches zero, the app releases the keyboard and pointer and returns to the companion window automatically.

The implementation does not disable `/dev/input` devices and does not install a privileged helper. If the application process exits unexpectedly, the X server releases the grabs automatically.
