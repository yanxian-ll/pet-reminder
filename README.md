# Pet Reminder

A Windows desktop pet rest reminder built with Tauri, React, TypeScript, and Vite.

During work time, the app keeps one small desktop pet on screen. During break time, it switches to a full-screen pet overlay and reminds you to leave the screen.

## Features

- Windows transparent always-on-top desktop pet window.
- Work mode: one desktop pet with a countdown to the next break.
- Break mode: full-screen pet overlay with a translucent reminder card.
- Default schedule: 20 minutes of work, then 2 minutes of rest.
- Default break pet count: 60 pets.
- Break reminder sound when rest starts.
- Break controls only allow extending rest by 1 minute or 5 minutes; the overlay returns to work automatically when the countdown finishes.
- Optional auto-start on Windows login.
- System tray menu: start break now, pause or resume, enable temporary do-not-disturb, settings, and quit.

## Requirements

Run commands in PowerShell.

### 1. Install Git

```powershell
winget install --id Git.Git -e
```

Close and reopen PowerShell, then verify:

```powershell
git --version
```

### 2. Install Node.js and npm

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Close and reopen PowerShell, then verify:

```powershell
node -v
npm -v
```

### 3. Install Rust, rustc, and cargo

```powershell
winget install --id Rustlang.Rustup -e
```

Close and reopen PowerShell, then run:

```powershell
rustup default stable-msvc
rustup update
```

Verify:

```powershell
rustc -V
cargo -V
rustup -V
```

If `rustc` or `cargo` is not recognized, restart PowerShell or restart Windows. Rust is normally installed under:

```text
%USERPROFILE%\.cargo\bin
```

### 4. Install Microsoft C++ Build Tools

Tauri on Windows needs the Microsoft C++ toolchain.

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

If the command does not install the C++ workload correctly, open the Visual Studio Build Tools installer and select:

```text
Desktop development with C++
```

Then restart PowerShell.

### 5. Install Microsoft Edge WebView2 Runtime

Most Windows 10/11 systems already include it. To install or repair it manually:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e
```

## Clone and Run

```powershell
git clone https://github.com/yanxian-ll/pet-reminder.git
cd pet-reminder
npm install
npm run tauri:dev
```

## Build a Windows Installer

```powershell
npm run tauri:build -- --no-bundle
```

Build output is usually created under:

```text
src-tauri\target\release\bundle\
```

Look for installers in:

```text
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

## Updating an Existing Local Copy

If you have no local changes:

```powershell
git pull
npm install
npm run tauri:dev
```

If Git says local files would be overwritten and you want to discard local changes:

```powershell
git fetch origin
git reset --hard origin/main
npm install
npm run tauri:dev
```

## Troubleshooting

### `rustc` or `cargo` is not recognized

Restart PowerShell first. If it still fails, add this path to your user `Path`:

```text
%USERPROFILE%\.cargo\bin
```

### Build fails with C++ or linker errors

Install or repair Microsoft C++ Build Tools and make sure the `Desktop development with C++` workload is selected.

### The app does not show a sound notification

Some Windows audio devices or privacy settings can block browser audio until the app has received user interaction. Click the app once, then trigger a break again.

## Safety Notes

The break overlay intentionally does not expose a shortcut, immediate-end button, or postpone action. It returns to work only after the configured countdown completes. The system tray still retains the application quit command as an emergency escape hatch.
