import { Bot } from 'grammy'
 import { config } from '../utils/config.js'
import { routeCallback } from '../core/routeCallback.js';

 export const bot = new Bot(config.botToken)

export async function startBot() {
  bot.command('start', ctx =>
    ctx.reply('🤖 Bot is live')
  )
 // bot.on("message", (ctx) => ctx.reply("Welcome to the new Era of trading world !"));
  bot.on('callback_query:data', routeCallback)
  await bot.start()
}
