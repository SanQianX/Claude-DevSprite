#!/usr/bin/env node
/**
 * Claude-DevSprite CLI
 * Entry point for the npm-published command-line tool.
 *
 * Usage:
 *   claude-dev-sprite [--port N] [start|stop|status|restart]
 */

import * as fs from 'fs';
import * as path from 'path';
import { cmdStart, cmdStop, cmdStatus, cmdRestart } from './daemon';

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function printHelp(): void {
  const pkg = readPackageJson();
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

Usage:
  claude-dev-sprite [command] [options]

Commands:
  start      Start the worker daemon (default)
  stop       Stop the worker daemon
  status     Show daemon status
  restart    Restart the worker daemon

Options:
  --port N   Set the server port (default: 38888)
  --help     Show this help message
  --version  Show version number

Examples:
  claude-dev-sprite                 # Start on default port 38888
  claude-dev-sprite --port 8080     # Start on custom port
  claude-dev-sprite status          # Check if running
`);
}

function readPackageJson(): { name: string; version: string; description: string } {
  try {
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { name: 'claude-dev-sprite', version: '0.0.0', description: '' };
  }
}

async function main(): Promise<void> {
  // --help
  if (hasFlag('--help') || hasFlag('-h')) {
    printHelp();
    process.exit(0);
  }

  // --version
  if (hasFlag('--version') || hasFlag('-v')) {
    const pkg = readPackageJson();
    console.log(pkg.version);
    process.exit(0);
  }

  // --port
  const portStr = getArg('--port');
  if (portStr) {
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`Error: Invalid port number "${portStr}"`);
      process.exit(1);
    }
    process.env.PORT = String(port);
  }

  // Command (default: start)
  const command = args.find(a => !a.startsWith('--') && a !== portStr) || 'start';

  switch (command) {
    case 'start':
      await cmdStart();
      break;
    case 'stop':
      await cmdStop();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'restart':
      await cmdRestart();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
