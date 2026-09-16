/**
 * Нормалізація коду перед пошуком у БД
 */

/**
 * Кирилиця, що виглядає як латиниця. Найчастіша причина «код не працює»:
 * людина набирає українською розкладкою, візуально все правильно.
 */
const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O',
  Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', І: 'I', Ї: 'I', Й: 'I',
};

/**
 * O/0 та I/L/1 НЕ зводимо: у кодах це різні символи,
 * і злиття робить частину надрукованих карток недійсними.
 */
export function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase();

  return [...s]
    .map((ch) => CYRILLIC_LOOKALIKES[ch] ?? ch)
    .join('')
    .replace(/[^A-Z0-9]/g, '');
}

/** Груба перевірка перед походом у базу */
export function looksLikeCode(normalized: string): boolean {
  return normalized.length >= 4 && normalized.length <= 32;
}
