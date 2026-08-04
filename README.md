# Pet Reminder

A desktop pet rest reminder for Windows and Ubuntu, built with Tauri 2, React, TypeScript, and Vite.

During work time, the app keeps one small desktop pet on screen. During break time, it switches to a full-screen pet overlay and reminds you to leave the screen.

## Features

- Transparent, always-on-top desktop pet window.
- Work mode: one desktop pet with a countdown to the next break.
- Break mode: full-screen pet overlay with a translucent reminder card.
- Default schedule: 20 minutes of work, then 2 minutes of rest.
- Default break pet count: 60 pets.
- Break reminder sound and native desktop notification.
- Break controls only allow extending rest by 1 minute or 5 minutes; the overlay returns to work automatically when the countdown finishes.
- Optional auto-start on desktop login.
- System tray menu: start break now, pause or resume, enable temporary do-not-disturb, settings, and quit.
- Natural-rest detection on Windows and Ubuntu. Ubuntu uses GNOME's idle monitor first and falls back to `xprintidle`.

## Supported Platforms

- Windows 10/11, x86-64.
- Ubuntu 22.04 and Ubuntu 24.04, x86-64.

## Ubuntu: Install Development Dependencies

Install the packages required by Tauri 2 and WebKitGTK:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

On non-GNOME X11 desktops, install the optional idle-time fallback:

```bash
sudo apt install -y xprintidle
```

Install Node.js 22 or another supported LTS version, then install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

Verify the toolchain:

```bash
node -v
npm -v
rustc -V
cargo -V
```

## Ubuntu: Clone and Run

```bash
git clone https://github.com/yanxian-ll/pet-reminder.git
cd pet-reminder
npm install
npm run tauri:dev
```

### Wayland Compatibility

Ubuntu normally starts a Wayland session. Desktop environments restrict arbitrary window positioning under native Wayland, so the app automatically selects XWayland when both `WAYLAND_DISPLAY` and `DISPLAY` are available. This preserves desktop-pet positioning, transparency, and always-on-top behavior.

To test the native Wayland backend instead, explicitly override it:

```bash
GDK_BACKEND=wayland npm run tauri:dev
```

Native Wayland may ignore the requested desktop position or always-on-top state, depending on the compositor.

## Ubuntu: Build Installers

Build a Debian package and an AppImage:

```bash
npm ci
npm run tauri:build -- --bundles deb,appimage
```

Build output is created under:

```text
src-tauri/target/release/bundle/deb/
src-tauri/target/release/bundle/appimage/
```

Install the Debian package:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Or run the AppImage:

```bash
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
./src-tauri/target/release/bundle/appimage/*.AppImage
```

The `Build Ubuntu packages` GitHub Actions workflow also produces downloadable `.deb` and `.AppImage` artifacts. Pushing a tag such as `v0.1.0` publishes the Ubuntu packages to a GitHub Release.

## Windows: Requirements

Run commands in PowerShell.

### 1. Install Git

```powershell
winget install --id Git.Git -e
```

### 2. Install Node.js and npm

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

### 3. Install Rust, rustc, and cargo

```powershell
winget install --id Rustlang.Rustup -e
rustup default stable-msvc
rustup update
```

### 4. Install Microsoft C++ Build Tools

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

If necessary, open the Visual Studio Build Tools installer and select `Desktop development with C++`.

### 5. Install Microsoft Edge WebView2 Runtime

Most Windows 10/11 systems already include it. To install or repair it manually:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e
```

## Windows: Clone and Run

```powershell
git clone https://github.com/yanxian-ll/pet-reminder.git
cd pet-reminder
npm install
npm run tauri:dev
```

## Windows: Build Installers

```powershell
npm run tauri:build
```

Look for installers in:

```text
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

## Updating an Existing Local Copy

If you have no local changes:

```bash
git pull
npm install
npm run tauri:dev
```

To discard local changes and return to the latest `main` branch:

```bash
git fetch origin
git reset --hard origin/main
npm install
npm run tauri:dev
```

## Troubleshooting

### Ubuntu tray icon does not appear

Make sure `libayatana-appindicator3-1` is installed and that the desktop environment supports AppIndicator tray icons. GNOME installations may require the AppIndicator/KStatusNotifierItem extension.

### Ubuntu app starts but the pet cannot be positioned

Confirm that XWayland is available and that `DISPLAY` is set:

```bash
echo "$XDG_SESSION_TYPE"
echo "$DISPLAY"
```

Do not set `GDK_BACKEND=wayland` when you need exact desktop positioning.

### Ubuntu natural-rest detection always reports zero

On GNOME, verify that `gdbus` is available. On another X11 desktop, install `xprintidle`:

```bash
sudo apt install -y libglib2.0-bin xprintidle
```

### Windows build fails with C++ or linker errors

Install or repair Microsoft C++ Build Tools and make sure the `Desktop development with C++` workload is selected.

### The app does not show a sound notification

Some audio devices or privacy settings can block browser audio until the app has received user interaction. Click the app once, then trigger a break again.

## Safety Notes

The break overlay intentionally does not expose a shortcut, immediate-end button, or postpone action. It returns to work only after the configured countdown completes. The system tray still retains the application quit command as an emergency escape hatch.
