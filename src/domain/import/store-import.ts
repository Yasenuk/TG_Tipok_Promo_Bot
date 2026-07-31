import { prisma } from '../../db/client.js';
import { parseTable, toRows } from './parse-table.js';

const COLUMNS = {
  city: ['місто', 'city', 'населений пункт', 'нас. пункт'],
  name: ['назва', 'магазин', 'name', 'store', 'точка'],
  address: ['адреса', 'address', 'вулиця'],
} as const;

export type StoreImportPreview = {
  ok: true;
  cities: string[];
  newCities: string[];
  stores: { city: string; name: string; address: string }[];
  duplicates: number;
  skipped: number;
};

export type StoreImportError = {
  ok: false;
  reason: 'empty' | 'missing_columns';
  missing?: string[];
};

/**
 * Розбір файлу БЕЗ запису в базу
 */
export async function previewStoreImport(
  buffer: Buffer,
  fileName: string,
): Promise<StoreImportPreview | StoreImportError> {
  const table = await parseTable(buffer, fileName);
  if (table.length < 2) return { ok: false, reason: 'empty' };

  const { rows, missing } = toRows(table, COLUMNS);
  if (missing.length > 0) return { ok: false, reason: 'missing_columns', missing };

  const seen = new Set<string>();
  const stores: { city: string; name: string; address: string }[] = [];
  let duplicates = 0;
  let skipped = 0;

  for (const row of rows) {
    const city = row.city?.trim() ?? '';
    const name = row.name?.trim() ?? '';
    const address = row.address?.trim() ?? '';

    if (!city || !name || !address) {
      skipped++;
      continue;
    }

    // Один магазин = місто + назва + адреса
    const key = `${city}|${name}|${address}`.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }

    seen.add(key);
    stores.push({ city, name, address });
  }

  const cities = [...new Set(stores.map((s) => s.city))];

  const existing = await prisma.city.findMany({
    where: { name: { in: cities } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((c) => c.name));

  return {
    ok: true,
    cities,
    newCities: cities.filter((c) => !existingNames.has(c)),
    stores,
    duplicates,
    skipped,
  };
}

export type StoreImportResult = {
  citiesCreated: number;
  storesCreated: number;
  storesUpdated: number;
};

/**
 * Застосування імпорту
 */
export async function applyStoreImport(
  preview: StoreImportPreview,
): Promise<StoreImportResult> {
  const result: StoreImportResult = {
    citiesCreated: 0,
    storesCreated: 0,
    storesUpdated: 0,
  };

  const cityIds = new Map<string, string>();

  for (const [index, name] of preview.cities.entries()) {
    const existing = await prisma.city.findUnique({ where: { name } });

    if (existing) {
      cityIds.set(name, existing.id);
      continue;
    }

    const created = await prisma.city.create({
      data: { name, sortOrder: index },
    });
    cityIds.set(name, created.id);
    result.citiesCreated++;
  }

  for (const store of preview.stores) {
    const cityId = cityIds.get(store.city);
    if (!cityId) continue;

    const existing = await prisma.store.findFirst({
      where: { cityId, name: store.name, address: store.address },
    });

    if (existing) {
      if (!existing.isActive) {
        await prisma.store.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
        result.storesUpdated++;
      }
      continue;
    }

    await prisma.store.create({
      data: { cityId, name: store.name, address: store.address },
    });
    result.storesCreated++;
  }

  return result;
}
