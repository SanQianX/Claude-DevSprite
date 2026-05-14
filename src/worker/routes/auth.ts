/**
 * Auth Routes
 * REST endpoints for user authentication (login, register, me)
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../../relay/auth';
import { config } from '../../config';
import { logger } from '../../utils/logger';

interface AuthRequest extends Request {
  user?: { userId: number; username: string };
}

// Auth middleware — extracts and verifies JWT from Authorization header
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token, config.sync.jwtSecret);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}

export function registerAuthRoutes(app: Express): void {
  // POST /api/auth/register
  app.post('/api/auth/register', async (req: AuthRequest, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      // Validate username: 3-30 chars, alphanumeric + underscore
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        res.status(400).json({ error: 'Username must be 3-30 characters, alphanumeric and underscore only' });
        return;
      }

      // Validate password: 6+ chars
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const db = await getDatabase();

      // Check if username already exists
      const existing = db.getUserByUsername(username);
      if (existing) {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }

      const passwordHash = hashPassword(password);
      const user = db.createUser(username, passwordHash);

      const token = generateToken(
        { userId: user.id, username: user.username },
        config.sync.jwtSecret
      );

      logger.info(`User registered: ${username}`);
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (error: any) {
      logger.error('Register failed:', error);
      res.status(500).json({ error: error.message || 'Registration failed' });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req: AuthRequest, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const db = await getDatabase();
      const user = db.getUserByUsername(username);

      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }

      const token = generateToken(
        { userId: user.id, username: user.username },
        config.sync.jwtSecret
      );

      logger.info(`User logged in: ${username}`);
      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (error: any) {
      logger.error('Login failed:', error);
      res.status(500).json({ error: error.message || 'Login failed' });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const db = await getDatabase();
      const user = db.getUserById(req.user!.userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        user: { id: user.id, username: user.username, role: user.role },
      });
    } catch (error: any) {
      logger.error('Get user failed:', error);
      res.status(500).json({ error: error.message || 'Failed to get user' });
    }
  });
}
