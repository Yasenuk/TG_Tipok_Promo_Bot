import { Composer, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import type { AppContext } from '../context.js';
import { isSuperAdmin } from './guard.js';
import { downloadDocument } from '../../infra/telegram-files.js';
import {
  applyStoreImport,
  previewStoreImport,
  type StoreImportPreview,
} from '../../domain/import/store-import.js';
import { parseTable } from '../../domain/import/parse-table.js';
import { normalizeCode, looksLikeCode } from '../../domain/codes/normalize.js';
import { codeRepo } from '../../db/repositories/code.repo.js';
import { campaignRepo } from '../../db/repositories/campaign.repo.js';
import { putPending, takePending } from './pending.js';
import { encodeCallback } from '../keyboards/callback.js';

export const importHandler = new Composer<AppContext>();

type CodesPending = {
  campaignId: string;
  campaignTitle: string;
  fresh: string[];
  batchName?: string;
};

function confirmKeyboard(pendingId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Залити', encodeCallback({ kind: 'confirm', pendingId })),
      Markup.button.callback('✖️ Скасувати', encodeCallback({ kind: 'cancel', pendingId })),
    ],
  ]);
}

/**
 * Імпорт файлом: документ із підписом /import_stores або /import_codes <slug>
 */
importHandler.on(message('document'), async (ctx, next) => {
  const caption = ctx.message.caption?.trim() ?? '';
  if (!caption.startsWith('/import_')) return next();

  if (!(await isSuperAdmin(ctx.from.id))) return;

  const [command, ...args] = caption.split(/\s+/);
  const doc = ctx.message.document;

  const downloaded = await downloadDocument(
    ctx.telegram,
    doc.file_id,
    doc.file_size,
  );

  if (!downloaded.ok) {
    await ctx.reply(
      downloaded.reason === 'too_large'
        ? '❌ Файл більший за 20 МБ'
        : '❌ Не вдалося завантажити файл. Спробуй ще раз.',
    );
    return;
  }

  const fileName = doc.file_name ?? 'file.csv';

  if (command === '/import_stores' || command === '/import_stores@' + ctx.botInfo.username) {
    await handleStores(ctx, downloaded.buffer, fileName);
    return;
  }

  if (command?.startsWith('/import_codes')) {
    await handleCodes(ctx, downloaded.buffer, fileName, args[0], args[1]);
    return;
  }

  await ctx.reply(
    'Невідома команда імпорту.\n\n' +
      '/import_stores — магазини (колонки: місто, назва, адреса)\n' +
      '/import_codes <slug> [партія] — коди (одна колонка)',
  );
});

async function handleStores(
  ctx: AppContext,
  buffer: Buffer,
  fileName: string,
): Promise<void> {
  const preview = await previewStoreImport(buffer, fileName);

  if (!preview.ok) {
    if (preview.reason === 'missing_columns') {
      await ctx.reply(
        `❌ У файлі немає колонок: ${preview.missing?.join(', ')}\n\n` +
          'Очікую заголовки (у будь-якому порядку):\n' +
          '• місто / city\n• назва / магазин / name\n• адреса / address',
      );
      return;
    }
    await ctx.reply('❌ Файл порожній або не читається.');
    return;
  }

  if (preview.stores.length === 0) {
    await ctx.reply('❌ Жодного придатного рядка. Перевір, чи заповнені всі три колонки.');
    return;
  }

  const pendingId = putPending<StoreImportPreview>('stores', ctx.from.id, preview);

  const lines = [
    '📍 <b>Імпорт магазинів</b>',
    '',
    `Магазинів у файлі: <b>${preview.stores.length}</b>`,
    `Міст: <b>${preview.cities.length}</b>${preview.newCities.length ? ` (нових: ${preview.newCities.length})` : ''}`,
  ];

  if (preview.newCities.length) {
    lines.push(`Нові міста: ${preview.newCities.slice(0, 10).join(', ')}`);
  }
  if (preview.duplicates) lines.push(`⚠️ Дублів у файлі: ${preview.duplicates}`);
  if (preview.skipped) lines.push(`⚠️ Пропущено неповних рядків: ${preview.skipped}`);

  lines.push('', '<b>Приклад:</b>');
  for (const store of preview.stores.slice(0, 3)) {
    lines.push(`• ${store.city} — ${store.name}, ${store.address}`);
  }

  lines.push('', '<i>Наявні магазини не видаляються, лише додаються нові.</i>');

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    ...confirmKeyboard(pendingId),
  });
}

