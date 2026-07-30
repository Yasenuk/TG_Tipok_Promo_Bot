import { describe, expect, it } from 'vitest';
import {
  decodeCallback,
  encodeCallback,
  type CallbackAction,
} from '../../../src/bot/keyboards/callback.js';

describe('callback_data', () => {
  const cuid = 'clx1a2b3c4d5e6f7g8h9i0j1k';

  const cases: CallbackAction[] = [
    { kind: 'city', cityId: cuid },
    { kind: 'cityPage', page: 3 },
    { kind: 'store', storeId: cuid },
    { kind: 'storePage', page: 0 },
    { kind: 'backToCities' },
    { kind: 'chooseStore', claimId: cuid },
    { kind: 'deliver', claimId: cuid },
    { kind: 'received', claimId: cuid },
    { kind: 'consentAgree' },
  ];

  it('кодування ↔ декодування без втрат', () => {
    for (const action of cases) {
      expect(decodeCallback(encodeCallback(action))).toEqual(action);
    }
  });

  it('усе вкладається в ліміт Telegram 64 байти', () => {
    for (const action of cases) {
      const encoded = encodeCallback(action);
      expect(Buffer.byteLength(encoded, 'utf8'), encoded).toBeLessThanOrEqual(64);
    }
  });

  it('чужий або застарілий формат не розпізнається', () => {
    expect(decodeCallback('9:c:abc')).toBeUndefined();  // інша версія
    expect(decodeCallback('сміття')).toBeUndefined();
    expect(decodeCallback('')).toBeUndefined();
  });
});
