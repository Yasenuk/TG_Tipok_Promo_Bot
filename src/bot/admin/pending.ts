import { randomBytes } from 'node:crypto';
import { prisma } from '../../db/client.js';
import { logger } from '../../infra/logger.js';

export type PendingKind = 'draw' | 'stores' | 'codes' | 'campaign' | 'file';

const TTL_MS = 10 * 60_000;

export type TakeResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: 'expired' | 'not_owner' };

function newId(): string {
  return randomBytes(4).toString('hex');
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      typeof v === 'bigint' ? `${v.toString()}n` : v,
    ),
  );
}

function deserialize<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value), (_key, v: unknown) => {
    if (typeof v === 'string' && /^-?\d+n$/.test(v)) {
      return BigInt(v.slice(0, -1));
    }
    return v;
  }) as T;
}

export async function putPending<T>(
  kind: PendingKind,
  ownerId: number,
  payload: T,
): Promise<string> {
  const id = newId();

  await prisma.pendingAction.create({
    data: {
      id,
      kind,
      ownerId: BigInt(ownerId),
      payload: serialize(payload) as never,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  return id;
}

export async function peekPendingKind(
  id: string,
): Promise<PendingKind | undefined> {
  const entry = await prisma.pendingAction.findUnique({ where: { id } });

  if (!entry) return undefined;

  if (entry.expiresAt < new Date()) {
    await dropPending(id);
    return undefined;
  }

  return entry.kind as PendingKind;
}

export async function readPending<T>(
  id: string,
  kind: PendingKind,
  userId: number,
): Promise<TakeResult<T>> {
  const entry = await prisma.pendingAction.findUnique({ where: { id } });

  if (!entry || entry.kind !== kind || entry.expiresAt < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  if (entry.ownerId !== BigInt(userId)) return { ok: false, reason: 'not_owner' };

  return { ok: true, payload: deserialize<T>(entry.payload) };
}

export async function takePending<T>(
  id: string,
  kind: PendingKind,
  userId: number,
): Promise<TakeResult<T>> {
  const entry = await prisma.pendingAction.findUnique({ where: { id } });

  if (!entry || entry.expiresAt < new Date()) {
    await dropPending(id);
    return { ok: false, reason: 'expired' };
  }

  if (entry.kind !== kind) return { ok: false, reason: 'expired' };

  if (entry.ownerId !== BigInt(userId)) return { ok: false, reason: 'not_owner' };

  const deleted = await prisma.pendingAction.deleteMany({ where: { id } });
  if (deleted.count === 0) return { ok: false, reason: 'expired' };

  return { ok: true, payload: deserialize<T>(entry.payload) };
}

export async function overwritePending<T>(id: string, payload: T): Promise<void> {
  await prisma.pendingAction
    .update({
      where: { id },
      data: {
        payload: serialize(payload) as never,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    })
    .catch(() => undefined);
}

export async function dropPending(id: string): Promise<void> {
  await prisma.pendingAction.deleteMany({ where: { id } });
}

export function startPendingCleanup(intervalMs = 5 * 60_000): NodeJS.Timeout {
  const timer = setInterval(() => {
    void prisma.pendingAction
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch((error: unknown) => {
        logger.warn({ error }, 'не вдалося прибрати прострочені підтвердження');
      });
  }, intervalMs);

  timer.unref();
  return timer;
}
