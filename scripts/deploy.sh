#!/bin/bash
# Deploy to remote server via SSH
# Usage: bash scripts/deploy.sh

set -e

SERVER="ubuntu@124.220.17.38"
REMOTE_DIR="/usr/lib/node_modules/claude-dev-sprite"

echo "=== Building backend ==="
npm run build 2>&1

echo "=== Building frontend ==="
cd web && npm run build 2>&1 && cd ..

echo "=== Uploading backend files ==="
scp -o StrictHostKeyChecking=no \
  dist/worker/server.js \
  dist/worker/wsServer.js \
  dist/worker/wsHandler.js \
  dist/worker/routes/projects.js \
  dist/worker/routes/dashboard.js \
  dist/worker/routes/reviews.js \
  dist/worker/routes/config.js \
  dist/worker/middleware/relayMiddleware.js \
  dist/sync/syncServer.js \
  dist/sync/syncClient.js \
  dist/agent/agentClient.js \
  dist/agent/index.js \
  dist/remote/screenCapture.js \
  dist/remote/inputSimulator.js \
  dist/remote/remoteServer.js \
  "$SERVER:/tmp/"

echo "=== Copying backend to install path ==="
ssh -o StrictHostKeyChecking=no "$SERVER" "
  sudo cp /tmp/server.js $REMOTE_DIR/dist/worker/server.js
  sudo cp /tmp/wsServer.js $REMOTE_DIR/dist/worker/wsServer.js
  sudo cp /tmp/wsHandler.js $REMOTE_DIR/dist/worker/wsHandler.js
  sudo cp /tmp/projects.js $REMOTE_DIR/dist/worker/routes/projects.js
  sudo cp /tmp/dashboard.js $REMOTE_DIR/dist/worker/routes/dashboard.js
  sudo cp /tmp/reviews.js $REMOTE_DIR/dist/worker/routes/reviews.js
  sudo cp /tmp/config.js $REMOTE_DIR/dist/worker/routes/config.js
  sudo cp /tmp/relayMiddleware.js $REMOTE_DIR/dist/worker/middleware/relayMiddleware.js
  sudo cp /tmp/syncServer.js $REMOTE_DIR/dist/sync/syncServer.js
  sudo cp /tmp/syncClient.js $REMOTE_DIR/dist/sync/syncClient.js
  sudo cp /tmp/agentClient.js $REMOTE_DIR/dist/agent/agentClient.js
  sudo cp /tmp/index.js $REMOTE_DIR/dist/agent/index.js
  sudo mkdir -p $REMOTE_DIR/dist/remote
  sudo cp /tmp/screenCapture.js $REMOTE_DIR/dist/remote/screenCapture.js
  sudo cp /tmp/inputSimulator.js $REMOTE_DIR/dist/remote/inputSimulator.js
  sudo cp /tmp/remoteServer.js $REMOTE_DIR/dist/remote/remoteServer.js
"

echo "=== Uploading frontend ==="
scp -o StrictHostKeyChecking=no -r \
  web/dist/* \
  "$SERVER:/tmp/web-dist/"

echo "=== Copying frontend to install path ==="
ssh -o StrictHostKeyChecking=no "$SERVER" "
  sudo cp -r /tmp/web-dist/* $REMOTE_DIR/web/dist/
"

echo "=== Restarting server ==="
ssh -o StrictHostKeyChecking=no "$SERVER" "
  claude-dev-sprite stop 2>/dev/null || true
  sleep 2
  claude-dev-sprite start --port 38888 --daemon
  sleep 3
  claude-dev-sprite status
"

echo "=== Done ==="
echo "Server: http://124.220.17.38:38888"
