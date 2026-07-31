/**
 * Ідентифікатор операції, що чекає підтвердження
 */
export type PendingId = string & { readonly __brand: 'PendingId' };

export function asPendingId(raw: string): PendingId {
  return raw as PendingId;
}
