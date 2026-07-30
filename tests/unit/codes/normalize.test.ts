import { describe, expect, it } from 'vitest';
import { looksLikeCode, normalizeCode } from '../../../src/domain/codes/normalize.js';

describe('normalizeCode', () => {
  it('прибирає роздільники й піднімає регістр', () => {
    expect(normalizeCode('hy-4f2a')).toBe('HY4F2A');
    expect(normalizeCode(' hy 4f 2a ')).toBe('HY4F2A');
    expect(normalizeCode('HY_4F2A')).toBe('HY4F2A');
  });

  it('рятує від української розкладки', () => {
    expect(normalizeCode('АВЕКМНРСТУХ')).toBe('ABEKMHPCTYX');
    expect(normalizeCode('НУ4А')).toBe('HY4A');
  });

  it('зводить неоднозначні символи', () => {
    expect(normalizeCode('OI')).toBe('01');
    expect(normalizeCode('O0I1')).toBe('0011');
    expect(normalizeCode('LOL')).toBe('101');
  });

  it('однаковий результат для всіх варіантів запису', () => {
    const variants = ['hy-0abc', 'HY 0ABC', 'hy_oabc', 'HY-OABC'];
    expect(new Set(variants.map(normalizeCode)).size).toBe(1);
  });

  it('кириличний і латинський запис сходяться', () => {
    expect(normalizeCode('НУ0АВС')).toBe(normalizeCode('HY0ABC'));
  });

  it('looksLikeCode відсіює короткі й довгі', () => {
    expect(looksLikeCode('ABC')).toBe(false);
    expect(looksLikeCode('ABCD')).toBe(true);
    expect(looksLikeCode('A'.repeat(32))).toBe(true);
    expect(looksLikeCode('A'.repeat(33))).toBe(false);
  });
});
