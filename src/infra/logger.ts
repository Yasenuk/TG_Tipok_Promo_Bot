import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import { env, isProd } from '../config/env.js';
 
const options: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: undefined,
  redact: {
    paths: [
      'token',
      '*.token',
      'phone',
      '*.phone',
      'fullName',
      '*.fullName',
      'BOT_TOKEN',
    ],
    censor: '[redacted]',
  },
};

async function createStream(): Promise<DestinationStream | undefined> {
  if (isProd) return undefined;
 
  const { default: pretty } = await import('pino-pretty');
 
  return pretty({
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname',
    destination: process.stdout,
    sync: true,
  });
}
 
const stream = await createStream();
 
export const logger = stream ? pino(options, stream) : pino(options);
 
export type Logger = typeof logger;