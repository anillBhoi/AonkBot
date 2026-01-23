import { Bot } from 'grammy';
import { getOrCreateSession } from './core/session.js';
import { routeCommand } from './core/router.js';
import { config } from './utils/config.js';
import { initRpcHealth, startRpcHealthCheck } from './blockchain/solana.client.js';

const bot = new Bot(config.botToken);

export async function startBot() {
  // Initialize RPC health checks
  console.log('[Bot] Initializing RPC endpoints...');
  await initRpcHealth();
  startRpcHealthCheck();

  bot.on('message:text', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      await getOrCreateSession(from.id, from.username);
      await routeCommand(ctx);

    } catch (err) {
      console.error('[Bot Error]', err);
      await ctx.reply(
        '❌ An unexpected error occurred. Please try again or contact support.'
      ).catch(e => console.error('[Reply Error]', e));
    }
  });

  await bot.start();
  console.log('[Bot] 🚀 Running!');
}
