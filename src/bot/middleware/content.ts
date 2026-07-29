import type { MiddlewareFn } from 'telegraf';
import type { AppContext } from '../context.js';
import { contentService } from '../../domain/content/content.service.js';
import type { ContentKey } from '../../domain/content/keys.js';
import type { ContentParams } from '../../domain/content/content.service.js';

export const contentMiddleware: MiddlewareFn<AppContext> = async (ctx, next) => {
  ctx.t = (key: ContentKey, params?: ContentParams) =>
    contentService.t(key, params, { campaignId: null });

  ctx.reply_t = async (key: ContentKey, params?: ContentParams, extra?: object) => {
    const text = await ctx.t(key, params);
    return ctx.reply(text, extra);
  };

  await next();
};
