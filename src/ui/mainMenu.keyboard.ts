// ui/mainMenu.keyboard.ts
import { InlineKeyboard } from 'grammy'

export const mainMenuKeyboard = new InlineKeyboard()
  .text('💰 Wallet', 'cmd:wallet')
  .text('🔄 Swap', 'cmd:swap')
  .row()
  .text('📤 Send', 'cmd:send')
  .text('📜 TXs', 'cmd:txs')
  .row()
  .text('⚙️ Settings', 'cmd:settings')
  .text('❓ Help', 'cmd:help')
