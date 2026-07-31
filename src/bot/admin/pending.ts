import { randomBytes } from 'node:crypto';

/**
 * Тимчасове сховище операцій, що чекають підтвердження
 */
export type PendingKind = 'draw' | 'stores' | 'codes' | 'campaign' | string;

type Entry<T> = {
  kind: PendingKind;
  ownerId: number;
  payload: T;
  expiresAt: number;
};

const TTL_MS = 10 * 60_000;
const store = new Map<string, Entry<unknown>>();

function newId(): string {
  return randomBytes(4).toString('hex');
}

export function putPending<T>(
  kind: PendingKind,
  ownerId: number,
  payload: T,
): string {
  const id = newId();
  store.set(id, { kind, ownerId, payload, expiresAt: Date.now() + TTL_MS });
  return id;
}

export type TakeResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: 'expired' | 'not_owner' };

export function peekPendingKind(id: string): PendingKind | undefined {
  const entry = store.get(id);

  if (!entry) return undefined;

  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return undefined;
  }

  return entry.kind;
}

export function takePending<T>(
  id: string,
  kind: PendingKind,
  userId: number,
): TakeResult<T> {
  const entry = store.get(id);

  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(id);
    return { ok: false, reason: 'expired' };
  }

  if (entry.kind !== kind) {
    return { ok: false, reason: 'expired' };
  }

  if (entry.ownerId !== userId) {
    return { ok: false, reason: 'not_owner' };
  }

  store.delete(id);
  return { ok: true, payload: entry.payload as T };
}

export function dropPending(id: string): void {
  store.delete(id);
}

export function startPendingCleanup(intervalMs = 60_000): NodeJS.Timeout {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of store) {
      if (entry.expiresAt < now) store.delete(id);
    }
  }, intervalMs);

  timer.unref();
  return timer;
}
