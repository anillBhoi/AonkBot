// export const redisKeys = {
//   session: (telegramId: number) => `user:session:${telegramId}`,
//   lock: (telegramId: number, action: string) =>
//     `user:lock:${telegramId}:${action}`
// };


export const redisKeys = {
  session: (id: number) => `session:${id}`,
  wallet: (id: number) => `wallet:${id}`,
  lock: (id: number, cmd: string) => `lock:${id}:${cmd}`
}
