# Pet Reminder

A Windows desktop pet rest reminder MVP.

During work time, the app keeps one small desktop pet on screen. During break time, it switches to a full-screen break mode with many pets so you are strongly reminded to leave the screen and rest.

## Features

- Transparent always-on-top desktop pet window for Windows.
- Work mode: one draggable pet and a countdown to the next break.
- Break mode: full-screen overlay with many animated pets.
- Configurable focus minutes, break minutes, workdays, work hours, and break pet count.
- Optional auto-start on system login.
- System tray actions: start break now, return to work, pause or resume reminders, open settings, and quit.
- Safe exit: press `Esc` or click "Back to work" during break mode.

## Tech Stack

- Tauri v2
- React
- TypeScript
- Vite
- Tauri Autostart Plugin
- Tauri System Tray

## Windows Setup

This project is a Tauri desktop app, so you need Node.js/npm for the frontend and Rust/rustc/cargo for the Tauri backend.

Run all commands in **PowerShell**.

### 1. Install Node.js and npm

Recommended command-line install:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Close and reopen PowerShell, then verify:

```powershell
node -v
npm -v
```

If `winget` is unavailable, install the LTS version from:

```text
https://nodejs.org/en/download
```

### 2. Install Rust, rustc, and cargo

Install Rust through rustup:

```powershell
winget install --id Rustlang.Rustup -e
```

Close and reopen PowerShell, then set the MSVC Rust toolchain as the default:

```powershell
rustup default stable-msvc
rustup update
```

Verify that `rustc` and `cargo` are installed:

```powershell
rustc -V
cargo -V
rustup -V
```

If PowerShell cannot find `rustc` or `cargo`, restart PowerShell or restart Windows. Rust normally installs the tools under:

```text
%USERPROFILE%\.cargo\bin
```

If needed, add this path to your user `Path` environment variable.

### 3. Install Microsoft C++ Build Tools

Tauri on Windows requires Microsoft C++ Build Tools.

Command-line install:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

If the command-line install does not add the C++ workload correctly, open the Visual Studio Build Tools installer and select:

```text
Desktop development with C++
```

Then restart PowerShell.

### 4. Install Microsoft Edge WebView2 Runtime

Most modern Windows 10/11 systems already include WebView2 Runtime. You can still install or repair it with:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e
```

### 5. Verify the full development environment

Run:

```powershell
node -v
npm -v
rustc -V
cargo -V
rustup -V
```

You should see version numbers for all commands.

## Clone the Repository

```powershell
git clone https://github.com/yanxian-ll/pet-reminder.git
cd pet-reminder
```

If Git is not installed:

```powershell
winget install --id Git.Git -e
```

Then close and reopen PowerShell and run the clone command again.

## Install Project Dependencies

```powershell
npm install
```

## Run in Development Mode

```powershell
npm run tauri:dev
```

Expected behavior:

- A small transparent pet window appears.
- Work mode shows one pet.
- Break mode shows many pets in a full-screen overlay.
- You can press `Esc` during break mode to return to work mode.

## Build a Windows Installer

```powershell
npm run tauri:build
```

The build output is usually generated under:

```text
src-tauri\target\release\bundle\
```

Look for installers under folders such as:

```text
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

## Common Issues

### `rustc` or `cargo` is not recognized

Restart PowerShell first. If it still fails, make sure this path exists and is in your user `Path`:

```text
%USERPROFILE%\.cargo\bin
```

### Tauri build fails with C++ or linker errors

Install or repair Microsoft C++ Build Tools and make sure the `Desktop development with C++` workload is selected.

### Vite port is already in use

This project uses port `1420` during development. Check whether another process is using it:

```powershell
netstat -ano | findstr :1420
```

Stop that process or change the Vite/Tauri dev port configuration.

### WebView2 errors

Install or repair WebView2 Runtime:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e
```

## Safety Notes

This project intentionally keeps visible exit controls. It does not lock the keyboard or mouse, hide the process, or prevent the user from leaving break mode. The goal is to strongly remind you to rest, not to create an unescapable screen lock.

## Future Ideas

- Multi-monitor break overlays.
- More pet skins.
- Live2D or Spine animation support.
- Global hotkeys.
- Sound effects or voice reminders.
- Rest statistics and daily focus reports.
- A stricter "snooze penalty" mode, such as doubling the pet count after delaying a break.
