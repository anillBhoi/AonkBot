import { Context, InlineKeyboard } from 'grammy'
import { getUserWallets, getSelectedWallet } from '../blockchain/wallet.service.js'
import { getSolBalanceMultiNetwork } from '../blockchain/balance.service.js'

/**
 * OPTIMIZED: Load wallet UI FAST, then update balances in background
 * This matches BonkBot's instant response pattern
 */
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

    // ✅ FIX #1: Show UI immediately with "Loading..." placeholders
    // This makes the bot feel INSTANT like BonkBot
    const quickMessage = buildQuickWalletMessage(wallets, selected)
    const kb = buildWalletKeyboard(wallets, selected, true) // loading state

    const sentMessage = await ctx.reply(quickMessage, {
      parse_mode: 'Markdown',
      reply_markup: kb
    })

    // ✅ FIX #2: Fetch balances in background and update the message
    // This prevents blocking the UI
    fetchAndUpdateBalances(ctx, sentMessage.message_id, wallets, selected, userId)
      .catch(err => console.error('[Balance fetch error]', err))

  } catch (err) {
    console.error('[Manage Wallets Error]', err)
    await ctx.reply('❌ Error loading wallets.').catch(() => {})
  }
}

/**
 * Build initial message with wallet list (no balances yet)
 */
function buildQuickWalletMessage(
  wallets: any[],
  selected: any
): string {
  let message = '*💼 Wallet Selection*\n\n'

  if (selected) {
    const selDisplay = getWalletDisplayName(selected, wallets)
    message += '*Selected Wallet*\n'
    message += `✅ ${selDisplay}: ${selected.publicKey}\n`
    message += `⏳ Loading balances...\n\n`
  }

  message += '*All Wallets*\n'
  wallets.forEach((w, idx) => {
    const isSelected = selected && selected.walletId === w.walletId
    const checkmark = isSelected ? '✅' : '  '
    const displayName = getWalletDisplayName(w, wallets, idx)
    message += `${checkmark} ${displayName}: ${w.publicKey}\n`
  })

  return message
}

/**
 * Fetch balances and update the message in-place
 */
async function fetchAndUpdateBalances(
  ctx: Context,
  messageId: number,
  wallets: any[],
  selected: any,
  userId: number
) {
  // Fetch balances in parallel
  const walletBalances = await Promise.all(
    wallets.map(async (w, idx) => ({
      wallet: w,
      balances: await getSolBalanceMultiNetwork(w.publicKey),
      displayName: getWalletDisplayName(w, wallets, idx)
    }))
  )

  // Build updated message with real balances
  let message = '*💼 Wallet Selection*\n\n'

  if (selected) {
    const selectedBalance = walletBalances.find(
      (wb) => wb.wallet.walletId === selected.walletId
    )?.balances || { mainnet: 0, devnet: 0 }

    const selDisplay = getWalletDisplayName(selected, wallets)

    message += '*Selected Wallet*\n'
    message += `✅ ${selDisplay}: ${selected.publicKey}\n`
    message += `📍 Mainnet: *${selectedBalance.mainnet.toFixed(4)} SOL*\n`
    message += `🔵 Devnet: *${selectedBalance.devnet.toFixed(4)} SOL*\n\n`
  }

  message += '*All Wallets*\n'
  walletBalances.forEach((wb) => {
    const isSelected = selected && selected.walletId === wb.wallet.walletId
    const checkmark = isSelected ? '✅' : '  '
    message += `${checkmark} ${wb.displayName}: ${wb.wallet.publicKey}\n`
    message += `   📍 Mainnet: *${wb.balances.mainnet.toFixed(4)} SOL*\n`
    message += `   🔵 Devnet: *${wb.balances.devnet.toFixed(4)} SOL*\n`
  })

  // Build keyboard with balances
  const kb = buildWalletKeyboard(walletBalances, selected, false)

  // Update the message
  await ctx.api.editMessageText(userId, messageId, message, {
    parse_mode: 'Markdown',
    reply_markup: kb
  }).catch(() => {
    // Message may have been deleted or not modified
  })
}

/**
 * Build inline keyboard with wallet buttons
 */
function buildWalletKeyboard(
  wallets: any[],
  selected: any,
  isLoading: boolean
): InlineKeyboard {
  const kb = new InlineKeyboard()

  wallets.forEach((item) => {
    // Handle both initial wallets and wallet balances
    const wallet = item.wallet || item
    const balances = item.balances
    const displayName = item.displayName || getWalletDisplayName(wallet, wallets)

    const isSelected = selected && selected.walletId === wallet.walletId
    const checkmark = isSelected ? '✅' : '  '

    let label: string
    if (isLoading || !balances) {
      label = `${checkmark} ${displayName} - Loading...`
    } else {
      const mainnetLabel = `${balances.mainnet.toFixed(2)}M`
      const devnetLabel = `${balances.devnet.toFixed(2)}D`
      label = `${checkmark} ${displayName} - ${mainnetLabel} / ${devnetLabel}`
    }

    kb.text(label, `wallet_select:${wallet.walletId}`).row()
  })

  kb.text('➕ Create Wallet', 'wallet_create').row()
  kb.text('Close', 'close')

  return kb
}

/**
 * Get sanitized display name for a wallet
 */
function getWalletDisplayName(
  wallet: any,
  allWallets: any[],
  idx?: number
): string {
  const fallbackIdx = idx !== undefined ? idx : allWallets.findIndex(w => w.walletId === wallet.walletId)
  const fallbackName = `W${fallbackIdx + 1}`

  const name = wallet.name?.toString().trim()
  if (!name) return fallbackName
  if (name.startsWith('/')) return fallbackName
  return name
}