export type CodeError =
  | { type: 'code.not_found' }
  | { type: 'code.already_used' }
  | { type: 'code.used_by_you'; usedAt: Date }
  | { type: 'code.campaign_inactive'; campaignTitle: string }
  | { type: 'code.campaign_not_started'; startsAt: Date }
  | { type: 'code.campaign_ended'; endsAt: Date }
  | { type: 'code.rate_limited'; retryAfterSec: number };

export type ClaimError =
  | { type: 'claim.not_found' }
  | { type: 'claim.already_delivered' }
  | { type: 'claim.wrong_status'; current: string }
  | { type: 'claim.store_inactive' };

export type PrizeError =
  | { type: 'prize.not_found'; prizeKey: string }
  | { type: 'prize.out_of_stock'; prizeKey: string };

export type UserError =
  | { type: 'user.not_registered' }
  | { type: 'user.phone_taken' }
  | { type: 'user.consent_required' };

export type AppError = CodeError | ClaimError | PrizeError | UserError;

export const isUserFacing = (e: AppError): boolean =>
  !e.type.startsWith('claim.');
