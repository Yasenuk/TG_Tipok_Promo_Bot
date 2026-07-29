import { env } from '../config/env.js';

console.log('Оточення валідне:\n');
console.table({
  NODE_ENV: env.NODE_ENV,
  LOG_LEVEL: env.LOG_LEVEL,
  BOT_TOKEN: `${env.BOT_TOKEN.slice(0, 8)}… (${env.BOT_TOKEN.length} симв.)`,
  ADMIN_CHAT_ID: env.ADMIN_CHAT_ID.toString(),
  SUPER_ADMIN_IDS: env.SUPER_ADMIN_IDS.map(String).join(', ') || '(порожньо)',
  DATABASE_URL: env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@'),
});
