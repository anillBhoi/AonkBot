import { Context } from 'grammy'
import { selectWallet } from '../blockchain/wallet.service.js'
import { walletHandler } from './wallet.handler.js'

export async function walletSelectHandler(ctx: Context) {

  const userId = ctx.from?.id
  if (!userId) return

  const walletId = ctx.callbackQuery?.data?.split(':')[1]

  await selectWallet(userId, walletId!)

  await ctx.answerCallbackQuery("Wallet switched")

  await walletHandler(ctx)
}
