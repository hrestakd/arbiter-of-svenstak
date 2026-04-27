/**
 * Tiny error-response helpers so every API route returns the same JSON shape.
 */

import type { VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';

export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export function fail(res: VercelResponse, status: number, code: string, message: string, details?: unknown): void {
  const body: ErrorBody = { code, message };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

export function methodNotAllowed(res: VercelResponse, allowed: readonly string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  fail(res, 405, 'METHOD_NOT_ALLOWED', `Method not allowed. Use ${allowed.join(', ')}.`);
}

export function badRequest(res: VercelResponse, err: unknown): void {
  if (err instanceof ZodError) {
    fail(res, 400, 'VALIDATION_ERROR', 'Request body failed validation.', err.flatten());
    return;
  }
  fail(res, 400, 'BAD_REQUEST', err instanceof Error ? err.message : 'Bad request');
}

export function unauthorized(res: VercelResponse, message = 'Authentication required.'): void {
  fail(res, 401, 'UNAUTHORIZED', message);
}

export function forbidden(res: VercelResponse, message = 'Forbidden.'): void {
  fail(res, 403, 'FORBIDDEN', message);
}

export function notFound(res: VercelResponse, message = 'Not found.'): void {
  fail(res, 404, 'NOT_FOUND', message);
}

export function conflict(res: VercelResponse, code: string, message: string): void {
  fail(res, 409, code, message);
}

export function tooManyRequests(res: VercelResponse, retryAfterSeconds: number): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  fail(res, 429, 'RATE_LIMITED', 'Slow down a bit.');
}

export function internal(res: VercelResponse, err: unknown): void {
  console.error('[api]', err);
  fail(res, 500, 'INTERNAL', 'Something went wrong.');
}
