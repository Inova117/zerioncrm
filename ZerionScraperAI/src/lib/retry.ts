import { logger } from './logger.js';

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

/** Retry an async operation with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 1_000, maxDelayMs = 30_000, label = 'operation' } = opts;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) * (0.5 + Math.random());
      logger.warn({ label, attempt, delay: Math.round(delay), error: String(error) }, 'retrying');
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
