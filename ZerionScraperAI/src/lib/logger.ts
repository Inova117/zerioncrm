import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
