/**
 * CORS Middleware
 * Cross-Origin Resource Sharing configuration
 */

import type { Request, Response, NextFunction } from 'express';

export function cors(req: Request, res: Response, next: NextFunction): void {
  // Allow requests from localhost (development)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}
