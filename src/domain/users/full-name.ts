/**
 * Валідація ПІБ
 */

const NAME_PART = /^[\p{L}][\p{L}'’\-]{1,}$/u;

export type FullNameResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'too_few_parts' | 'invalid_chars' | 'too_long' };

export function validateFullName(raw: string): FullNameResult {
  const cleaned = raw.trim().replace(/\s+/g, ' ');

  if (cleaned.length > 120) return { ok: false, reason: 'too_long' };

  const parts = cleaned.split(' ');
  if (parts.length < 2) return { ok: false, reason: 'too_few_parts' };
  if (parts.length > 4) return { ok: false, reason: 'invalid_chars' };

  for (const part of parts) {
    if (!NAME_PART.test(part)) return { ok: false, reason: 'invalid_chars' };
  }

  const normalized = parts
    .map((p) => p.charAt(0).toLocaleUpperCase('uk') + p.slice(1))
    .join(' ');

  return { ok: true, value: normalized };
}
