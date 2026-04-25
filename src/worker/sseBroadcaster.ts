/**
 * SSE (Server-Sent Events) Broadcaster
 * Manages real-time client connections and broadcasts events to all clients.
 * Pattern adapted from claude-mem's SSEBroadcaster.
 */

import type { Response } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('sse');

export interface SSEEvent {
  type: string;
  timestamp?: number;
  [key: string]: any;
}

export class SSEBroadcaster {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    this.clients.add(res);
    logger.info(`SSE client connected (total: ${this.clients.size})`);

    res.on('close', () => {
      this.clients.delete(res);
      logger.info(`SSE client disconnected (total: ${this.clients.size})`);
    });

    this.sendToClient(res, { type: 'connected', timestamp: Date.now() });
  }

  broadcast(event: SSEEvent): void {
    if (this.clients.size === 0) return;

    const eventWithTimestamp = { ...event, timestamp: Date.now() };
    const data = `data: ${JSON.stringify(eventWithTimestamp)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(data);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private sendToClient(res: Response, event: SSEEvent): void {
    try {
      const data = `data: ${JSON.stringify({ ...event, timestamp: Date.now() })}\n\n`;
      res.write(data);
    } catch {
      this.clients.delete(res);
    }
  }
}

export const sseBroadcaster = new SSEBroadcaster();
