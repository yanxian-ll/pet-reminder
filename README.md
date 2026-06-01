# 桌宠提醒休息

Windows 桌宠休息提醒 MVP：工作时段只保留一个桌宠陪伴；休息时段切换为满屏桌宠，强提醒你离开屏幕休息。

## 功能

- Windows 桌面透明置顶桌宠窗口
- 工作时段：一个可拖动桌宠，显示下次休息倒计时
- 休息时段：全屏透明遮罩 + 多个桌宠占满屏幕
- 支持专注/休息时长、工作日、工作时间、桌宠数量配置
- 支持开机自动启动开关
- 支持系统托盘菜单：立即休息、回到工作、暂停/恢复、设置、退出
- 安全退出：休息模式下可按 `Esc` 或点击“回到工作”

## 技术栈

- Tauri v2
- React + TypeScript + Vite
- Tauri Autostart Plugin
- Tauri System Tray

## 本地开发

### Windows 前置依赖

你需要先安装：

1. Node.js LTS
2. Rust stable
3. Microsoft C++ Build Tools / Visual Studio Build Tools
4. Microsoft Edge WebView2 Runtime

### 安装依赖

```bash
npm install
```

### 运行开发版

```bash
npm run tauri:dev
```

### 构建 Windows 安装包

```bash
npm run tauri:build
```

构建产物通常在：

```text
src-tauri/target/release/bundle/
```

## 推荐的 GitHub 建仓命令

当前 ChatGPT 的 GitHub 连接器可以读写已有仓库文件，但没有暴露“新建仓库”接口。你可以在本项目目录下运行下面命令创建公开仓库并推送：

```bash
gh repo create yanxian-ll/deskpet-rest-reminder --public --source=. --remote=origin --push
```

没有安装 GitHub CLI 的话，可以先在 GitHub 网页新建公开仓库 `deskpet-rest-reminder`，然后运行：

```bash
git init
git add .
git commit -m "Initial desk pet rest reminder MVP"
git branch -M main
git remote add origin https://github.com/yanxian-ll/deskpet-rest-reminder.git
git push -u origin main
```

## 安全边界

这个项目刻意保留了“回到工作”和 `Esc` 退出能力，不会锁死鼠标、键盘或隐藏退出入口。它的目标是强提醒休息，而不是做无法退出的屏幕锁定程序。

## 后续可以继续做

- 多显示器全屏覆盖
- 更多桌宠皮肤和 Live2D/Spine 动画
- 休息统计和连续工作日报
- 全局快捷键
- 音效和语音提醒
- 自定义“延后休息”的惩罚规则，例如桌宠数量翻倍