async function handleCodes(
  ctx: AppContext,
  buffer: Buffer,
  fileName: string,
  slug?: string,
  batchName?: string,
): Promise<void> {
  if (!slug) {
    await ctx.reply('Вкажи кампанію: /import_codes <slug> [назва партії]');
    return;
  }

  const campaign = await campaignRepo.findBySlug(slug);
  if (!campaign) {
    await ctx.reply(`❌ Кампанію «${slug}» не знайдено.`);
    return;
  }

  const table = await parseTable(buffer, fileName);
  const lines = table.map((row) => row[0]?.trim() ?? '').filter(Boolean);

  // Заголовок відсіюємо, якщо перший рядок не схожий на код
  const first = lines[0];
  if (first && !looksLikeCode(normalizeCode(first))) lines.shift();

  const seen = new Set<string>();
  const valid: string[] = [];
  let invalid = 0;
  let dupInFile = 0;

  for (const line of lines) {
    const normalized = normalizeCode(line);

    if (!looksLikeCode(normalized)) {
      invalid++;
      continue;
    }
    if (seen.has(normalized)) {
      dupInFile++;
      continue;
    }

    seen.add(normalized);
    valid.push(line);
  }

  const existing = await codeRepo.findExistingValues(valid);
  const fresh = valid.filter((v) => !existing.has(normalizeCode(v)));
  const collisions = valid.length - fresh.length;

  const collapsed = valid.filter(
    (v) => normalizeCode(v) !== v.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
  );

  if (fresh.length === 0) {
    await ctx.reply(
      `Нічого імпортувати.\n\nУ файлі: ${lines.length}\n` +
        `Вже в базі: ${collisions}\nНекоректних: ${invalid}`,
    );
    return;
  }

  const pendingId = putPending<CodesPending>('codes', ctx.from.id, {
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    fresh,
    ...(batchName ? { batchName } : {}),
  });

  const report = [
    '🎟 <b>Імпорт кодів</b>',
    '',
    `Кампанія: <b>${campaign.title}</b>`,
    batchName ? `Партія: ${batchName}` : '',
    '',
    `✅ До імпорту: <b>${fresh.length}</b>`,
    collisions ? `⚠️ Вже існують: ${collisions}` : '',
    dupInFile ? `⚠️ Дублі у файлі: ${dupInFile}` : '',
    invalid ? `❌ Некоректні: ${invalid}` : '',
  ].filter(Boolean);

  if (collapsed.length) {
    report.push(
      '',
      `⚠️ <b>${collapsed.length} кодів змінились при нормалізації</b> (O→0, I→1, L→1):`,
      ...collapsed.slice(0, 3).map((c) => `   <code>${c}</code> → <code>${normalizeCode(c)}</code>`),
      '<i>Це не помилка: пошук іде за правим варіантом, у вигрузці — лівий.</i>',
    );
  }

  report.push('', `<b>Приклад:</b> ${fresh.slice(0, 3).join(', ')}`);

  await ctx.reply(report.join('\n'), {
    parse_mode: 'HTML',
    ...confirmKeyboard(pendingId),
  });
}

/** Підтвердження імпорту магазинів */
export async function confirmStoresImport(
  ctx: AppContext,
  pendingId: string,
): Promise<void> {
  const taken = takePending<StoreImportPreview>('stores', pendingId, ctx.from!.id);

  if (!taken.ok) {
    await ctx.answerCbQuery(
      taken.reason === 'not_owner'
        ? 'Підтвердити може лише той, хто надіслав файл'
        : 'Термін підтвердження минув — надішли файл ще раз',
      { show_alert: true },
    );
    return;
  }

  await ctx.answerCbQuery('Заливаю…');
  await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

  const result = await applyStoreImport(taken.payload);

  await ctx.reply(
    `✅ Готово\n\n` +
      `Міст створено: ${result.citiesCreated}\n` +
      `Магазинів додано: ${result.storesCreated}\n` +
      `Увімкнено раніше вимкнених: ${result.storesUpdated}`,
  );

  ctx.log?.info({ ...result }, 'імпорт магазинів');
}

/** Підтвердження імпорту кодів */
export async function confirmCodesImport(
  ctx: AppContext,
  pendingId: string,
): Promise<void> {
  const taken = takePending<CodesPending>('codes', pendingId, ctx.from!.id);

  if (!taken.ok) {
    await ctx.answerCbQuery(
      taken.reason === 'not_owner'
        ? 'Підтвердити може лише той, хто надіслав файл'
        : 'Термін підтвердження минув — надішли файл ще раз',
      { show_alert: true },
    );
    return;
  }

  await ctx.answerCbQuery('Заливаю…');
  await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

  const { campaignId, campaignTitle, fresh, batchName } = taken.payload;

  const imported = await codeRepo.importMany(
    fresh.map((raw) => ({ raw, campaignId, batchName })),
  );

  await ctx.reply(`🎉 Імпортовано ${imported} кодів у «${campaignTitle}»`);
  ctx.log?.info({ imported, campaignId }, 'імпорт кодів');
}
