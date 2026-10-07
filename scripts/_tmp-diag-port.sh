#!/bin/bash
set -euo pipefail
echo '=== pm2 ==='
pm2 status
echo '=== port holders ==='
ss -lptn 'sport = :3000'
echo '=== lsof ==='
sudo lsof -i :3000 -n -P 2>/dev/null || lsof -i :3000 -n -P 2>/dev/null || true
echo '=== node processes ==='
ps aux | grep -E '[n]ode|[s]erver.js' | head -30
echo '=== pm2 err last 15 ==='
pm2 logs elibrary --err --lines 15 --nostream
echo '=== health ==='
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
