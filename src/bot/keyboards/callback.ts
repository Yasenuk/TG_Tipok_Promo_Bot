/**
 * Типізований callback_data
 */

export const CB_VERSION = '1';

export type CallbackAction =
  | { kind: 'city'; cityId: string }
  | { kind: 'cityPage'; page: number }
  | { kind: 'store'; storeId: string }
  | { kind: 'storePage'; page: number }
  | { kind: 'backToCities' }
  | { kind: 'chooseStore'; claimId: string }
  | { kind: 'deliver'; claimId: string }
  | { kind: 'received'; claimId: string }
  | { kind: 'consentAgree' }
  | { kind: 'confirm'; pendingId: string }
  | { kind: 'cancel'; pendingId: string };

const SEP = ':';

export function encodeCallback(action: CallbackAction): string {
  const body = ((): string => {
    switch (action.kind) {
      case 'city':
        return `c${SEP}${action.cityId}`;
      case 'cityPage':
        return `cp${SEP}${action.page}`;
      case 'store':
        return `s${SEP}${action.storeId}`;
      case 'storePage':
        return `sp${SEP}${action.page}`;
      case 'backToCities':
        return 'bc';
      case 'chooseStore':
        return `cs${SEP}${action.claimId}`;
      case 'deliver':
        return `d${SEP}${action.claimId}`;
      case 'received':
        return `r${SEP}${action.claimId}`;
      case 'consentAgree':
        return 'ok';
      case 'confirm':
        return `y${SEP}${action.pendingId}`;
      case 'cancel':
        return `n${SEP}${action.pendingId}`;
    }
  })();

  const encoded = `${CB_VERSION}${SEP}${body}`;

  if (Buffer.byteLength(encoded, 'utf8') > 64) {
    throw new Error(`callback_data > 64 байт: ${encoded}`);
  }

  return encoded;
}

export function decodeCallback(raw: string): CallbackAction | undefined {
  const [version, kind, ...rest] = raw.split(SEP);
  if (version !== CB_VERSION || !kind) return undefined;

  const arg = rest.join(SEP);

  switch (kind) {
    case 'c':
      return arg ? { kind: 'city', cityId: arg } : undefined;
    case 'cp':
      return { kind: 'cityPage', page: Number(arg) || 0 };
    case 's':
      return arg ? { kind: 'store', storeId: arg } : undefined;
    case 'sp':
      return { kind: 'storePage', page: Number(arg) || 0 };
    case 'bc':
      return { kind: 'backToCities' };
    case 'cs':
      return arg ? { kind: 'chooseStore', claimId: arg } : undefined;
    case 'd':
      return arg ? { kind: 'deliver', claimId: arg } : undefined;
    case 'r':
      return arg ? { kind: 'received', claimId: arg } : undefined;
    case 'ok':
      return { kind: 'consentAgree' };
    case 'y':
      return arg ? { kind: 'confirm', pendingId: arg } : undefined;
    case 'n':
      return arg ? { kind: 'cancel', pendingId: arg } : undefined;
    default:
      return undefined;
  }
}