# 🐾 桌宠提醒休息 / Pet Reminder

一个用 **Tauri 2 + React 19 + TypeScript + Vite** 构建的桌面休息提醒应用。

工作时，一只小桌宠陪在屏幕边缘并显示下一次休息倒计时；休息时，应用切换为全屏桌宠覆盖层，提醒你离开屏幕、活动身体、看看远处。

> 当前版本：**v0.2.0**

[![Release](https://img.shields.io/github/v/release/yanxian-ll/pet-reminder)](https://github.com/yanxian-ll/pet-reminder/releases/latest)
[![License](https://img.shields.io/github/license/yanxian-ll/pet-reminder)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

## 下载

推荐直接从 GitHub Releases 安装：

👉 **[下载最新版本](https://github.com/yanxian-ll/pet-reminder/releases/latest)**

v0.2.0 提供：

- **Windows x64**：`deskpet-rest-reminder_windows_x64.exe`
- **macOS Apple Silicon**：`deskpet-rest-reminder_aarch64.dmg`
- **macOS Intel**：`deskpet-rest-reminder_x64.dmg`

> Windows 是主要开发与完整功能平台。macOS 可构建与使用主要提醒功能，但“检测系统空闲时间并自动重置专注计时”目前仅在 Windows 实现。

## ✨ 功能

- 🐶 **桌面陪伴模式**
  - 透明、置顶、小尺寸桌宠窗口
  - 显示当前状态与下一次休息倒计时
  - 可拖动、隐藏与重新显示

- 🌿 **强制休息模式**
  - 到点自动切换为全屏休息覆盖层
  - 默认显示大量随机桌宠
  - 播放休息提示音并发送系统通知
  - 休息时间结束后自动恢复工作模式
  - 休息期间仅支持延长 1 分钟或 5 分钟

- ⏰ **专注与休息节奏**
  - 默认：工作 20 分钟 / 休息 2 分钟
  - 支持自定义专注时长与休息时长
  - 支持指定工作日与工作时间段
  - 非工作时间自动隐藏桌宠

- 📅 **事件提醒**
  - 可添加最多 12 个每日事件提醒
  - 支持启用 / 禁用、编辑时间与标题
  - 事件提醒可稍后 10 分钟再次提醒
  - 勿扰或休息期间触发的提醒会排队处理

- 💤 **自然休息检测**
  - Windows 下可检测系统空闲时间
  - 默认离开电脑 3 分钟后视为已自然休息
  - 自动重新开始专注计时

- 🔕 **勿扰与暂停**
  - 一键勿扰 30 分钟
  - 支持暂停 / 恢复当前专注计时
  - 可从桌宠面板或系统托盘操作

- ⚙️ **独立设置窗口**
  - 工作日与工作时间
  - 专注 / 休息时长
  - 休息桌宠数量
  - 严格休息覆盖层
  - 系统通知
  - 空闲检测
  - 开机自启动
  - 事件提醒
  - 配置导入 / 导出

- 🧰 **系统托盘**
  - 立即休息
  - 暂停 / 继续
  - 勿扰 30 分钟
  - 再休息 1 分钟
  - 显示桌宠
  - 设置
  - 退出

## 默认设置

| 设置 | 默认值 |
| --- | --- |
| 工作日 | 周一至周五 |
| 工作时间 | 09:00–18:00 |
| 专注时长 | 20 分钟 |
| 休息时长 | 2 分钟 |
| 休息桌宠数量 | 60 |
| 严格休息覆盖 | 开启 |
| 系统通知 | 开启 |
| 空闲检测 | 开启 |
| 自然休息阈值 | 3 分钟 |
| 开机自启动 | 关闭 |

## 技术栈

- [Tauri 2](https://v2.tauri.app/)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite 7](https://vite.dev/)
- Rust
- Tauri Autostart Plugin
- Tauri Notification Plugin
- Windows `GetLastInputInfo` 空闲时间检测

## 本地开发

### 1. 准备环境

需要：

- Git
- Node.js 22 / LTS
- Rust stable
- Tauri 对应平台的系统依赖

Windows 还需要：

- Microsoft Visual C++ Build Tools
- Microsoft Edge WebView2 Runtime

可参考 Tauri 官方 prerequisites：

https://v2.tauri.app/start/prerequisites/

### 2. 克隆并启动

```bash
git clone https://github.com/yanxian-ll/pet-reminder.git
cd pet-reminder
npm install
npm run tauri:dev
```

只运行前端：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

前端生产构建：

```bash
npm run build
```

## 构建桌面应用

### Windows

```powershell
npm ci
npm run tauri:build -- --bundles nsis
```

安装包通常位于：

```text
src-tauri\target\release\bundle\nsis\
```

### macOS

```bash
npm ci
npm run tauri:build -- --bundles app,dmg
```

也可以在 GitHub Actions 中手动运行 **Build macOS** 工作流，分别生成 Apple Silicon 与 Intel 构建。

## 发布

仓库已经配置 GitHub Actions 自动发布流程。

推送 `v*` 标签，例如：

```bash
git tag v0.2.1
git push origin v0.2.1
```

Release workflow 会自动构建：

- Windows x64 NSIS 安装包
- macOS Apple Silicon DMG
- macOS Intel DMG

并创建对应的 GitHub Release。

## 更新本地代码

没有本地修改时：

```bash
git pull
npm install
npm run tauri:dev
```

如果确认要丢弃本地修改并与 `main` 保持一致：

```bash
git fetch origin
git reset --hard origin/main
npm install
npm run tauri:dev
```

## 常见问题

### Windows 下 `rustc` 或 `cargo` 找不到

重新打开终端；如果仍不可用，确认以下目录已加入用户 `Path`：

```text
%USERPROFILE%\.cargo\bin
```

### Windows 构建出现 C++ / linker 错误

安装 Visual Studio Build Tools，并确保包含：

```text
Desktop development with C++
```

### Windows 无法启动 WebView

安装或修复 Microsoft Edge WebView2 Runtime。

### 没有播放提示音

部分系统或音频环境可能会限制 WebView 音频。可以先与应用窗口交互一次，再手动触发“立即休息”测试。

### macOS 提示应用无法验证

当前发布包未配置 Apple Developer 签名与 notarization。macOS 可能显示安全提示，需要在系统设置中手动允许打开。

## 关于严格休息模式

休息覆盖层的设计目标是减少“顺手跳过休息”的诱惑，因此不会提供立即结束休息或延后本次休息的按钮。

如果确实需要紧急退出，可以通过系统托盘选择 **退出**。

## 项目结构

```text
pet-reminder/
├─ src/
│  ├─ App.tsx                 # 主桌宠 / 休息流程
│  ├─ SettingsApp.tsx         # 设置窗口
│  ├─ reminderScheduler.ts    # 事件提醒调度
│  ├─ settings.ts             # 设置持久化与默认配置
│  ├─ windowController.ts     # 窗口显示状态控制
│  └─ components/
├─ src-tauri/
│  ├─ src/lib.rs              # 托盘、通知、空闲检测等原生能力
│  └─ tauri.conf.json
├─ .github/workflows/         # CI / Windows / macOS / Release
└─ package.json
```

## License

[MIT](LICENSE)

---

如果这个小工具能让你少盯一会儿屏幕、多活动几分钟，欢迎 ⭐ Star。
