#!/bin/bash
set -euo pipefail
echo '=== killing root node on elibrary ==='
ROOT_PID=$(ps aux | awk '/[n]ode \/var\/www\/elibrary\/server\.js/ {print $2}')
echo "root node pid(s): ${ROOT_PID:-none}"
if [ -n "${ROOT_PID:-}" ]; then
  sudo kill $ROOT_PID || true
  sleep 2
  sudo kill -9 $ROOT_PID 2>/dev/null || true
fi
sudo fuser -k 3000/tcp 2>/dev/null || true
sleep 1
echo '=== port after kill ==='
ss -lptn 'sport = :3000' || echo 'free'
ps aux | grep -E '[n]ode /var/www/elibrary' || echo 'no leftover node'

echo '=== recreate pm2 app ==='
pm2 delete elibrary 2>/dev/null || true
cd /var/www/elibrary
pm2 start server.js --name elibrary
pm2 save
sleep 3
pm2 status
echo '=== who owns 3000 now ==='
ss -lptn 'sport = :3000'
ps aux | grep -E '[n]ode /var/www/elibrary' || true
echo '=== health ==='
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
echo '=== counts via node ==='
node scripts/_tmp-check-prod-content-type.js
