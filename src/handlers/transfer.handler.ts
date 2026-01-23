import { Context } from 'grammy'
import { getOrCreateWallet } from '../blockchain/wallet.service.js'
import { createConfirmation } from '../core/confirmations/confirmation.service.js'
import { validateAmount } from '../core/validators/amount.validator.js'
import { validateSolanaAddress } from '../core/validators/solanaAddress.validator.js'
import { TOKENS } from '../utils/tokens.js'

export async function transferHandler(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    const text = ctx.message?.text || ''
    const args = text.trim().split(' ')

    // Expect: /send <amount> <toAddress>
    const amountStr = args[1]
    const toAddress = args[2]

    if (!amountStr || !toAddress) {
      await ctx.reply(
        `📤 *Send SOL*

` +
        `Usage: /send <amount> <to_address>

` +
        `Example: /send 1 EXAMPLE_PUBLIC_KEY

` +
        `Note: If you meant to swap SOL->token use /swap, e.g. /swap 1 USDC`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    // If the "toAddress" looks like a token symbol, provide a hint
    if (TOKENS[toAddress.toUpperCase()]) {
      await ctx.reply(
        `⚠️ It looks like you specified a token symbol (${toAddress}). To swap SOL for tokens use e.g. \`/swap 1 ${toAddress.toUpperCase()}\` `
      )
      return
    }

    // Validate amount
    const amount = validateAmount(amountStr)

    // Validate address
    try {
      validateSolanaAddress(toAddress)
    } catch (err: any) {
      await ctx.reply(`❌ Invalid Solana address: ${err.message}`)
      return
    }

    // Create a short-lived confirmation
    const confirmationPayload = {
      transfer: {
        amount,
        toAddress
      },
      timestamp: Date.now()
    }

    await createConfirmation(userId, confirmationPayload)

    await ctx.reply(
      `📤 *Send Confirmation*\n\n` +
      `You are about to send *${amount} SOL* to\n` +
      `

destination: ${toAddress}\n\n` +
      `Reply with /confirm to proceed or /cancel to abort (confirmation expires in 60s)`,
      { parse_mode: 'Markdown' }
    )

  } catch (err: any) {
    console.error('[Transfer Handler Error]', err)
    await ctx.reply(`❌ Error: ${err.message}`)
  }
}
