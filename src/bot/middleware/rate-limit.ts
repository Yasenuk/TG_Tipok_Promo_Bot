import type { MiddlewareFn } from 'telegraf';
import type { AppContext } from '../context.js';

type Bucket = { hits: number; windowStart: number; warnedAt?: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10_000;
const MAX_HITS = 12;
const WARN_COOLDOWN_MS = WINDOW_MS;

/**
 * Загальний flood-control: захист від людини, що тримає кнопку
 */
export const rateLimitMiddleware: MiddlewareFn<AppContext> = async (ctx, next) => {
  if (!ctx.from) return next();

  const key = String(ctx.from.id);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { hits: 1, windowStart: now });
    return next();
  }

  bucket.hits += 1;

  if (bucket.hits <= MAX_HITS) return next();

  const shouldWarn = !bucket.warnedAt || now - bucket.warnedAt > WARN_COOLDOWN_MS;
  if (shouldWarn) {
    bucket.warnedAt = now;
    const seconds = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    ctx.log?.warn({ hits: bucket.hits }, 'flood-control');
    await ctx.reply_t('code.rate_limited', { seconds }).catch(() => undefined);
  }
};

/** Періодове прибирання, щоб Map не ріс вічно */
export function startRateLimitCleanup(intervalMs = 60_000): NodeJS.Timeout {
  const timer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 6;
    for (const [key, bucket] of buckets) {
      if (bucket.windowStart < cutoff) buckets.delete(key);
    }
  }, intervalMs);

  timer.unref();
  return timer;
}
