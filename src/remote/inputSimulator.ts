/**
 * Input Simulator
 * Simulates mouse and keyboard input on the local machine
 * Uses a compiled C# executable for Windows (bypasses PowerShell AMSI)
 * Uses xdotool for Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('input-simulator');

export interface MouseEvent {
  type: 'move' | 'click' | 'dblclick' | 'down' | 'up' | 'scroll';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEvent {
  type: 'keydown' | 'keyup' | 'keypress';
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export class InputSimulator {
  private isWindows = os.platform() === 'win32';
  private isLinux = os.platform() === 'linux';
  private simExe: string;

  constructor() {
    // Path to the compiled C# input simulator
    this.simExe = path.join(__dirname, 'input-sim.exe');
  }

  /**
   * Simulate mouse event
   */
  async mouse(event: MouseEvent): Promise<void> {
    try {
      if (this.isWindows) {
        await this.simulateWindows({ mouse: event });
      } else if (this.isLinux) {
        await this.mouseLinux(event);
      }
    } catch (error: any) {
      logger.error(`Mouse simulation failed: ${error.message}`);
    }
  }

  /**
   * Simulate keyboard event
   */
  async keyboard(event: KeyboardEvent): Promise<void> {
    try {
      if (this.isWindows) {
        await this.simulateWindows({ keyboard: event });
      } else if (this.isLinux) {
        await this.keyboardLinux(event);
      }
    } catch (error: any) {
      logger.error(`Keyboard simulation failed: ${error.message}`);
    }
  }

  /**
   * Call the C# input simulator on Windows
   */
  private async simulateWindows(payload: any): Promise<void> {
    const json = JSON.stringify(payload);
    // Escape for cmd.exe
    const escaped = json.replace(/"/g, '\\"');
    await execAsync(`"${this.simExe}" "${escaped}"`, { timeout: 5000 });
  }

  // ─── Linux (xdotool) ─────────────────────────────────────────────

  private async mouseLinux(event: MouseEvent): Promise<void> {
    const btnMap: Record<string, string> = { left: '1', middle: '2', right: '3' };

    switch (event.type) {
      case 'move':
        await execAsync(`xdotool mousemove ${event.x} ${event.y}`, { timeout: 5000 });
        break;
      case 'click':
        await execAsync(`xdotool mousemove ${event.x} ${event.y} click --delay 50 ${btnMap[event.button || 'left']}`, { timeout: 5000 });
        break;
      case 'dblclick':
        await execAsync(`xdotool mousemove ${event.x} ${event.y} click --delay 50 --repeat 2 ${btnMap[event.button || 'left']}`, { timeout: 5000 });
        break;
      case 'scroll':
        await execAsync(`xdotool mousemove ${event.x} ${event.y} click --repeat ${Math.abs(event.deltaY || 3)} 5`, { timeout: 5000 });
        break;
      case 'down':
        await execAsync(`xdotool mousedown --window 0 ${btnMap[event.button || 'left']}`, { timeout: 5000 });
        break;
      case 'up':
        await execAsync(`xdotool mouseup --window 0 ${btnMap[event.button || 'left']}`, { timeout: 5000 });
        break;
    }
  }

  private async keyboardLinux(event: KeyboardEvent): Promise<void> {
    if (event.type !== 'keydown' && event.type !== 'keypress') return;

    let mods = '';
    if (event.ctrlKey) mods += 'ctrl+';
    if (event.altKey) mods += 'alt+';
    if (event.shiftKey) mods += 'shift+';
    if (event.metaKey) mods += 'super+';

    const keyName = this.mapKeyToXdotool(event.key);
    await execAsync(`xdotool key ${mods}${keyName}`, { timeout: 5000 });
  }

  private mapKeyToXdotool(key: string): string {
    const map: Record<string, string> = {
      'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
      'Backspace': 'BackSpace', 'Enter': 'Return', 'Escape': 'Escape',
      'Delete': 'Delete', 'Tab': 'Tab', ' ': 'space',
      'Home': 'Home', 'End': 'End', 'PageUp': 'Page_Up', 'PageDown': 'Page_Down',
    };
    return map[key] || key.length === 1 ? key.toLowerCase() : key;
  }
}

export const inputSimulator = new InputSimulator();
