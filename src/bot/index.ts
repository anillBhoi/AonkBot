import { Bot } from 'grammy'
import { config } from '../utils/config.js'
import { resetAllWalletsHandler } from '../handlers/resetAllWallets.handler.js'

 export const bot = new Bot(config.botToken)

// Add the command to trigger the reset all wallets handler
bot.command('reset_wallets', resetAllWalletsHandler)

export async function startBot() {
  bot.command('start', ctx =>
    ctx.reply('🤖 Bot is live')
  )
  bot.on("message", (ctx) => ctx.reply("Welcome to the new Era of trading world !"));
  await bot.start()
}
