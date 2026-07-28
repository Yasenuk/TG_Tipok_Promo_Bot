import { z } from 'zod';

const idList = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => BigInt(s)),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN порожній'),

  ADMIN_CHAT_ID: z.coerce.bigint(),
  SUPER_ADMIN_IDS: idList,

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`\nНекоректний .env:\n${issues}\n`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
