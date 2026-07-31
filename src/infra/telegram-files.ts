import type { Telegram } from 'telegraf';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type DownloadResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: 'too_large' | 'download_failed' };

/**
 * Завантаження документа, надісланого в чат
 */
export async function downloadDocument(
  telegram: Telegram,
  fileId: string,
  fileSize?: number,
): Promise<DownloadResult> {
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    return { ok: false, reason: 'too_large' };
  }

  try {
    const link = await telegram.getFileLink(fileId);
    const response = await fetch(link.href);

    if (!response.ok) return { ok: false, reason: 'download_failed' };

    const buffer = Buffer.from(await response.arrayBuffer());
    return { ok: true, buffer };
  } catch {
    return { ok: false, reason: 'download_failed' };
  }
}
