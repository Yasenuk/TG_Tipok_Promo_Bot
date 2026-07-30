import { prisma } from '../client.js';
import type { Campaign, Code } from '../../generated/prisma/client.js';

export type CodeWithCampaign = Code & { campaign: Campaign };

export const codeRepo = {
  /** Код сам вказує на кампанію */
  findByValue(value: string): Promise<CodeWithCampaign | null> {
    return prisma.code.findUnique({
      where: { value },
      include: { campaign: true },
    });
  },

  countByCampaign(campaignId: string) {
    return prisma.code.groupBy({
      by: ['isUsed'],
      where: { campaignId },
      _count: { _all: true },
    });
  },

  /**
   * Масовий імпорт
   */
  async importMany(
    rows: { value: string; campaignId: string; batchName?: string }[],
  ): Promise<number> {
    const result = await prisma.code.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  },

  /** Які з цих value вже є в базі — щоб показати колізії перед імпортом */
  async findExistingValues(values: string[]): Promise<Set<string>> {
    const found = await prisma.code.findMany({
      where: { value: { in: values } },
      select: { value: true },
    });
    return new Set(found.map((r) => r.value));
  },
};
