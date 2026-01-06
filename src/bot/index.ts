import { Bot } from 'grammy'
import { config } from '../utils/config'

export const bot = new Bot(config.botToken)

export async function startBot() {
  bot.command('start', ctx =>
    ctx.reply('🤖 Bot is live')
  )
  await bot.start()
}
