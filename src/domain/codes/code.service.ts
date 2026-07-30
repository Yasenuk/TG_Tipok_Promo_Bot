import { prisma } from '../../db/client.js';
import { codeRepo } from '../../db/repositories/code.repo.js';
import { rateLimitRepo } from '../../db/repositories/rate-limit.repo.js';
import { evaluateAwards, validateCampaignRules } from '../rules/engine.js';
import type { PrizeSnapshot, RuleAward } from '../rules/types.js';
import { normalizeCode, looksLikeCode } from './normalize.js';
import { err, ok, type Result } from '../../shared/result.js';
import type { CodeError } from '../../shared/errors.js';
import { logger } from '../../infra/logger.js';
import type { Campaign, PrizeClaim } from '../../generated/prisma/client.js';

/** Не більше 10 невдалих спроб за 5 хв, далі бан на 15 хв */
const RL_MAX_HITS = 10;
const RL_WINDOW_MS = 5 * 60_000;
const RL_BLOCK_MS = 15 * 60_000;

export type ActivationSuccess = {
  campaign: Campaign;
  /** Скільки кодів у людини в цій кампанії ПІСЛЯ активації */
  activationCount: number;
  /** Заявки, створені за правилами кампанії */
  claims: (PrizeClaim & { prizeTitle: string })[];
  outOfStock: RuleAward[];
};

export const codeService = {
  /**
   * Активація коду
   */
  async activate(
    rawCode: string,
    userId: string,
    telegramId: bigint,
  ): Promise<Result<ActivationSuccess, CodeError>> {
    const rlKey = `code:${telegramId}`;

    const verdict = await rateLimitRepo.hit(
      rlKey,
      RL_MAX_HITS,
      RL_WINDOW_MS,
      RL_BLOCK_MS,
    );
    if (!verdict.allowed) {
      return err({ type: 'code.rate_limited', retryAfterSec: verdict.retryAfterSec });
    }

    const value = normalizeCode(rawCode);
    if (!looksLikeCode(value)) {
      return err({ type: 'code.not_found' });
    }

    const code = await codeRepo.findByValue(value);
    if (!code) {
      return err({ type: 'code.not_found' });
    }

    const { campaign } = code;

    const windowError = checkCampaignWindow(campaign);
    if (windowError) return err(windowError);

    if (code.isUsed) {
      const own = await prisma.activation.findUnique({
        where: { codeId: code.id },
        select: { userId: true, createdAt: true },
      });

      if (own?.userId === userId) {
        await rateLimitRepo.reset(rlKey);
        return err({ type: 'code.used_by_you', usedAt: own.createdAt });
      }

      return err({ type: 'code.already_used' });
    }

    const rules = validateCampaignRules(campaign.rules);

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.code.updateMany({
        where: { id: code.id, isUsed: false },
        data: { isUsed: true, usedAt: new Date() },
      });

      if (claimed.count === 0) return null;

      const participation = await tx.participation.upsert({
        where: { userId_campaignId: { userId, campaignId: campaign.id } },
        create: { userId, campaignId: campaign.id, activationCount: 1 },
        update: { activationCount: { increment: 1 } },
      });

      const activationCount = participation.activationCount;

      const activation = await tx.activation.create({
        data: {
          campaignId: campaign.id,
          userId,
          codeId: code.id,
          position: activationCount,
        },
      });

      const prizeRows = await tx.prize.findMany({
        where: { campaignId: campaign.id },
      });

      const snapshots: PrizeSnapshot[] = prizeRows.map((p) => ({
        key: p.key,
        title: p.title,
        stock: p.stock,
        reserved: p.reserved,
        issued: p.issued,
      }));

      const { awards, outOfStock } = evaluateAwards(
        {
          campaignId: campaign.id,
          userId,
          position: activationCount,
          activationCount,
          activationId: activation.id,
          prizes: snapshots,
          random: Math.random,
        },
        rules,
      );

      const claims: (PrizeClaim & { prizeTitle: string })[] = [];

      for (const award of awards) {
        const prize = prizeRows.find((p) => p.key === award.prizeKey);
        if (!prize) continue;

        // Резервуємо одразу: приз обіцяно, хоч ще не виданий
        await tx.prize.update({
          where: { id: prize.id },
          data: { reserved: { increment: 1 } },
        });

        const claim = await tx.prizeClaim.create({
          data: {
            campaignId: campaign.id,
            userId,
            prizeId: prize.id,
            status: 'AWAITING_STORE',
            source: 'THRESHOLD',
            activationId: activation.id,
          },
        });

        claims.push({ ...claim, prizeTitle: prize.title });

        logger.info(
          { claimId: claim.id, prize: prize.key, reason: award.reason },
          'приз призначено',
        );
      }

      return { activationCount, claims, outOfStock };
    });

    if (result === null) {
      return err({ type: 'code.already_used' });
    }

    await rateLimitRepo.reset(rlKey);

    return ok({
      campaign,
      activationCount: result.activationCount,
      claims: result.claims,
      outOfStock: result.outOfStock,
    });
  },

  async progress(userId: string) {
    return prisma.participation.findMany({
      where: { userId },
      include: { campaign: true },
      orderBy: { lastActivityAt: 'desc' },
    });
  },
};

function checkCampaignWindow(campaign: Campaign): CodeError | undefined {
  if (campaign.status !== 'ACTIVE') {
    return { type: 'code.campaign_inactive', campaignTitle: campaign.title };
  }

  const now = new Date();

  if (campaign.startsAt && campaign.startsAt > now) {
    return { type: 'code.campaign_not_started', startsAt: campaign.startsAt };
  }

  if (campaign.endsAt && campaign.endsAt < now) {
    return { type: 'code.campaign_ended', endsAt: campaign.endsAt };
  }

  return undefined;
}
