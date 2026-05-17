$password = '6jSNQ[qE2/%#]P'
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential('ubuntu', $securePassword)

Write-Host "=== Step 1: Installing Node.js ==="
ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"

Write-Host "=== Step 2: Installing Claude-DevSprite ==="
ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 "sudo npm install -g claude-dev-sprite"

Write-Host "=== Step 3: Configuring ==="
$jwtSecret = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
$agentToken = -join ((1..16) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

Write-Host "JWT Secret: $jwtSecret"
Write-Host "Agent Token: $agentToken"

$remoteCmd = @"
mkdir -p ~/.claude-dev-sprite
cat > ~/.claude-dev-sprite/config.json << 'CONFIGEOF'
{
  "sync": {
    "enabled": true,
    "jwtSecret": "$jwtSecret",
    "agentToken": "$agentToken"
  },
  "server": {
    "port": 38888,
    "host": "0.0.0.0"
  }
}
CONFIGEOF
"@

ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 $remoteCmd

Write-Host "=== Step 4: Starting Server ==="
ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 "claude-dev-sprite start --port 38888 --daemon"

Write-Host "=== Step 5: Open Firewall ==="
ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 "sudo ufw allow 38888/tcp && sudo ufw -y enable"

Write-Host "=== Step 6: Register Admin ==="
ssh -o StrictHostKeyChecking=no ubuntu@124.220.17.38 'curl -X POST http://localhost:38888/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"MyPass123!\"}"'

Write-Host "=== Deployment Complete ==="
Write-Host "Access: http://124.220.17.38:38888"
Write-Host "JWT Secret: $jwtSecret"
Write-Host "Agent Token: $agentToken"
