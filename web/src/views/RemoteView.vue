<template>
  <div class="remote-view" ref="containerRef">
    <!-- Connection status bar -->
    <div class="status-bar" :class="{ collapsed: statusBarCollapsed }">
      <button class="status-toggle" @click="statusBarCollapsed = !statusBarCollapsed">
        {{ statusBarCollapsed ? '◀' : '▶' }}
      </button>
      <template v-if="!statusBarCollapsed">
        <span class="status-dot" :class="statusClass"></span>
        <span class="status-text">{{ statusText }}</span>
        <span v-if="agentName" class="agent-name">{{ agentName }}@{{ agentHost }}</span>
        <span v-if="screenMeta" class="screen-info">
          {{ screenMeta.width }}x{{ screenMeta.height }}
        </span>
        <span class="fps-counter" v-if="fps > 0">{{ fps }} fps</span>
        <button class="btn-fullscreen" @click="toggleFullscreen" title="Fullscreen">
          {{ isFullscreen ? '⊡' : '⊞' }}
        </button>
      </template>
    </div>

    <!-- Canvas for screen display -->
    <canvas
      ref="canvasRef"
      class="screen-canvas"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mousemove="onMouseMove"
      @click="onClick"
      @dblclick="onDblClick"
      @contextmenu.prevent="onContextMenu"
      @wheel.prevent="onWheel"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @keypress="onKeyPress"
      tabindex="0"
    ></canvas>

    <!-- Offline overlay -->
    <div v-if="!agentOnline" class="offline-overlay">
      <div class="offline-icon">offline</div>
      <div class="offline-text">Agent Offline</div>
      <div class="offline-hint">Waiting for agent to connect...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';

// ─── State ────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const statusBarCollapsed = ref(false);

const connected = ref(false);
const agentOnline = ref(false);
const agentName = ref('');
const agentHost = ref('');
const screenMeta = ref<{ width: number; height: number; scale: number } | null>(null);
const fps = ref(0);
const isFullscreen = ref(false);

let ws: WebSocket | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let lastFrameTime = 0;
let frameCount = 0;
let fpsInterval: ReturnType<typeof setInterval> | null = null;
const token = localStorage.getItem('auth_token') || '';

// ─── Computed ─────────────────────────────────────────────────────
const statusClass = computed(() => {
  if (!connected.value) return 'disconnected';
  if (!agentOnline.value) return 'agent-offline';
  return 'connected';
});

const statusText = computed(() => {
  if (!connected.value) return 'Connecting...';
  if (!agentOnline.value) return 'Agent Offline';
  return 'Connected';
});

// ─── WebSocket ────────────────────────────────────────────────────
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws/remote`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    // Authenticate
    ws!.send(JSON.stringify({
      type: 'remote.auth',
      token,
      role: 'browser',
    }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch {}
  };

  ws.onclose = () => {
    connected.value = false;
    agentOnline.value = false;
    // Reconnect after 3s
    setTimeout(connect, 3000);
  };

  ws.onerror = () => {};
}

function handleMessage(msg: any) {
  switch (msg.type) {
    case 'remote.auth_ok':
      connected.value = true;
      break;

    case 'remote.agent_online':
      agentOnline.value = true;
      agentName.value = msg.name || '';
      agentHost.value = msg.hostname || '';
      if (msg.screenMeta) screenMeta.value = msg.screenMeta;
      break;

    case 'remote.agent_offline':
      agentOnline.value = false;
      agentName.value = '';
      agentHost.value = '';
      break;

    case 'remote.screen':
      renderScreen(msg.data);
      break;

    case 'remote.screen.meta':
      screenMeta.value = msg.meta;
      break;

    case 'remote.pong':
      break;
  }
}

// ─── Screen Rendering ─────────────────────────────────────────────
function renderScreen(base64Data: string) {
  if (!canvasRef.value || !ctx) return;

  const img = new Image();
  img.onload = () => {
    const canvas = canvasRef.value!;
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
    }
    ctx!.drawImage(img, 0, 0);

    // FPS calculation
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      fps.value = frameCount;
      frameCount = 0;
      lastFrameTime = now;
    }
  };
  img.src = `data:image/jpeg;base64,${base64Data}`;
}

// ─── Input Events ─────────────────────────────────────────────────
function getCanvasCoords(event: MouseEvent): { x: number; y: number } {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.round((event.clientX - rect.left) * scaleX),
    y: Math.round((event.clientY - rect.top) * scaleY),
  };
}

function sendMouse(event: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'remote.input', mouse: event }));
  }
}

function sendKeyboard(event: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'remote.input', keyboard: event }));
  }
}

function onMouseDown(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'down', x, y, button: mapButton(e.button) });
}

function onMouseUp(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'up', x, y, button: mapButton(e.button) });
}

function onMouseMove(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'move', x, y });
}

function onClick(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'click', x, y, button: mapButton(e.button) });
}

function onDblClick(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'dblclick', x, y, button: mapButton(e.button) });
}

function onContextMenu(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'click', x, y, button: 'right' });
}

function onWheel(e: WheelEvent) {
  const { x, y } = getCanvasCoords(e);
  sendMouse({ type: 'scroll', x, y, deltaY: e.deltaY > 0 ? -3 : 3 });
}

function onKeyDown(e: KeyboardEvent) {
  e.preventDefault();
  sendKeyboard({
    type: 'keydown',
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
  });
}

function onKeyUp(e: KeyboardEvent) {
  e.preventDefault();
  sendKeyboard({
    type: 'keyup',
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
  });
}

function onKeyPress(e: KeyboardEvent) {
  e.preventDefault();
  sendKeyboard({
    type: 'keypress',
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
  });
}

function mapButton(button: number): string {
  switch (button) {
    case 0: return 'left';
    case 1: return 'middle';
    case 2: return 'right';
    default: return 'left';
  }
}

// ─── Fullscreen ───────────────────────────────────────────────────
function toggleFullscreen() {
  if (!containerRef.value) return;
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────
onMounted(() => {
  nextTick(() => {
    if (canvasRef.value) {
      ctx = canvasRef.value.getContext('2d');
      canvasRef.value.focus();
    }
  });

  // FPS counter
  lastFrameTime = performance.now();
  fpsInterval = setInterval(() => {
    frameCount = 0;
  }, 1000);

  connect();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (fpsInterval) {
    clearInterval(fpsInterval);
  }
});
</script>

<style scoped>
.remote-view {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #1a1a1a;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.85);
  color: #e0e0e0;
  font-size: 13px;
  font-family: monospace;
  z-index: 10;
  min-height: 28px;
  transition: all 0.2s;
}

.status-bar.collapsed {
  min-height: 28px;
}

.status-toggle {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 11px;
  padding: 0 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected { background: #4caf50; }
.status-dot.disconnected { background: #f44336; }
.status-dot.agent-offline { background: #ff9800; }

.status-text {
  color: #ccc;
}

.agent-name {
  color: #8bc34a;
}

.screen-info {
  color: #888;
}

.fps-counter {
  margin-left: auto;
  color: #666;
}

.btn-fullscreen {
  background: none;
  border: 1px solid #444;
  color: #ccc;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 14px;
}

.btn-fullscreen:hover {
  background: #333;
}

.screen-canvas {
  flex: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: default;
  outline: none;
}

.offline-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 20;
}

.offline-icon {
  font-size: 48px;
  color: #ff9800;
  margin-bottom: 16px;
}

.offline-text {
  font-size: 20px;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.offline-hint {
  font-size: 14px;
  color: #888;
}
</style>
