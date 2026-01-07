export const redisKeys = {
  session: (telegramId: number) => `user:session:${telegramId}`,
  lock: (telegramId: number, action: string) =>
    `user:lock:${telegramId}:${action}`
};
