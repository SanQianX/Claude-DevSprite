/**
 * Screen Capture
 * Captures screenshots of the local screen using native Node.js addons
 * Windows/Linux: node-screenshots (native addon, no PowerShell needed)
 */

import { createLogger } from '../utils/logger';
import * as os from 'os';

const logger = createLogger('screen-capture');

export interface CaptureOptions {
  quality?: number;    // JPEG quality 1-100 (default: 50)
  scale?: number;      // Scale factor (default: 0.5 for half size)
  maxWidth?: number;   // Max width in pixels
}

export class ScreenCapture {
  private monitor: any = null;

  private getMonitor(): any {
    if (!this.monitor) {
      try {
        const { Monitor } = require('node-screenshots');
        this.monitor = Monitor.fromPoint(0, 0);
      } catch (e: any) {
        logger.error(`Failed to init screen capture: ${e.message}`);
        throw e;
      }
    }
    return this.monitor;
  }

  /**
   * Capture the primary screen as JPEG buffer
   */
  async capture(options: CaptureOptions = {}): Promise<Buffer | null> {
    const { quality = 50, maxWidth = 1280 } = options;

    try {
      const monitor = this.getMonitor();
      const img = monitor.captureImageSync();

      // Get PNG buffer
      let pngBuf: Buffer = img.toPngSync();

      // Resize with sharp if available and maxWidth is set
      if (maxWidth && img.width > maxWidth) {
        try {
          const sharp = require('sharp');
          const scale = maxWidth / img.width;
          const newHeight = Math.round(img.height * scale);
          pngBuf = await sharp(pngBuf)
            .resize(maxWidth, newHeight)
            .jpeg({ quality })
            .toBuffer();
          return pngBuf;
        } catch {
          // sharp not available, use original PNG
        }
      }

      // Convert PNG to JPEG using sharp
      try {
        const sharp = require('sharp');
        pngBuf = await sharp(pngBuf).jpeg({ quality }).toBuffer();
      } catch {
        // sharp not available, return PNG as-is (browser handles both)
      }

      return pngBuf;
    } catch (error: any) {
      logger.error(`Screen capture failed: ${error.message}`);
      return null;
    }
  }
}

export const screenCapture = new ScreenCapture();
