/**
 * Error Handler Middleware
 * Centralized error handling for API responses
 */

import type { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const errorResponse: any = {
    message,
    status: statusCode,
  };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  if (err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json({ error: errorResponse });
}

export function createError(message: string, statusCode = 500, details?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}
