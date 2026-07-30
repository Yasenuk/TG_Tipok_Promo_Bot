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
 * Неоднозначні символи зводимо до одного варіанту.
 * Якщо коди ще друкуються — краще взагалі виключити O/0/I/1 з алфавіту.
 */
const AMBIGUOUS: Record<string, string> = {
  O: '0',
  I: '1',
  L: '1',
};

export function normalizeCode(raw: string): string {
  let s = raw.trim().toUpperCase();

  s = [...s].map((ch) => CYRILLIC_LOOKALIKES[ch] ?? ch).join('');
  s = s.replace(/[^A-Z0-9]/g, '');
  s = [...s].map((ch) => AMBIGUOUS[ch] ?? ch).join('');

  return s;
}

/** Груба перевірка перед походом у базу */
export function looksLikeCode(normalized: string): boolean {
  return normalized.length >= 4 && normalized.length <= 32;
}
