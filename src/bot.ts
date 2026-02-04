import { Bot } from 'grammy';
import { getOrCreateSession } from './core/session.js';
import { routeCommand } from './core/router.js';
import { config } from './utils/config.js';
import { initRpcHealth, startRpcHealthCheck } from './blockchain/solana.client.js';
import { routeCallback } from './core/routeCallback.js';

const bot = new Bot(config.botToken);

export async function startBot() {

  console.log('[Bot] Initializing RPC endpoints...');

  await initRpcHealth();
  startRpcHealthCheck();

  // ✅ TEXT COMMAND ROUTING
  bot.on('message:text', async (ctx) => {
    try {

      const from = ctx.from;
      if (!from) return;

      await getOrCreateSession(from.id, from.username)
        .catch(() => null);

      await routeCommand(ctx);

    } catch (err) {

      console.error('[Bot Error]', err);

      await ctx.reply(
        '❌ An unexpected error occurred. Please try again.'
      ).catch(() => {});
    }
  });

  // ✅ CALLBACK QUERY ROUTING (Safe Wrapper)
  bot.on('callback_query:data', async (ctx) => {
    try {

      await routeCallback(ctx);

      // Acknowledge button click
      await ctx.answerCallbackQuery().catch(() => {});

    } catch (err) {

      console.error('[Callback Error]', err);

      await ctx.answerCallbackQuery({
        text: 'Something went wrong. Please try again.',
        show_alert: true
      }).catch(() => {});
    }
  });

  try {
    await bot.start();
    console.log('[Bot] 🚀 Running!');
  } catch (err) {
    console.error('[Bot Start Error]', err);
    process.exit(1);
  }
}

// ✅ GLOBAL SAFETY NETS
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});
