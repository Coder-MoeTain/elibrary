#!/bin/bash
set -euo pipefail
echo '=== before ==='
ps aux | grep -E '[n]ode /var/www/elibrary' || true
sudo pm2 list || true
echo '=== restart root pm2 app ==='
if sudo pm2 describe elibrary >/dev/null 2>&1; then
  sudo pm2 restart elibrary --update-env
else
  cd /var/www/elibrary
  sudo pm2 start server.js --name elibrary
fi
sudo pm2 save || true
# Stop conflicting user-level pm2 copy if present
pm2 delete elibrary 2>/dev/null || true
sleep 2
echo '=== after ==='
sudo pm2 list
ps aux | grep -E '[n]ode /var/www/elibrary' || true
ss -lptn 'sport = :3000' || true
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
