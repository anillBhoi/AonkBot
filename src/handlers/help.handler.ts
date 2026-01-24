import { Context } from 'grammy'

export async function helpHandler(ctx: Context) {
  const helpText = `
🤖 *AonkBot - Solana Trading Bot*

Help:

Which tokens can I trade?
Any SPL token that is a SOL pair, on Raydium.io, pump.fun, Meteora.ag, Moonshot.com, or jup.ag (Jupiter), and will integrate more platforms on a rolling basis. We pick up pairs instantly, and Jupiter will pick up non-SOL pairs within approx. 15 minutes.

How can I see how much money I've made from referrals?
Tap the referrals button or type /referrals to see your payment in $Aonk!

How do I create a new wallet on AonkBot?
Tap the Wallet button or type /wallet, and you'll be able to configure your new wallets!

Is AonkBot free? How much do I pay for transactions?
AonkBot is completely free! We charge 1% on transactions, and keep the bot free so that anyone can use it. 

Why is my Net Profit lower than expected?
Your Net Profit is calculated after deducting all associated costs, including Price Impact, Transfer Tax, Dex Fees, and a 1% AonkBot fee. This ensures the figure you see is what you actually receive, accounting for all transaction-related expenses.

Is there a difference between @AonkBot_bot and the backup bots?
No, they are all the same bot and you can use them interchangeably. If one is slow or down, you can use the other ones. You will have access to the same wallet and positions.

Further questions? Join our Telegram group: https://t.me/AonkBotChat
❓ For support, contact @aonkbot_support
`

  await ctx.reply(helpText, { parse_mode: 'Markdown' })
} 

