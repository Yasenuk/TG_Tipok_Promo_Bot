import { describe, expect, it } from 'vitest';
import { formatPhone, normalizeUaPhone } from '../../../src/domain/users/phone.js';

describe('normalizeUaPhone', () => {
  it('зводить усі формати до +380XXXXXXXXX', () => {
    const variants = [
      '+380671234567',
      '380671234567',
      '80671234567',
      '0671234567',
      '671234567',
      '+38 (067) 123-45-67',
      '8-067-123-45-67',
      ' 067 123 45 67 ',
    ];
    for (const raw of variants) {
      expect(normalizeUaPhone(raw), raw).toBe('+380671234567');
    }
  });

  it('приймає всі живі коди операторів', () => {
    for (const code of ['39', '50', '63', '66', '67', '68', '73', '91', '93', '95', '96', '97', '98', '99']) {
      expect(normalizeUaPhone(`0${code}1234567`), code).toBe(`+380${code}1234567`);
    }
  });

  it('відсіює сміття', () => {
    for (const raw of ['', 'абв', '123', '+7 999 123 45 67', '0111234567', '06712345678', '067123456']) {
      expect(normalizeUaPhone(raw), raw).toBeUndefined();
    }
  });

  it('formatPhone робить читабельний вигляд', () => {
    expect(formatPhone('+380671234567')).toBe('+380 67 123 45 67');
  });
});
