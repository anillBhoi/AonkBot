import { Bot } from 'grammy';
import { getOrCreateSession } from './core/session.js';
import { routeCommand } from './core/router.js';
import { config } from './utils/config.js';

const bot = new Bot(config.botToken);

export async function startBot() {

  bot.on('message:text', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      await getOrCreateSession(from.id, from.username);
      await routeCommand(ctx);

    } catch (err) {
      console.error('[Bot Error]', err);
    }
  });

  await bot.start();
  console.log('[Bot] running');
}
