#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo "Civitas Secure Remote Voting — Cloudflare Quick Tunnel"
echo "=================================================="

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
  echo "Error: cloudflared is not installed on your system."
  echo "Install it via: brew install cloudflared"
  exit 1
fi

# Detect actual Next.js frontend port
FRONTEND_PORT=""
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -qE "200|307|308|404"; then
  FRONTEND_PORT=3000
elif curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -qE "200|307|308|404"; then
  FRONTEND_PORT=3001
else
  # Fallback to checking listening ports via lsof
  if lsof -i :3000 | grep -q LISTEN; then
    FRONTEND_PORT=3000
  elif lsof -i :3001 | grep -q LISTEN; then
    FRONTEND_PORT=3001
  else
    FRONTEND_PORT=3000
  fi
fi

echo "-> Detected Next.js frontend running on port $FRONTEND_PORT."

LOG_FILE="$ROOT_DIR/cloudflared.log"
rm -f "$LOG_FILE"

echo "[1/4] Starting Cloudflare Quick Tunnel for Next.js (http://localhost:$FRONTEND_PORT)..."
cloudflared tunnel --url "http://localhost:$FRONTEND_PORT" > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!

echo "[2/4] Detecting temporary trycloudflare.com HTTPS URL..."
DETECTED_URL=""

for i in {1..30}; do
  if grep -o 'https://[-a-zA-Z0-9]*\.trycloudflare\.com' "$LOG_FILE" | head -n 1 > /tmp/cf_url.txt; then
    DETECTED_URL=$(cat /tmp/cf_url.txt)
    if [ -n "$DETECTED_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$DETECTED_URL" ]; then
  echo "Error: Failed to obtain trycloudflare.com URL within 30 seconds."
  echo "Check $LOG_FILE for details."
  kill "$TUNNEL_PID" 2>/dev/null || true
  exit 1
fi

echo "[3/4] Updating environment configuration..."

update_env_file() {
  local file="$1"
  if [ -f "$file" ]; then
    # Remove old lines cleanly
    sed -i '' '/PUBLIC_BASE_URL=/d' "$file" 2>/dev/null || sed -i '/PUBLIC_BASE_URL=/d' "$file" 2>/dev/null || true
    sed -i '' '/NEXT_PUBLIC_PUBLIC_VOTING_URL=/d' "$file" 2>/dev/null || sed -i '/NEXT_PUBLIC_PUBLIC_VOTING_URL=/d' "$file" 2>/dev/null || true
    echo "PUBLIC_BASE_URL=\"$DETECTED_URL\"" >> "$file"
    echo "NEXT_PUBLIC_PUBLIC_VOTING_URL=\"$DETECTED_URL\"" >> "$file"
  fi
}

update_env_file "$ROOT_DIR/.env"
update_env_file "$ROOT_DIR/backend/.env"
update_env_file "$ROOT_DIR/frontend/.env.local"

echo "[4/4] Syncing live backend runtime configuration..."
curl -s -X POST "http://localhost:8000/api/v1/admin/config/public-url" \
  -H "Content-Type: application/json" \
  -d "{\"public_base_url\": \"$DETECTED_URL\"}" > /dev/null 2>&1 || true

echo ""
echo "=================================================="
echo "CURRENT PUBLIC VOTING URL:"
echo "$DETECTED_URL"
echo "=================================================="
echo "✓ PUBLIC_BASE_URL set to $DETECTED_URL"
echo "✓ Target local frontend: http://localhost:$FRONTEND_PORT"
echo "✓ Admin Panel & QR codes will use this active tunnel URL."
echo ""
echo "NOTE: Press Ctrl+C to stop the Cloudflare Tunnel."
echo "=================================================="

cleanup() {
  echo ""
  echo "Stopping Cloudflare Tunnel (PID: $TUNNEL_PID)..."
  kill "$TUNNEL_PID" 2>/dev/null || true
  # Clear live backend URL so status immediately reflects offline
  curl -s -X POST "http://localhost:8000/api/v1/admin/config/public-url" \
    -H "Content-Type: application/json" \
    -d '{"public_base_url": ""}' > /dev/null 2>&1 || true
  echo "✓ Cloudflare tunnel stopped."
  exit 0
}

trap cleanup INT TERM

wait $TUNNEL_PID
