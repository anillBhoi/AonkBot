import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { config } from '../utils/config.js'

export async function startHandler(ctx: Context) {
  const userId = ctx.from?.id
  if (!userId) return

  const wallet = await getOrCreateWallet(userId)

  const isDevnet = (config.solanaCluster === 'devnet')

  const welcome = `👋 *Welcome to AonkBot*\n\n` +
    `Your Solana wallet is ready:\n` +
    `\`${wallet.publicKey}\`\n\n` +
    `*Quick Start - Recommended next steps:*\n` +
    `1. /wallet - Check your SOL balance and holdings\n` +
    `${isDevnet ? '2. (Devnet) Get test SOL from a Solana faucet if needed.\n' : ''}` +
    `2. /swap 1 USDC - Get quote to swap 1 SOL → USDC (use /swap 1 USDC 50 for 50 bps slippage)\n` +
    `3. /send 1 <address> - Send 1 SOL to a Solana address (creates a confirmation)\n` +
    `4. /confirm - Execute the pending swap or transfer\n` +
    `5. /cancel - Cancel a pending action\n` +
    `6. /txs - View recent transactions\n` +
    `7. /help - Show full command reference\n\n` +
    `*Notes:* Quotes expire in 60s. Default slippage = 50 bps (0.5%). Use /help for examples.`

  await ctx.reply(welcome, { parse_mode: 'Markdown' })
}
