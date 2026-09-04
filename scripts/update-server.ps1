# Upload E-Library code to Linux server, build frontend, restart pm2
# Run from Windows PowerShell (project root or any folder):
#   cd E:\LMS\Library_Management_System\library_Management_System
#   .\scripts\update-server.ps1
#
# Options:
#   .\scripts\update-server.ps1                 # code + npm install + client:build + pm2 restart
#   .\scripts\update-server.ps1 -SkipNpm        # faster if deps unchanged
#   .\scripts\update-server.ps1 -SkipBuild      # backend-only change
#   .\scripts\update-server.ps1 -UploadEnv      # also overwrite remote .env (careful)
#
# Production .env on server should include:
#   NODE_ENV=production
#   CORS_ORIGINS=http://YOUR_IP:3000
#   JWT_SECRET=<64+ char random>
#   HOST=127.0.0.1  (or 0.0.0.0 for direct LAN; prefer nginx + HTTPS)

param(
    [string]$Server = 'admin2026@192.168.11.20',
    [string]$RemoteDir = '/var/www/elibrary/library_Management_System',
    [string]$Pm2Name = 'elibrary',
    [switch]$SkipNpm,
    [switch]$SkipBuild,
    [switch]$UploadEnv
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command scp -ErrorAction SilentlyContinue) -or -not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: OpenSSH Client required (scp/ssh).' -ForegroundColor Red
    Write-Host 'Windows Settings -> Apps -> Optional features -> OpenSSH Client' -ForegroundColor Yellow
    exit 1
}
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: tar not found (built into modern Windows).' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $ProjectRoot 'server.js'))) {
    Write-Host "ERROR: server.js not found under $ProjectRoot" -ForegroundColor Red
    exit 1
}

Write-Host 'E-Library server update' -ForegroundColor Cyan
Write-Host "  Local:  $ProjectRoot" -ForegroundColor Gray
Write-Host "  Remote: ${Server}:$RemoteDir" -ForegroundColor Gray
Write-Host "  npm:    $(-not $SkipNpm)  build: $(-not $SkipBuild)  .env: $UploadEnv" -ForegroundColor Gray
Write-Host ''

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tarLocal = Join-Path $env:TEMP "elibrary-update-$stamp.tgz"
$tarRemote = "/tmp/elibrary-update-$stamp.tgz"

# Pack code only — never uploads (~54GB) or node_modules
$excludeArgs = @(
    '--exclude=node_modules',
    '--exclude=public/uploads',
    '--exclude=.git',
    '--exclude=dist',
    '--exclude=*.tar.gz',
    '--exclude=library_Management_System.tar.gz',
    '--exclude=tsconfig.tsbuildinfo',
    '--exclude=tsconfig.node.tsbuildinfo',
    '--exclude=*.sql'
)
if (-not $UploadEnv) {
    $excludeArgs += '--exclude=.env'
}

Write-Host 'Packing project (no node_modules / uploads)...' -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    & tar -czf $tarLocal @excludeArgs .
    if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$sizeMb = [math]::Round((Get-Item $tarLocal).Length / 1MB, 1)
Write-Host "  archive: $tarLocal ($sizeMb MB)" -ForegroundColor Gray

Write-Host 'Uploading archive (enter SSH password if prompted)...' -ForegroundColor Cyan
& scp $tarLocal "${Server}:${tarRemote}"
if ($LASTEXITCODE -ne 0) {
    Remove-Item $tarLocal -Force -ErrorAction SilentlyContinue
    throw "scp failed (exit $LASTEXITCODE)"
}

$fixPermsHelper = @'
ensure_writable_dir() {
  local p="$1"
  [ -d "$p" ] || return 0
  if find "$p" ! -writable 2>/dev/null | grep -q .; then
    echo "[fix] $p has root-owned files — sudo chown to $(whoami)"
    sudo chown -R "$(whoami):$(whoami)" "$p"
    return 0
  fi
  if touch "$p/.write-test" 2>/dev/null; then
    rm -f "$p/.write-test"
    return 0
  fi
  echo "[fix] $p not writable — sudo chown to $(whoami)"
  sudo chown -R "$(whoami):$(whoami)" "$p"
  rm -f "$p/.write-test" 2>/dev/null || true
}

remove_dir() {
  local p="$1"
  [ -d "$p" ] || return 0
  if rm -rf "$p" 2>/dev/null; then
    return 0
  fi
  echo "[fix] cannot remove $p — sudo rm -rf"
  sudo rm -rf "$p"
}
'@

$npmBlock = if ($SkipNpm) {
    'echo "[skip] npm install"'
} else {
    @'
echo "[npm] install"
ensure_writable_dir node_modules

if ! npm install; then
  echo "[fix] npm install failed — removing node_modules and retrying" >&2
  sudo rm -rf node_modules
  npm install
fi
'@
}
$buildBlock = if ($SkipBuild) {
    'echo "[skip] client:build"'
} else {
    @'
echo "[build] client"
# dist is regenerated each build; wipe it so root-owned assets do not block vite
remove_dir dist
npm run client:build
'@
}

# Remote apply: extract over existing tree, keep uploads + .env (unless uploaded)
$remoteScript = @"
set -euo pipefail
REMOTE_DIR='$RemoteDir'
TAR='$tarRemote'
PM2_NAME='$Pm2Name'

if [ ! -d "`$REMOTE_DIR" ]; then
  echo "ERROR: `$REMOTE_DIR missing" >&2
  exit 1
fi

cd "`$REMOTE_DIR"
echo "[extract] `$TAR -> `$REMOTE_DIR"
tar -xzf "`$TAR" -C "`$REMOTE_DIR"
rm -f "`$TAR"

if [ -f .env ]; then
  sed -i 's/\r$//' .env
fi

$fixPermsHelper
$npmBlock
$buildBlock

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "`$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "`$PM2_NAME"
  else
    pm2 start server.js --name "`$PM2_NAME"
  fi
  pm2 save || true
  echo ''
  echo '=== pm2 ==='
  pm2 list
  echo ''
  echo '=== health ==='
  curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/ || true
else
  echo '[WARN] pm2 not found — start manually: node server.js'
fi

echo ''
echo '[OK] Updated. Open: http://192.168.11.20:3000'
"@

$lf = $remoteScript -replace "`r`n", "`n" -replace "`r", "`n"
$tmpSh = Join-Path $env:TEMP ("elibrary-apply-{0}.sh" -f [guid]::NewGuid().ToString('n'))
$remoteSh = '/tmp/elibrary-apply.sh'

try {
    [IO.File]::WriteAllText($tmpSh, $lf, (New-Object System.Text.UTF8Encoding $false))
    Write-Host 'Applying on server...' -ForegroundColor Cyan
    & scp $tmpSh "${Server}:${remoteSh}"
    if ($LASTEXITCODE -ne 0) { throw "scp apply script failed (exit $LASTEXITCODE)" }
    & ssh -t $Server "bash $remoteSh; ec=`$?; rm -f $remoteSh; exit `$ec"
    $remoteExit = $LASTEXITCODE
    if ($remoteExit -ne 0) { throw "remote apply failed (exit $remoteExit)" }
} finally {
    Remove-Item $tmpSh -Force -ErrorAction SilentlyContinue
    Remove-Item $tarLocal -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '[OK] Server updated: http://192.168.11.20:3000' -ForegroundColor Green
Write-Host 'Browser: Ctrl+Shift+R hard refresh' -ForegroundColor Gray
