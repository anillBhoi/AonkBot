import { Context, InlineKeyboard } from 'grammy'
import { getUserWallets, getSelectedWallet, UserWallet } from '../blockchain/wallet.service.js'
import { getSolBalanceMultiNetwork } from '../blockchain/balance.service.js'

export async function manageWalletsHandler(ctx: Context) {

  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallets = await getUserWallets(userId)
    const selected = await getSelectedWallet(userId)

    if (wallets.length === 0) {
      await ctx.reply('💼 No wallets found. Use /start to create one.')
      return
    }

    // Get balances for all wallets on both networks
    const walletBalances = await Promise.all(
      wallets.map(async (w) => ({
        wallet: w,
        balances: await getSolBalanceMultiNetwork(w.publicKey)
      }))
    )

    // Build message with proper formatting like BonkBot
    let message = '*💼 Wallet Selection*\n\n'

    // Show currently selected wallet prominently
    if (selected) {
      const selectedBalance = walletBalances.find(
        (wb) => wb.wallet.walletId === selected.walletId
      )?.balances || { mainnet: 0, devnet: 0 }

      message += '*Selected Wallet*\n'
      message += `✅ ${selected.name}: ${selected.publicKey}\n`
      message += `📍 Mainnet: *${selectedBalance.mainnet.toFixed(4)} SOL*\n`
      message += `🔵 Devnet: *${selectedBalance.devnet.toFixed(4)} SOL*\n`
      message += '\n'
    }

    // Show all wallets section
    message += '*All Wallets*\n'
    walletBalances.forEach((wb) => {
      const isSelected = selected && selected.walletId === wb.wallet.walletId
      const checkmark = isSelected ? '✅' : '  '
      message += `${checkmark} ${wb.wallet.name}: ${wb.wallet.publicKey}\n`
      message += `   📍 Mainnet: *${wb.balances.mainnet.toFixed(4)} SOL*\n`
      message += `   🔵 Devnet: *${wb.balances.devnet.toFixed(4)} SOL*\n`
    })

    // Create inline keyboard
    const kb = new InlineKeyboard()

    // Add wallet selection buttons
    walletBalances.forEach((wb) => {
      const isSelected = selected && selected.walletId === wb.wallet.walletId
      const checkmark = isSelected ? '✅' : '  '
      
      // Show wallet name and both balances in button
      const mainnetLabel = `${wb.balances.mainnet.toFixed(2)}M`
      const devnetLabel = `${wb.balances.devnet.toFixed(2)}D`
      const label = `${checkmark} ${wb.wallet.name} - ${mainnetLabel} / ${devnetLabel}`

      kb.text(label, `wallet_select:${wb.wallet.walletId}`).row()
    })

    kb.text('➕ Create Wallet', 'wallet_create').row()
    kb.text('Close', 'close')

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: kb
    })
  } catch (err) {
    console.error('[Manage Wallets Error]', err)
    await ctx.reply('❌ Error loading wallets.').catch(() => {})
  }
}
