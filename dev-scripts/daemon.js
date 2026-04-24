#!/usr/bin/env node
/**
 * Claude-DevSprite Worker Daemon Manager
 * Inspired by claude-mem's ProcessManager
 *
 * Usage:
 *   node dev-scripts/daemon.js start   - Start as independent daemon
 *   node dev-scripts/daemon.js stop    - Stop daemon
 *   node dev-scripts/daemon.js status  - Check daemon status
 *   node dev-scripts/daemon.js restart - Restart daemon
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(PROJECT_ROOT, 'dev-scripts', 'worker.pid');
const LOG_DIR = path.join(PROJECT_ROOT, 'dev-scripts');
const STDOUT_LOG = path.join(LOG_DIR, 'worker-stdout.log');
const STDERR_LOG = path.join(LOG_DIR, 'worker-stderr.log');
const ENTRY_POINT = path.join(PROJECT_ROOT, 'dist', 'worker', 'index.js');
const PORT = 38888;
const HOST = '127.0.0.1';
const HEALTH_URL = `http://${HOST}:${PORT}/api/health`;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function readPid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    }
  } catch {}
  return null;
}

function writePid(pid) {
  ensureLogDir();
  fs.writeFileSync(PID_FILE, String(pid), 'utf8');
}

function removePid() {
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function isProcessRunning(pid) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        `powershell -NoProfile -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      return result === String(pid);
    } else {
      process.kill(pid, 0);
      return true;
    }
  } catch {
    return false;
  }
}

function healthCheck(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
  });
}

function waitForHealth(maxWaitMs = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = async () => {
      if (await healthCheck(2000)) {
        resolve(true);
        return;
      }
      if (Date.now() - start > maxWaitMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function spawnDaemon() {
  ensureLogDir();

  if (process.platform === 'win32') {
    // Windows: Use PowerShell Start-Process for fully detached process
    const psCommand = `Start-Process -FilePath 'node' -ArgumentList '${ENTRY_POINT.replace(/\\/g, '/')}' -WindowStyle Hidden -RedirectStandardOutput '${STDOUT_LOG.replace(/\\/g, '/')}' -RedirectStandardError '${STDERR_LOG.replace(/\\/g, '/')}'`;
    execSync(`powershell -NoProfile -Command "${psCommand}"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  } else {
    // Unix: Use detached spawn with setsid
    const child = spawn(process.execPath, [ENTRY_POINT], {
      detached: true,
      stdio: [
        'ignore',
        fs.openSync(STDOUT_LOG, 'a'),
        fs.openSync(STDERR_LOG, 'a')
      ]
    });
    child.unref();
  }
}

async function cmdStart() {
  console.log('Starting Claude-DevSprite Worker daemon...');

  // Check if already running
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    if (await healthCheck()) {
      console.log(`Worker already running (PID: ${pid})`);
      return;
    }
    console.log('PID file exists but process not healthy, restarting...');
    removePid();
  }

  // Also check by health endpoint (in case PID file is stale)
  if (await healthCheck()) {
    console.log('Worker already running (health check passed)');
    return;
  }

  // Build first if needed
  if (!fs.existsSync(ENTRY_POINT)) {
    console.log('Building project...');
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }

  // Spawn daemon
  spawnDaemon();

  // Wait for health
  console.log('Waiting for worker to start...');
  const started = await waitForHealth(15000);

  if (started) {
    // Find the PID
    try {
      if (process.platform === 'win32') {
        const result = execSync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result) writePid(parseInt(result, 10));
      }
    } catch {}
    console.log(`Worker started successfully on http://${HOST}:${PORT}`);
  } else {
    console.error('Failed to start worker. Check logs:');
    console.error(`  stdout: ${STDOUT_LOG}`);
    console.error(`  stderr: ${STDERR_LOG}`);
    process.exit(1);
  }
}

async function cmdStop() {
  console.log('Stopping Claude-DevSprite Worker...');

  const pid = readPid();

  if (!pid) {
    // Try to find by port
    try {
      if (process.platform === 'win32') {
        const result = execSync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result) {
          const foundPid = parseInt(result, 10);
          console.log(`Found worker by port (PID: ${foundPid})`);
          execSync(`powershell -NoProfile -Command "Stop-Process -Id ${foundPid} -Force"`, { stdio: 'ignore' });
          console.log('Worker stopped.');
        } else {
          console.log('Worker is not running.');
        }
      }
    } catch {
      console.log('Worker is not running.');
    }
    removePid();
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log('Worker is not running (stale PID file).');
    removePid();
    return;
  }

  try {
    if (process.platform === 'win32') {
      execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`Worker stopped (PID: ${pid})`);
  } catch (e) {
    console.error(`Failed to stop worker: ${e.message}`);
  }

  removePid();
}

async function cmdStatus() {
  console.log('Claude-DevSprite Worker Status');
  console.log('─'.repeat(40));

  const pid = readPid();
  const healthy = await healthCheck();

  console.log(`Health:      ${healthy ? '✅ OK' : '❌ DOWN'}`);
  console.log(`URL:         ${HEALTH_URL}`);
  console.log(`PID file:    ${fs.existsSync(PID_FILE) ? PID_FILE : 'not found'}`);

  if (pid) {
    console.log(`PID:         ${pid}`);
    console.log(`Process:     ${isProcessRunning(pid) ? '✅ Running' : '❌ Not running'}`);
  } else {
    console.log(`PID:         not tracked`);
  }

  console.log(`Stdout log:  ${STDOUT_LOG}`);
  console.log(`Stderr log:  ${STDERR_LOG}`);
}

async function cmdRestart() {
  await cmdStop();
  await new Promise(r => setTimeout(r, 1000));
  await cmdStart();
}

// CLI
const command = process.argv[2] || 'status';
switch (command) {
  case 'start': cmdStart(); break;
  case 'stop': cmdStop(); break;
  case 'status': cmdStatus(); break;
  case 'restart': cmdRestart(); break;
  default:
    console.log('Usage: node dev-scripts/daemon.js [start|stop|status|restart]');
    process.exit(1);
}
