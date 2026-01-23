import { Context } from 'grammy'

export async function helpHandler(ctx: Context) {
  const helpText = `
🤖 *AonkBot - Solana Trading Bot*

📖 *Available Commands:*

/start - Initialize your wallet
/wallet - Check balance & token holdings
/swap - Swap tokens (recommended)
  Usage: /swap <amount> <token> [slippage]
  Examples:
    /swap 1 USDC           (swap 1 SOL -> USDC)
    /swap 120 USDC to SOL  (swap 120 USDC -> SOL)

/send - Send SOL to another address
  Usage: /send <amount> <to_address>
  Example: /send 1 H3G...abc

/confirm - Execute pending trade or transfer
/cancel - Cancel pending action
/txs - View recent transactions
/help - Show this message

💡 *Quick Start Guide:*

1. /start - Create your wallet
2. /wallet - Fund your wallet with SOL
3. /swap 0.5 USDC - Get a quote to swap 0.5 SOL for USDC
4. /confirm - Execute the swap or transfer

⚙️ *Parameters:*

<amount> - Amount in SOL by default (when source token omitted)
<token> - Token symbol (e.g., USDC)
[slippage] - Slippage in basis points (default 50 = 0.5%)

⚠️ *Important:*

• /swap creates a quote; you must run /confirm to execute
• /send will transfer SOL to the specified address (no swap)
• Your private key is encrypted and never transmitted
• Transactions may fail if liquidity is low
• Network fees apply to all trades

❓ For support, contact @aonkbot_support
`

  await ctx.reply(helpText, { parse_mode: 'Markdown' })
} 

