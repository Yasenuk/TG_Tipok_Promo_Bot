export type TelegramErrorInfo = {
  code: number;
  description: string;
  retryAfterSec?: number;
};

export function parseTelegramError(error: unknown): TelegramErrorInfo | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return undefined;

  const code = (response as { error_code?: unknown }).error_code;
  const description = (response as { description?: unknown }).description;
  if (typeof code !== 'number') return undefined;

  const params = (response as { parameters?: { retry_after?: number } }).parameters;

  return {
    code,
    description: typeof description === 'string' ? description : '',
    retryAfterSec: params?.retry_after,
  };
}

export function isUserUnreachable(error: unknown): boolean {
  const info = parseTelegramError(error);
  if (!info) return false;

  if (info.code === 403) return true;

  return (
    info.code === 400 &&
    /chat not found|user is deactivated|PEER_ID_INVALID/i.test(info.description)
  );
}

export function isRateLimited(error: unknown): number | undefined {
  const info = parseTelegramError(error);
  if (info?.code !== 429) return undefined;
  return info.retryAfterSec ?? 1;
}

export function isNotModified(error: unknown): boolean {
  const info = parseTelegramError(error);
  return info?.code === 400 && /message is not modified/i.test(info.description);
}
