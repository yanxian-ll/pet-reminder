# 在项目根目录执行：
# powershell -ExecutionPolicy Bypass -File .\create-public-repo.ps1

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "未检测到 GitHub CLI: gh" -ForegroundColor Yellow
  Write-Host "请先安装 GitHub CLI，或在 GitHub 网页新建公开仓库后按 README 推送。"
  exit 1
}

if (-not (Test-Path .git)) {
  git init
  git add .
  git commit -m "Initial desk pet rest reminder MVP"
}

gh repo create yanxian-ll/deskpet-rest-reminder --public --source=. --remote=origin --push
