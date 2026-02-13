import { Context } from 'grammy'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getSelectedWallet } from '../blockchain/wallet.service.js'
// import { buildWalletKeyboard } from '../ui/walletMenu.keyboard.js'
// 'solana' is the exported Connection instance — aliased for clarity
import { solana as rpcConnection } from '../blockchain/solana.client.js'
import { buildWalletKeyboard } from '../ui/walletMenu.js'

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

/**
 * Fetch the SOL balance (in SOL, 4 decimal places) for a public key string.
 * Returns 0 on any RPC error so the UI is never broken.
 */
async function fetchSolBalance(publicKey: string): Promise<string> {
  try {
    const pubkey = new PublicKey(publicKey)
    const lamports = await rpcConnection.getBalance(pubkey, 'confirmed')
    return (lamports / LAMPORTS_PER_SOL).toFixed(4)
  } catch (err) {
    console.error('[wallet] Failed to fetch balance:', err)
    return '0.0000'
  }
}

/**
 * Shorten a public key for display: first 4 chars ... last 4 chars
 * e.g. "4F3E...NuY"
 */
function shortenAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Build the wallet message text.
 * Centralised here so both the initial send and the in-place refresh
 * produce identical formatting.
 */
function buildWalletMessage(params: {
  walletName: string
  publicKey: string
  solBalance: string
  refreshedAt?: Date
}): string {
  const { walletName, publicKey, solBalance, refreshedAt } = params

  const shortAddress = shortenAddress(publicKey)

  // Timestamp line shown only on refreshes (matches BonkBot behaviour)
  const timestampLine = refreshedAt
    ? `\n🕐 Last refreshed: ${refreshedAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`
    : ''

  return (
    `💼 *Your Wallet*\n\n` +
    `*Wallet ${walletName}*\n\n` +
    `📍 Address: \`${shortAddress}\`\n` +
    `⭐ SOL Balance: *${solBalance} SOL*\n\n` +
    `Use /send to swap tokens\n` +
    `Use /txs to view transaction history` +
    timestampLine
  )
}

/* ─────────────────────────────────────────────
   /wallet command handler
   Sends the wallet card as a new message.
───────────────────────────────────────────── */

export const walletHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.reply(
        '❌ No wallet found.\n\nUse /start to create one.',
      )
      return
    }

    const solBalance = await fetchSolBalance(wallet.publicKey)

    const text = buildWalletMessage({
      walletName: wallet.name ?? wallet.publicKey.slice(0, 8),
      publicKey: wallet.publicKey,
      solBalance,
    })

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: buildWalletKeyboard(wallet.publicKey),
    })
  } catch (err) {
    console.error('[wallet] walletHandler error:', err)
    await ctx.reply('❌ Failed to load wallet. Please try again.')
  }
}

/* ─────────────────────────────────────────────
   wallet:refresh callback handler
   BonkBot style: edits the EXISTING message
   in-place — no new message is posted.
   Shows a brief "⏳ Refreshing..." indicator,
   then updates with the latest balance.
───────────────────────────────────────────── */

export const walletRefreshHandler = async (ctx: Context): Promise<void> => {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    // 1. Acknowledge immediately so Telegram stops the loading spinner
    await ctx.answerCallbackQuery({ text: '🔄 Refreshing...' }).catch(() => {})

    const wallet = await getSelectedWallet(userId)
    if (!wallet) {
      await ctx.answerCallbackQuery({ text: '❌ No wallet found', show_alert: true }).catch(() => {})
      return
    }

    // 2. Fetch fresh balance from RPC
    const solBalance = await fetchSolBalance(wallet.publicKey)
    const refreshedAt = new Date()

    const newText = buildWalletMessage({
      walletName: wallet.name ?? wallet.publicKey.slice(0, 8),
      publicKey: wallet.publicKey,
      solBalance,
      refreshedAt,
    })

    // 3. Edit the existing message in-place (BonkBot style)
    //    editMessageText throws if the content hasn't changed — catch silently.
    await ctx.editMessageText(newText, {
      parse_mode: 'Markdown',
      reply_markup: buildWalletKeyboard(wallet.publicKey),
    }).catch((err: Error) => {
      // Telegram error 400: "message is not modified" — ignore it
      if (!err.message?.includes('message is not modified')) {
        throw err
      }
    })
  } catch (err) {
    console.error('[wallet] walletRefreshHandler error:', err)
    await ctx.answerCallbackQuery({
      text: '❌ Refresh failed. Please try again.',
      show_alert: true,
    }).catch(() => {})
  }
}