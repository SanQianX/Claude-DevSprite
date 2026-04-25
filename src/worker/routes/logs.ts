/**
 * Logs API Routes
 * GET /api/logs - Return recent worker logs with level filtering
 */

import type { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('logs');

/**
 * Efficiently read the last N lines from a file by reading backwards in chunks.
 * Avoids loading entire large log files into memory.
 */
function readLastLines(filePath: string, lineCount: number): { lines: string; totalEstimate: number } {
  if (!fs.existsSync(filePath)) {
    return { lines: '', totalEstimate: 0 };
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (fileSize === 0) {
    return { lines: '', totalEstimate: 0 };
  }

  const maxChunkSize = 64 * 1024; // 64KB chunks
  const maxReadSize = 10 * 1024 * 1024; // 10MB max read
  let readSize = 0;
  const chunks: Buffer[] = [];
  let position = fileSize;
  let linesFound = 0;

  while (position > 0 && linesFound < lineCount && readSize < maxReadSize) {
    const chunkSize = Math.min(maxChunkSize, position);
    position -= chunkSize;
    readSize += chunkSize;

    const buffer = Buffer.alloc(chunkSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, chunkSize, position);
    fs.closeSync(fd);

    chunks.unshift(buffer);

    // Count newlines in this chunk
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0A) linesFound++; // '\n'
    }
  }

  const combined = Buffer.concat(chunks).toString('utf-8');
  const allLines = combined.split('\n');

  // Take last lineCount lines, skip first partial line
  const startIdx = allLines.length > lineCount ? allLines.length - lineCount : 1;
  const result = allLines.slice(startIdx).join('\n').trim();

  return { lines: result, totalEstimate: linesFound };
}

export function registerLogRoutes(app: Express): void {
  /**
   * GET /api/logs
   * Query params:
   *  - lines: number of lines to return (default: 500, max: 5000)
   *  - level: filter by log level (INFO, WARN, ERROR, DEBUG)
   */
  app.get('/api/logs', asyncHandler(async (req: Request, res: Response) => {
    const logFiles = [
      path.join(process.cwd(), 'dev-scripts', 'worker-stdout.log'),
      path.join(process.cwd(), 'dev-scripts', 'worker-stderr.log'),
    ];

    const requestedLines = parseInt(req.query.lines as string || '500', 10);
    const maxLines = Math.min(requestedLines, 5000);
    const levelFilter = (req.query.level as string || '').toUpperCase();

    const allLines: string[] = [];

    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        const { lines } = readLastLines(logFile, maxLines);
        if (lines) {
          allLines.push(...lines.split('\n'));
        }
      }
    }

    // Sort by timestamp (lines start with [ISO_TIMESTAMP])
    allLines.sort((a, b) => {
      const tsA = a.match(/^\[([^\]]+)\]/)?.[1] || '';
      const tsB = b.match(/^\[([^\]]+)\]/)?.[1] || '';
      return tsA.localeCompare(tsB);
    });

    // Filter by level if specified
    let filtered = allLines;
    if (levelFilter && ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(levelFilter)) {
      filtered = allLines.filter(line => {
        // Match [INFO], [WARN], [ERROR], [DEBUG] in the line
        return line.includes(`[${levelFilter}]`);
      });
    }

    // Take last N lines
    const result = filtered.slice(-maxLines);
    const totalLines = allLines.length;

    res.json({
      logs: result.join('\n'),
      totalLines,
      returnedLines: result.length,
      level: levelFilter || 'ALL',
    });
  }));
}
