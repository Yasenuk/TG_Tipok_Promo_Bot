import ExcelJS from 'exceljs';

export type TableRow = Record<string, string>;

/**
 * Парсер CSV
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const input = text.replace(/^﻿/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === ';' || char === '\t') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);

  return rows;
}

export async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];

  sheet.eachRow((row) => {
    const values: string[] = [];

    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;

      if (v === null || v === undefined) values.push('');
      else if (typeof v === 'object' && 'text' in v) values.push(String(v.text).trim());
      else if (typeof v === 'object' && 'result' in v) values.push(String(v.result ?? '').trim());
      else values.push(String(v).trim());
    });

    if (values.some((c) => c !== '')) rows.push(values);
  });

  return rows;
}

export async function parseTable(
  buffer: Buffer,
  fileName: string,
): Promise<string[][]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseXlsx(buffer);
  }

  return parseCsv(buffer.toString('utf8'));
}

/**
 * Пошук колонки за списком можливих назв
 */
export function findColumn(
  header: readonly string[],
  aliases: readonly string[],
): number {
  const normalized = header.map((h) => h.toLowerCase().trim());

  for (const alias of aliases) {
    const index = normalized.indexOf(alias.toLowerCase());
    if (index !== -1) return index;
  }

  // Часткове співпадіння: «Назва магазину» під alias «назва»
  for (const alias of aliases) {
    const index = normalized.findIndex((h) => h.includes(alias.toLowerCase()));
    if (index !== -1) return index;
  }

  return -1;
}

/** Рядки > обʼєкти з іменованими полями */
export function toRows(
  table: string[][],
  columns: Record<string, readonly string[]>,
  optional: readonly string[] = [],
): { rows: TableRow[]; missing: string[] } {
  const [header, ...body] = table;
  if (!header) {
    return { rows: [], missing: Object.keys(columns).filter((k) => !optional.includes(k)) };
  }

  const indexes: Record<string, number> = {};
  const missing: string[] = [];

  for (const [key, aliases] of Object.entries(columns)) {
    const index = findColumn(header, aliases);
    if (index === -1) {
      if (!optional.includes(key)) missing.push(key);
    } else {
      indexes[key] = index;
    }
  }

  if (missing.length > 0) return { rows: [], missing };

  const rows = body.map((cells) => {
    const row: TableRow = {};
    for (const [key, index] of Object.entries(indexes)) {
      row[key] = cells[index]?.trim() ?? '';
    }
    return row;
  });

  return { rows, missing: [] };
}