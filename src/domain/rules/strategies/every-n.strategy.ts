import { z } from 'zod';
import type { PrizeStrategy } from '../types.js';

/**
 * Кожні N кодів — той самий приз.
 *   n: 3, prize: "sticker"
 */
const configSchema = z.object({
  n: z.number().int().positive(),
  prize: z.string(),
});

export type EveryNConfig = z.infer<typeof configSchema>;

export const everyNStrategy: PrizeStrategy<EveryNConfig> = {
  type: 'every-n',
  configSchema,
  evaluate(ctx, config) {
    if (ctx.activationCount <= 0) return [];
    if (ctx.activationCount % config.n !== 0) return [];
    return [
      {
        prizeKey: config.prize,
        reason: `every-n: n=${config.n}, count=${ctx.activationCount}`,
      },
    ];
  },
};
