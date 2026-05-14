/**
 * Authentication Utilities
 * JWT token generation/verification and password hashing
 * Uses only Node.js built-in crypto — no new dependencies
 */

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const SALT_LENGTH = 32;

// === Password Hashing ===

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return hash.toString('hex') === hashHex;
}

// === Base64URL Helpers ===

function base64urlEncode(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// === JWT ===

interface JwtPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

export function generateToken(
  payload: { userId: number; username: string },
  secret: string,
  expiresInMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): string {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64urlEncode(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + Math.floor(expiresInMs / 1000),
  }));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest();
  const sig = base64urlEncode(signature);
  return `${header}.${body}.${sig}`;
}

export function verifyToken(
  token: string,
  secret: string
): { userId: number; username: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (sig !== expectedSig) return null;

    // Decode and check expiry
    const payload: JwtPayload = JSON.parse(base64urlDecode(body).toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
