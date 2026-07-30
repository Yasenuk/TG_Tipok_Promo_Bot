import { randomBytes } from 'node:crypto';
import { prisma } from '../../db/client.js';
import { createSeededRandom, shuffle } from './random.js';
import { logger } from '../../infra/logger.js';

export type Ticket = {
  activationId: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  telegramId: bigint;
  codeValue: string;
};

export type DrawWinnerResult = {
  activationId: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  telegramId: bigint;
  codeValue: string;
  prizeKey: string;
  prizeTitle: string;
};

export type DrawPlan = {
  seed: string;
  totalTickets: number;
  uniqueParticipants: number;
  winners: DrawWinnerResult[];
};

export const drawService = {
  generateSeed(): string {
    return randomBytes(16).toString('hex');
  },

  async loadTickets(campaignId: string): Promise<Ticket[]> {
    const activations = await prisma.activation.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        code: { select: { value: true } },
        user: {
          select: { fullName: true, phone: true, telegramId: true, isBlocked: true },
        },
      },
    });

    return activations
      .filter((a) => !a.user.isBlocked)
      .map((a) => ({
        activationId: a.id,
        userId: a.userId,
        fullName: a.user.fullName,
        phone: a.user.phone,
        telegramId: a.user.telegramId,
        codeValue: a.code.value,
      }));
  },

  plan(
    tickets: readonly Ticket[],
    prizes: readonly { key: string; title: string; count: number }[],
    seed: string,
    options: { uniqueWinners: boolean },
  ): DrawPlan {
    const random = createSeededRandom(seed);
    const shuffled = shuffle(tickets, random);

    const winners: DrawWinnerResult[] = [];
    const usedUsers = new Set<string>();
    let cursor = 0;

    for (const prize of prizes) {
      for (let i = 0; i < prize.count; i++) {
        // Шукаємо наступний придатний квиток
        while (cursor < shuffled.length) {
          const ticket = shuffled[cursor];
          cursor++;

          if (!ticket) continue;
          if (options.uniqueWinners && usedUsers.has(ticket.userId)) continue;

          usedUsers.add(ticket.userId);
          winners.push({
            ...ticket,
            prizeKey: prize.key,
            prizeTitle: prize.title,
          });
          break;
        }
      }
    }

    return {
      seed,
      totalTickets: tickets.length,
      uniqueParticipants: new Set(tickets.map((t) => t.userId)).size,
      winners,
    };
  },

  /** Фіксація результату в БД + створення заявок на призи */
  async commit(
    campaignId: string,
    name: string,
    plan: DrawPlan,
    createdBy?: bigint,
  ): Promise<string> {
    const prizeRows = await prisma.prize.findMany({ where: { campaignId } });
    const prizeByKey = new Map(prizeRows.map((p) => [p.key, p]));

    const drawId = await prisma.$transaction(async (tx) => {
      const draw = await tx.draw.create({
        data: {
          campaignId,
          name,
          seed: plan.seed,
          totalActivations: plan.totalTickets,
          createdBy: createdBy ?? null,
        },
      });

      for (const winner of plan.winners) {
        const prize = prizeByKey.get(winner.prizeKey);
        if (!prize) continue;

        const drawWinner = await tx.drawWinner.create({
          data: {
            drawId: draw.id,
            userId: winner.userId,
            activationId: winner.activationId,
            prizeId: prize.id,
          },
        });

        // Резерв під приз, який ще не видано
        await tx.prize.update({
          where: { id: prize.id },
          data: { reserved: { increment: 1 } },
        });

        await tx.prizeClaim.create({
          data: {
            campaignId,
            userId: winner.userId,
            prizeId: prize.id,
            status: 'AWAITING_STORE',
            source: 'DRAW',
            drawWinnerId: drawWinner.id,
          },
        });
      }

      return draw.id;
    });

    logger.info(
      { drawId, winners: plan.winners.length, seed: plan.seed },
      'розіграш зафіксовано',
    );

    return drawId;
  },

  async findDraw(drawId: string) {
    return prisma.draw.findUnique({
      where: { id: drawId },
      include: {
        campaign: true,
        winners: {
          include: { user: true, prize: true, activation: { include: { code: true } } },
        },
      },
    });
  },
};
