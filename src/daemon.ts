/**
 * Claude-DevSprite Daemon Manager (TypeScript)
 * Manages the worker process as a detached background daemon.
 *
 * PID files and logs are stored in ~/.claude/claude-dev-sprite/
 * so that the global CLI works correctly from any directory.
 */

import { execSync, spawn } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// PACKAGE_ROOT: resolves to the package root whether installed globally or locally
// __dirname = dist/  →  PACKAGE_ROOT = one level up
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const ENTRY_POINT = path.join(PACKAGE_ROOT, 'dist', 'worker', 'index.js');

// Store PID/logs in user home so global install works
const DATA_DIR = path.join(os.homedir(), '.claude', 'claude-dev-sprite');
const PID_FILE = path.join(DATA_DIR, 'daemon.pid');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const STDOUT_LOG = path.join(LOG_DIR, 'worker-stdout.log');
const STDERR_LOG = path.join(LOG_DIR, 'worker-stderr.log');
const ENV_FILE = path.join(DATA_DIR, 'worker-env.json');

function getPort(): number {
  return parseInt(process.env.PORT || '38888', 10);
}

function getHost(): string {
  return process.env.HOST || '127.0.0.1';
}

function healthUrl(): string {
  return `http://${getHost()}:${getPort()}/api/health`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    }
  } catch { /* ignore */ }
  return null;
}

function writePid(pid: number): void {
  ensureDir(DATA_DIR);
  fs.writeFileSync(PID_FILE, String(pid), 'utf8');
}

function removePid(): void {
  try { fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

function isProcessRunning(pid: number): boolean {
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

function healthCheck(timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const url = healthUrl();
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
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

function waitForHealth(maxWaitMs = 15000): Promise<boolean> {
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

/** Auth environment variables to forward to the child process */
const AUTH_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
];

function collectAuthEnv(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of AUTH_ENV_KEYS) {
    const val = process.env[key];
    if (val) result[key] = val;
  }
  // Forward PORT so the child uses the same port
  result.PORT = String(getPort());
  return result;
}

function spawnDaemon(): void {
  ensureDir(LOG_DIR);
  const authEnv = collectAuthEnv();

  if (process.platform === 'win32') {
    // Windows: write a .cmd wrapper, launch via PowerShell Start-Process
    const wrapperScript = path.join(DATA_DIR, 'start-worker.cmd');
    let cmd = '@echo off\n';
    for (const [k, v] of Object.entries(authEnv)) {
      cmd += `set "${k}=${v}"\n`;
    }
    cmd += `node "${ENTRY_POINT}"\n`;
    fs.writeFileSync(wrapperScript, cmd, 'utf8');

    const psCmd = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c "${wrapperScript.replace(/\\/g, '/')}"' -WindowStyle Hidden -RedirectStandardOutput '${STDOUT_LOG.replace(/\\/g, '/')}' -RedirectStandardError '${STDERR_LOG.replace(/\\/g, '/')}'`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    // Unix: detached spawn
    const env = { ...process.env, ...authEnv };
    const child = spawn(process.execPath, [ENTRY_POINT], {
      detached: true,
      env,
      stdio: [
        'ignore',
        fs.openSync(STDOUT_LOG, 'a'),
        fs.openSync(STDERR_LOG, 'a'),
      ],
    });
    child.unref();
  }
}

export async function cmdStart(): Promise<void> {
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

  // Build if entry point missing
  if (!fs.existsSync(ENTRY_POINT)) {
    console.log('Entry point not found, building...');
    execSync('npm run build', { cwd: PACKAGE_ROOT, stdio: 'inherit' });
  }

  spawnDaemon();

  console.log('Waiting for worker to start...');
  const started = await waitForHealth(15000);

  if (started) {
    // Try to discover PID by port
    try {
      if (process.platform === 'win32') {
        const result = execSync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${getPort()} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        if (result) writePid(parseInt(result, 10));
      }
    } catch { /* ignore */ }
    console.log(`Worker started successfully on http://${getHost()}:${getPort()}`);
  } else {
    console.error('Failed to start worker. Check logs:');
    console.error(`  stdout: ${STDOUT_LOG}`);
    console.error(`  stderr: ${STDERR_LOG}`);
    process.exit(1);
  }
}

export async function cmdStop(): Promise<void> {
  console.log('Stopping Claude-DevSprite Worker...');

  const pid = readPid();

  if (!pid) {
    // Try to find by port
    try {
      if (process.platform === 'win32') {
        const result = execSync(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${getPort()} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
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
      } else {
        console.log('Worker is not running.');
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
  } catch (e: any) {
    console.error(`Failed to stop worker: ${e.message}`);
  }

  removePid();
}

export async function cmdStatus(): Promise<void> {
  console.log('Claude-DevSprite Worker Status');
  console.log('─'.repeat(40));

  const pid = readPid();
  const healthy = await healthCheck();

  console.log(`Health:      ${healthy ? 'OK' : 'DOWN'}`);
  console.log(`URL:         ${healthUrl()}`);
  console.log(`Port:        ${getPort()}`);
  console.log(`PID file:    ${fs.existsSync(PID_FILE) ? PID_FILE : 'not found'}`);

  if (pid) {
    console.log(`PID:         ${pid}`);
    console.log(`Process:     ${isProcessRunning(pid) ? 'Running' : 'Not running'}`);
  } else {
    console.log(`PID:         not tracked`);
  }

  console.log(`Stdout log:  ${STDOUT_LOG}`);
  console.log(`Stderr log:  ${STDERR_LOG}`);
}

export async function cmdRestart(): Promise<void> {
  await cmdStop();
  await new Promise(r => setTimeout(r, 1000));
  await cmdStart();
}
