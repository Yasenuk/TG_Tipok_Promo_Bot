/**
 * Нормалізація українських номерів до канонічного +380XXXXXXXXX
 */

const UA_OPERATOR_CODES = new Set([
  // Київстар
  '39', '67', '68', '96', '97', '98',
  // Vodafone
  '50', '66', '95', '99',
  // lifecell
  '63', '73', '93',
  // інші
  '91', '92', '94', '89',
]);

export function normalizeUaPhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return undefined;

  let local: string | undefined;

  if (digits.length === 12 && digits.startsWith('380')) {
    local = digits.slice(3);
  } else if (digits.length === 11 && digits.startsWith('80')) {
    local = digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('0')) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return undefined;
  }

  if (local.length !== 9) return undefined;

  const operator = local.slice(0, 2);
  if (!UA_OPERATOR_CODES.has(operator)) return undefined;

  return `+380${local}`;
}

/** Для показу людині: +380 67 123 45 67 */
export function formatPhone(normalized: string): string {
  const m = /^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(normalized);
  if (!m) return normalized;
  return `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}
