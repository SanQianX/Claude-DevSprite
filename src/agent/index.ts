#!/usr/bin/env node
/**
 * Agent CLI Entry
 * Parses arguments and starts the agent client
 */

import { AgentClient, type AgentClientConfig } from './agentClient';

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printHelp(): void {
  console.log(`
claude-dev-sprite agent — Connect local machine to remote server

Usage:
  claude-dev-sprite agent [options]

Options:
  --server <url>    Server WebSocket URL (e.g., ws://myserver:38888/ws/agent)
  --token <token>   Agent authentication token
  --name <name>     Agent name (default: hostname)
  --help            Show this help message

Examples:
  claude-dev-sprite agent --server ws://myserver:38888/ws/agent --token my-secret-token
  claude-dev-sprite agent --server ws://myserver:38888/ws/agent --token my-secret-token --name office-pc
`);
}

export async function runAgent(argv?: { server?: string; token?: string; name?: string }): Promise<void> {
  const args = process.argv.slice(2);

  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printHelp();
    process.exit(0);
  }

  const server = argv?.server || getArg(args, '--server');
  const token = argv?.token || getArg(args, '--token');
  const name = argv?.name || getArg(args, '--name');

  if (!server) {
    console.error('Error: --server is required');
    printHelp();
    process.exit(1);
  }

  if (!token) {
    console.error('Error: --token is required');
    printHelp();
    process.exit(1);
  }

  // Ensure WebSocket URL ends with /ws/agent
  const wsUrl = server.endsWith('/ws/agent') ? server : `${server}/ws/agent`;

  const agentConfig: AgentClientConfig = {
    serverUrl: wsUrl,
    token,
    name: name || require('os').hostname(),
  };

  const client = new AgentClient(agentConfig);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down agent...');
    client.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    client.disconnect();
    process.exit(0);
  });

  console.log(`Starting agent: ${agentConfig.name}`);
  console.log(`Server: ${agentConfig.serverUrl}`);

  client.connect();
}
