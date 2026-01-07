import { Context } from 'grammy';

export async function unknownHandler(ctx: Context) {
  await ctx.reply('Unknown command.');
}
