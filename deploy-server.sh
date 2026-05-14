#!/bin/bash
# Claude-DevSprite Server Deployment Script
# Usage: bash deploy-server.sh

set -e

SERVER="ubuntu@124.220.17.38"
PASSWORD='6jSNQ[qE2/%#]P'

echo "=========================================="
echo "  Claude-DevSprite Server Deployment"
echo "=========================================="

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
AGENT_TOKEN=$(openssl rand -hex 16)

echo ""
echo "Generated Secrets:"
echo "  JWT Secret:  $JWT_SECRET"
echo "  Agent Token: $AGENT_TOKEN"
echo ""

# Create remote commands
REMOTE_CMDS=$(cat << REMOTEEOF
set -e

echo "=== Step 1: Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node version: \$(node -v)"

echo "=== Step 2: Installing Claude-DevSprite ==="
sudo npm install -g claude-dev-sprite
echo "Claude-DevSprite version: \$(claude-dev-sprite --version 2>/dev/null || echo 'installed')"

echo "=== Step 3: Creating Config ==="
mkdir -p ~/.claude-dev-sprite
cat > ~/.claude-dev-sprite/config.json << 'CONFIGEOF'
{
  "sync": {
    "enabled": true,
    "jwtSecret": "${JWT_SECRET}",
    "agentToken": "${AGENT_TOKEN}"
  },
  "server": {
    "port": 38888,
    "host": "0.0.0.0"
  }
}
CONFIGEOF
cat ~/.claude-dev-sprite/config.json

echo "=== Step 4: Starting Server ==="
claude-dev-sprite start --port 38888 --daemon || true
sleep 3
claude-dev-sprite status || true

echo "=== Step 5: Opening Firewall ==="
sudo ufw allow 38888/tcp || true
sudo ufw -y enable || true

echo "=== Step 6: Registering Admin ==="
curl -X POST http://localhost:38888/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"MyPass123!"}' || true
echo ""

echo "=== Step 7: Verifying ==="
curl -s http://localhost:38888/api/config | head -c 200 || true
echo ""

echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
REMOTEEOF
)

# Execute via SSH using expect-like approach with bash
# Since sshpass is not available, we use a different method
echo "Connecting to server..."
echo ""

# Use a heredoc approach with ssh
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER << 'SSHEOF'
echo "Connected to server!"
uname -a
SSHEOF

if [ $? -eq 0 ]; then
    echo "SSH connection successful (key-based)"
    echo "Executing deployment..."
    ssh -o StrictHostKeyChecking=no $SERVER "$REMOTE_CMDS"
else
    echo ""
    echo "SSH key not configured. Please run this command first:"
    echo ""
    echo "  ssh-copy-id $SERVER"
    echo ""
    echo "Enter password when prompted: $PASSWORD"
    echo ""
    echo "After that, run this script again."
fi
