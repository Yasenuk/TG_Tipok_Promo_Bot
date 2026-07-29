import { DEFAULT_CONTENT, type ContentKey } from './defaults.uk.js';
import { contentRepo } from '../../db/repositories/content.repo.js';
import { logger } from '../../infra/logger.js';

export type ContentParams = Record<string, string | number>;

type CacheEntry = { value: string; expiresAt: number };

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

const cacheKey = (key: string, campaignId: string | null, locale: string) =>
  `${campaignId ?? '~global'}:${locale}:${key}`;

export function interpolate(template: string, params?: ContentParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export async function t(
  key: ContentKey,
  params?: ContentParams,
  opts?: { campaignId?: string | null; locale?: string },
): Promise<string> {
  const campaignId = opts?.campaignId ?? null;
  const locale = opts?.locale ?? 'uk';
  const ck = cacheKey(key, campaignId, locale);

  const cached = cache.get(ck);
  if (cached && cached.expiresAt > Date.now()) {
    return interpolate(cached.value, params);
  }

  let value: string | undefined;
  try {
    value = await contentRepo.resolve(key, campaignId, locale);
  } catch (error) {
    logger.error({ error, key }, 'Не вдалося прочитати текст із БД');
  }

  const resolved = value ?? DEFAULT_CONTENT[key];
  cache.set(ck, { value: resolved, expiresAt: Date.now() + TTL_MS });

  return interpolate(resolved, params);
}

/** Викликати після /text set, щоб зміна була видна одразу */
export function invalidateContentCache(key?: ContentKey): void {
  if (!key) {
    cache.clear();
    return;
  }
  for (const ck of cache.keys()) {
    if (ck.endsWith(`:${key}`)) cache.delete(ck);
  }
}

export const contentService = { t, invalidateContentCache, interpolate };
