#!/bin/bash
set -euo pipefail
echo '=== who holds :3000 ==='
ss -lptn 'sport = :3000' || true
fuser -v 3000/tcp 2>&1 || true
echo '=== stop pm2 app ==='
pm2 stop elibrary || true
pm2 delete elibrary || true
sleep 1
echo '=== kill leftover listeners on 3000 ==='
# Prefer graceful; then force
PIDS=$(ss -lptn 'sport = :3000' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)
if [ -n "${PIDS:-}" ]; then
  echo "killing pids: $PIDS"
  kill $PIDS 2>/dev/null || true
  sleep 1
  kill -9 $PIDS 2>/dev/null || true
fi
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
echo '=== port after cleanup ==='
ss -lptn 'sport = :3000' || echo 'port free'
echo '=== start elibrary ==='
cd /var/www/elibrary
pm2 start server.js --name elibrary
pm2 save || true
sleep 2
pm2 status
echo '=== health ==='
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w 'API %{http_code}\n' 'http://127.0.0.1:3000/api/ebooks?paged=true&limit=1' || true
