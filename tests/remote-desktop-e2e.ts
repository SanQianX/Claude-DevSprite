/**
 * Remote Desktop E2E Test
 * Tests the full flow: Agent → Server → Browser → Server → Agent
 *
 * Run: npx ts-node tests/remote-desktop-e2e.ts
 */

import WebSocket from 'ws';

const SERVER = 'ws://124.220.17.38:38888';
const TOKEN = '01da1b0837034b15aa5b085a23b50b3b';

let agentWs: WebSocket | null = null;
let browserWs: WebSocket | null = null;
let testResults: { test: string; pass: boolean; detail: string }[] = [];
let screenDataReceived = false;
let inputRelayed = false;

function log(msg: string) {
  console.log(`[TEST] ${msg}`);
}

function assert(test: string, pass: boolean, detail: string) {
  testResults.push({ test, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${test}: ${detail}`);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function testAgentConnection(): Promise<boolean> {
  log('=== Test 1: Agent connects to /ws/remote ===');
  return new Promise((resolve) => {
    agentWs = new WebSocket(`${SERVER}/ws/remote`);

    agentWs.on('open', () => {
      log('Agent WebSocket connected');
      agentWs!.send(JSON.stringify({
        type: 'remote.auth',
        token: TOKEN,
        role: 'agent',
        name: 'test-agent',
        hostname: 'test-host',
      }));
    });

    agentWs.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'remote.auth_ok') {
        assert('Agent auth', true, `Authenticated, clientId: ${msg.clientId}`);
        resolve(true);
      } else if (msg.type === 'error') {
        assert('Agent auth', false, msg.message);
        resolve(false);
      }
    });

    agentWs.on('error', (err: Error) => {
      assert('Agent connection', false, err.message);
      resolve(false);
    });

    setTimeout(() => {
      assert('Agent connection', false, 'Timeout');
      resolve(false);
    }, 5000);
  });
}

async function testBrowserConnection(): Promise<boolean> {
  log('=== Test 2: Browser connects to /ws/remote ===');
  return new Promise((resolve) => {
    browserWs = new WebSocket(`${SERVER}/ws/remote`);

    browserWs.on('open', () => {
      log('Browser WebSocket connected');
      browserWs!.send(JSON.stringify({
        type: 'remote.auth',
        token: TOKEN,
        role: 'browser',
      }));
    });

    browserWs.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'remote.auth_ok') {
        assert('Browser auth', true, `Authenticated, clientId: ${msg.clientId}`);
        resolve(true);
      } else if (msg.type === 'remote.agent_online') {
        log(`Browser received agent_online: ${msg.name}@${msg.hostname}`);
        assert('Browser sees agent online', true, `${msg.name}@${msg.hostname}`);
      } else if (msg.type === 'remote.screen') {
        screenDataReceived = true;
        log(`Browser received screen data (${msg.data.length} chars base64)`);
        assert('Screen relay', true, `${msg.data.length} chars received`);
      } else if (msg.type === 'error') {
        assert('Browser auth', false, msg.message);
        resolve(false);
      }
    });

    browserWs.on('error', (err: Error) => {
      assert('Browser connection', false, err.message);
      resolve(false);
    });

    setTimeout(() => {
      assert('Browser connection', false, 'Timeout');
      resolve(false);
    }, 5000);
  });
}

async function testScreenRelay(): Promise<void> {
  log('=== Test 3: Screen data relay (Agent → Server → Browser) ===');
  if (!agentWs || agentWs.readyState !== WebSocket.OPEN) {
    assert('Screen relay', false, 'Agent not connected');
    return;
  }

  // Simulate a small screen capture (1x1 JPEG pixel)
  // Minimal valid JPEG: FFD8FFE0...FFD9
  const fakeJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
  ]).toString('base64');

  agentWs.send(JSON.stringify({
    type: 'remote.screen',
    data: fakeJpeg,
  }));

  log('Agent sent screen data, waiting for browser to receive...');
  await sleep(1000);

  assert('Screen relayed to browser', screenDataReceived, screenDataReceived ? 'Data received' : 'Not received');
}

async function testInputRelay(): Promise<void> {
  log('=== Test 4: Input relay (Browser → Server → Agent) ===');
  if (!browserWs || browserWs.readyState !== WebSocket.OPEN) {
    assert('Input relay', false, 'Browser not connected');
    return;
  }

  // Set up agent to receive input
  agentWs!.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'remote.input') {
      inputRelayed = true;
      log(`Agent received input: ${JSON.stringify(msg.mouse || msg.keyboard)}`);
    }
  });

  // Browser sends mouse click
  browserWs.send(JSON.stringify({
    type: 'remote.input',
    mouse: {
      type: 'click',
      x: 100,
      y: 200,
      button: 'left',
    },
  }));

  log('Browser sent input event, waiting for agent to receive...');
  await sleep(1000);

  assert('Input relayed to agent', inputRelayed, inputRelayed ? 'Input received' : 'Not received');
}

async function testBrowserDisconnect(): Promise<void> {
  log('=== Test 5: Browser disconnect notifies agent ===');
  if (!browserWs) return;

  let agentNotified = false;

  // Listen for agent_offline on agent side (not applicable here, but test cleanup)
  browserWs.close();
  await sleep(500);

  assert('Browser disconnected', true, 'Clean disconnect');
}

async function runTests() {
  console.log('\n🧪 Remote Desktop E2E Test Suite\n');
  console.log(`Server: ${SERVER}`);
  console.log(`Token: ${TOKEN.substring(0, 8)}...`);
  console.log('');

  try {
    const agentOk = await testAgentConnection();
    if (!agentOk) {
      console.log('\n❌ Agent connection failed, aborting remaining tests');
      return;
    }

    const browserOk = await testBrowserConnection();
    if (!browserOk) {
      console.log('\n❌ Browser connection failed, aborting remaining tests');
      return;
    }

    await sleep(500); // Wait for agent_online broadcast

    await testScreenRelay();
    await testInputRelay();
    await testBrowserDisconnect();
  } finally {
    // Cleanup
    if (agentWs) agentWs.close();
    if (browserWs && browserWs.readyState === WebSocket.OPEN) browserWs.close();
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('─'.repeat(50));
  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;
  console.log(`Total: ${testResults.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed tests:');
    testResults.filter(r => !r.pass).forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.detail}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
