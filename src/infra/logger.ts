import pino from 'pino';
import { env, isProd } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd
    ? undefined
    : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  base: undefined,
  redact: {
    paths: ['BOT_TOKEN', '*.token', '*.phone'],
    censor: '[redacted]',
  },
});

export type Logger = typeof logger;
