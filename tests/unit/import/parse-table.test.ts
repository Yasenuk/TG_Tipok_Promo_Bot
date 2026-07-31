import { describe, expect, it } from 'vitest';
import {
  findColumn,
  parseCsv,
  toRows,
} from '../../../src/domain/import/parse-table.js';

describe('parseCsv', () => {
  it('розбирає простий файл', () => {
    expect(parseCsv('місто,назва,адреса\nКиїв,Маркет,вул. Перша 1')).toEqual([
      ['місто', 'назва', 'адреса'],
      ['Київ', 'Маркет', 'вул. Перша 1'],
    ]);
  });

  it('лапки з комою всередині лишаються одним полем', () => {
    const rows = parseCsv('місто,адреса\nКиїв,"вул. Шевченка, 12"');
    expect(rows[1]).toEqual(['Київ', 'вул. Шевченка, 12']);
  });

  it('подвійні лапки всередині поля', () => {
    const rows = parseCsv('назва\n"Маркет ""Затишок"""');
    expect(rows[1]?.[0]).toBe('Маркет "Затишок"');
  });

  it('крапка з комою і таби як роздільники', () => {
    expect(parseCsv('a;b;c')[0]).toEqual(['a', 'b', 'c']);
    expect(parseCsv('a\tb\tc')[0]).toEqual(['a', 'b', 'c']);
  });

  it('BOM від Excel не ламає перший заголовок', () => {
    expect(parseCsv('﻿місто,назва')[0]).toEqual(['місто', 'назва']);
  });

  it('CRLF і порожні рядки', () => {
    const rows = parseCsv('a,b\r\n\r\nc,d\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('findColumn', () => {
  const header = ['Місто', 'Назва магазину', 'Адреса точки'];

  it('точне співпадіння без урахування регістру', () => {
    expect(findColumn(header, ['місто'])).toBe(0);
  });

  it('часткове співпадіння', () => {
    expect(findColumn(header, ['назва'])).toBe(1);
    expect(findColumn(header, ['адреса'])).toBe(2);
  });

  it('перебирає альтернативні назви', () => {
    expect(findColumn(header, ['city', 'місто'])).toBe(0);
  });

  it('-1 коли колонки немає', () => {
    expect(findColumn(header, ['телефон'])).toBe(-1);
  });
});

describe('toRows', () => {
  const COLUMNS = {
    city: ['місто', 'city'],
    name: ['назва', 'name'],
    address: ['адреса', 'address'],
  } as const;

  it('порядок колонок у файлі не має значення', () => {
    const table = [
      ['Адреса', 'Місто', 'Назва'],
      ['вул. Перша 1', 'Київ', 'Маркет'],
    ];

    const { rows } = toRows(table, COLUMNS);
    expect(rows[0]).toEqual({
      city: 'Київ',
      name: 'Маркет',
      address: 'вул. Перша 1',
    });
  });

  it('повідомляє, яких колонок бракує', () => {
    const { missing } = toRows([['Місто', 'Назва']], COLUMNS);
    expect(missing).toEqual(['address']);
  });

  it('порожня таблиця не падає', () => {
    expect(toRows([], COLUMNS).rows).toEqual([]);
  });
});
