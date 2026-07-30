import { prisma } from '../../db/client.js';
import { env } from '../../config/env.js';
import type { AdminRole } from '../../generated/prisma/client.js';

/**
 * Кеш адмінів: перевірка йде на кожне натискання кнопки в адмін-групі
 */
const TTL_MS = 30_000;
let cache: { at: number; admins: Map<string, AdminRole> } | undefined;

async function loadAdmins(): Promise<Map<string, AdminRole>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.admins;

  const rows = await prisma.admin.findMany({ where: { isActive: true } });
  const admins = new Map<string, AdminRole>(
    rows.map((a) => [a.telegramId.toString(), a.role]),
  );
  
  for (const id of env.SUPER_ADMIN_IDS) {
    admins.set(id.toString(), 'SUPER');
  }

  cache = { at: Date.now(), admins };
  return admins;
}

export async function getAdminRole(
  telegramId: bigint | number,
): Promise<AdminRole | undefined> {
  const admins = await loadAdmins();
  return admins.get(telegramId.toString());
}

export async function isAdmin(telegramId: bigint | number): Promise<boolean> {
  return (await getAdminRole(telegramId)) !== undefined;
}

export async function isSuperAdmin(telegramId: bigint | number): Promise<boolean> {
  return (await getAdminRole(telegramId)) === 'SUPER';
}

export function invalidateAdminCache(): void {
  cache = undefined;
}
