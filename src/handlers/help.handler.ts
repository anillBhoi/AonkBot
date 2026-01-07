import { Context } from 'grammy';

export async function helpHandler(ctx: Context) {
  await ctx.reply('Available commands:\n/start\n/help');
}
