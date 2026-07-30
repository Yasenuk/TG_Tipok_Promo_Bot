import PQueue from 'p-queue';
import { logger } from './logger.js';
import { isRateLimited, isUserUnreachable } from './telegram-errors.js';

export const broadcastQueue = new PQueue({
  intervalCap: 25,
  interval: 1000,
  concurrency: 5,
});

export type BroadcastResult = {
  sent: number;
  blocked: number;
  failed: number;
};

export type BroadcastTask<T> = {
  item: T;
  telegramId: bigint;
  send: () => Promise<unknown>;
};

/**
 * Масова розсилка з обробкою відмов
 *
 *  • 429 → чекаємо retry_after і пробуємо ще раз
 *  • 403 → людина заблокувала бота
 *  • решта → лог і рахуємо як помилку
 */
export async function broadcast<T>(
  tasks: BroadcastTask<T>[],
  callbacks?: {
    onBlocked?: (task: BroadcastTask<T>) => Promise<void> | void;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<BroadcastResult> {
  const result: BroadcastResult = { sent: 0, blocked: 0, failed: 0 };
  let done = 0;

  await Promise.all(
    tasks.map((task) =>
      broadcastQueue.add(async () => {
        try {
          await sendWithRetry(task);
          result.sent++;
        } catch (error) {
          if (isUserUnreachable(error)) {
            result.blocked++;
            await callbacks?.onBlocked?.(task);
          } else {
            result.failed++;
            logger.error(
              { error, telegramId: task.telegramId.toString() },
              'не вдалося доставити повідомлення',
            );
          }
        } finally {
          done++;
          callbacks?.onProgress?.(done, tasks.length);
        }
      }),
    ),
  );

  return result;
}

async function sendWithRetry<T>(
  task: BroadcastTask<T>,
  attempt = 1,
): Promise<void> {
  try {
    await task.send();
  } catch (error) {
    const retryAfter = isRateLimited(error);

    if (retryAfter !== undefined && attempt <= 3) {
      logger.warn(
        { retryAfter, attempt, telegramId: task.telegramId.toString() },
        'Telegram просить пригальмувати',
      );
      await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
      return sendWithRetry(task, attempt + 1);
    }

    throw error;
  }
}
