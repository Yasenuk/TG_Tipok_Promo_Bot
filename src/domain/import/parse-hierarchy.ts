/**
 * Парсер ієрархічних списків магазинів
 */

export type HierarchyStore = {
  city: string;
  name: string;
  address: string;
};

export type HierarchyResult = {
  stores: HierarchyStore[];
  /** Міста, для яких не вказано жодної адреси */
  citiesWithoutStores: string[];
};

/** «м. Місто:» → «Місто» */
function cleanCity(raw: string): string {
  return raw
    .replace(/[:：]\s*$/, '')
    .replace(/^\s*(м\.|м|с\.|смт\.?|місто)\s+/i, '')
    .trim();
}

function stripCityPrefix(address: string, city: string): string {
  const patterns = [
    new RegExp(`^\\s*м\\.?\\s*${escapeRegex(city)}\\s*,?\\s*`, 'i'),
    new RegExp(`^\\s*${escapeRegex(city)}\\s*,\\s*`, 'i'),
  ];

  let result = address.trim();
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }

  return result.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deriveName(address: string): string {
  const firstPart = address.split(',')[0]?.trim() ?? address;
  return firstPart || address;
}

function isIndented(line: string): boolean {
  return /^[\s ]{2,}/.test(line) || /^\t/.test(line);
}

function looksLikeAddress(line: string): boolean {
  return /(вул\.|вулиц|просп|пр-т|бульв|пл\.|площ|шосе|провул|наб\.|б-р)/i.test(line);
}

export function parseHierarchy(text: string): HierarchyResult {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

  const stores: HierarchyStore[] = [];
  const cityOrder: string[] = [];
  const withStores = new Set<string>();

  let currentCity: string | undefined;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    const indented = isIndented(raw);
    const addressLike = looksLikeAddress(trimmed);

    if ((indented || addressLike) && currentCity) {
      const address = stripCityPrefix(trimmed, currentCity);
      if (!address) continue;

      stores.push({
        city: currentCity,
        name: deriveName(address),
        address,
      });
      withStores.add(currentCity);
      continue;
    }

    const city = cleanCity(trimmed);
    if (!city) continue;

    currentCity = city;
    if (!cityOrder.includes(city)) cityOrder.push(city);
  }

  return {
    stores,
    citiesWithoutStores: cityOrder.filter((c) => !withStores.has(c)),
  };
}

export function looksHierarchical(table: string[][]): boolean {
  const withManyColumns = table.filter((row) => row.length >= 3).length;
  if (withManyColumns > table.length / 2) return false;

  const flat = table.map((row) => row[0] ?? '');
  const addressLines = flat.filter((l) => looksLikeAddress(l)).length;

  return addressLines > 0;
}
