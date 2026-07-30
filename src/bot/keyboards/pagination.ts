import { Markup } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/types';

export const PAGE_SIZE = 8;

export type PaginatedItem = { id: string; label: string };

export type PaginationOptions = {
  page: number;
  encodeItem: (id: string) => string;
  encodePage: (page: number) => string;
  /** Додатковий рядок кнопок унизу, наприклад «Назад» */
  footer?: InlineKeyboardButton[];
  pageSize?: number;
};

/**
 * Універсальна пагінація інлайн-кнопок
 */
export function paginatedKeyboard(
  items: PaginatedItem[],
  options: PaginationOptions,
) {
  const size = options.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(options.page, 0), totalPages - 1);

  const slice = items.slice(page * size, page * size + size);

  const rows: InlineKeyboardButton[][] = slice.map((item) => [
    Markup.button.callback(item.label, options.encodeItem(item.id)),
  ]);

  if (totalPages > 1) {
    const nav: InlineKeyboardButton[] = [];

    if (page > 0) {
      nav.push(Markup.button.callback('‹', options.encodePage(page - 1)));
    }

    nav.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'));

    if (page < totalPages - 1) {
      nav.push(Markup.button.callback('›', options.encodePage(page + 1)));
    }

    rows.push(nav);
  }

  if (options.footer?.length) rows.push(options.footer);

  return Markup.inlineKeyboard(rows);
}
