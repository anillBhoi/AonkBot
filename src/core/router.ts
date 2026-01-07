import { Context } from 'grammy';
import { acquireLock } from './locks.js';
import { startHandler } from '../handlers/start.handler.js';
import { helpHandler } from '../handlers/help.handler.js';
import { unknownHandler } from '../handlers/unknown.handler.js';
import { walletHandler } from '../handlers/wallet.handler.js';

const routes: Record<string, (ctx: Context) => Promise<void>> = {
  start: startHandler,
  help: helpHandler,
  wallet: walletHandler
};

export async function routeCommand(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  const command = text.replace('/', '').split(' ')[0];
  const userId = ctx.from?.id;
  if (!userId) return;

  const locked = await acquireLock(userId, command);
  if (!locked) return; // duplicate → no-op

  const handler = routes[command] ?? unknownHandler;
  await handler(ctx);
}
