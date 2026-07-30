import { prisma } from '../client.js';
import { normalizeCode } from '../../domain/codes/normalize.js';
import type { Campaign, Code } from '../../generated/prisma/client.js';

export type CodeWithCampaign = Code & { campaign: Campaign };

export type CodeImportRow = {
  raw: string;
  campaignId: string;
  batchName?: string | undefined;
};

export const codeRepo = {
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
  async importMany(rows: CodeImportRow[]): Promise<number> {
    const data = rows.map((row) => ({
      value: normalizeCode(row.raw),
      displayValue: row.raw.trim(),
      campaignId: row.campaignId,
      ...(row.batchName ? { batchName: row.batchName } : {}),
    }));

    const result = await prisma.code.createMany({ data, skipDuplicates: true });
    return result.count;
  },

  async findExistingValues(rawValues: string[]): Promise<Set<string>> {
    const normalized = rawValues.map(normalizeCode);

    const found = await prisma.code.findMany({
      where: { value: { in: normalized } },
      select: { value: true },
    });

    return new Set(found.map((r) => r.value));
  },
};
