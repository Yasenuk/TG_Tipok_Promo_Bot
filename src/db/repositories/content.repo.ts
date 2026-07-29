import { prisma } from '../client.js';

export const contentRepo = {
  async resolve(
    key: string,
    campaignId: string | null,
    locale = 'uk',
  ): Promise<string | undefined> {
    const rows = await prisma.content.findMany({
      where: {
        key,
        locale,
        OR: [{ campaignId }, { campaignId: null }],
      },
      select: { value: true, campaignId: true },
    });

    if (rows.length === 0) return undefined;

    const specific = rows.find((r) => r.campaignId !== null);
    return (specific ?? rows[0])?.value;
  },

  async set(
    key: string,
    value: string,
    campaignId: string | null,
    locale = 'uk',
    updatedBy?: bigint,
  ): Promise<void> {
    const existing = await prisma.content.findFirst({
      where: { key, locale, campaignId },
      select: { id: true },
    });

    if (existing) {
      await prisma.content.update({
        where: { id: existing.id },
        data: { value, updatedBy },
      });
      return;
    }

    await prisma.content.create({
      data: { key, value, locale, campaignId, updatedBy },
    });
  },

  async listKeys(campaignId: string | null, locale = 'uk') {
    return prisma.content.findMany({
      where: { campaignId, locale },
      select: { key: true, value: true, updatedAt: true },
      orderBy: { key: 'asc' },
    });
  },
};
