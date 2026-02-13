import { Bot } from 'grammy'
import { config } from './utils/config.js'
import { getOrCreateSession } from './core/session.js'
import { initRpcHealth, startRpcHealthCheck } from './blockchain/solana.client.js'
import { routeCallback } from './core/routeCallback.js'
import { routeCommand } from './core/router.js'
import { withdrawConversationHandler } from './handlers/withdrawConversation.handler.js'
import { getWithdrawState } from './core/state/withdraw.state.js'
import { handleWalletNaming } from './handlers/createWallet.handler.js'
import { totpMessageHandler } from './handlers/totp.handler.js'
import { verifySecurityQuestionHandler, verifyTOTPForExportHandler } from './handlers/exportSeedPhraseSecure.handler.js'
import { verify2FACode, verifyAndRegenTOTP } from './handlers/onboarding.handler.js'
import { redis } from './config/redis.js'
import { redisKeys } from './utils/redisKeys.js'

export const bot = new Bot(config.botToken)

export async function startBot() {
  console.log('[Bot] Initializing RPC...')
  await initRpcHealth()
  startRpcHealthCheck()

  /* ═══════════════════════════════════════════
     TEXT MESSAGE ROUTER
  ═══════════════════════════════════════════ */

  bot.on('message:text', async (ctx) => {
    try {
      const from = ctx.from
      if (!from) return

      await getOrCreateSession(from.id, from.username).catch(() => null)

      /* ─── 1. Simple TOTP export flow ─── */
      const awaitingExportTotp = await redis.get(redisKeys.exportAwaitTotp(from.id))
      if (awaitingExportTotp) {
        await totpMessageHandler(ctx)
        return
      }

      /* ─── 1b. /totpsetup regen — verify current code before issuing new QR ─── */
      const awaitingRegenVerify = await redis.get(redisKeys.totpRegenAwait(from.id))
      if (awaitingRegenVerify) {
        await verifyAndRegenTOTP(ctx)
        return
      }

      /* ─── 2. Onboarding 2FA verification ─── */
      const verifying2FA = await redis.get(redisKeys.verifying2FA(from.id))
      if (verifying2FA) {
        await verify2FACode(ctx)
        return
      }

      /* ─── 3. Secure 3-layer export — SQ / password ─── */
      const exportStage = await redis.get(redisKeys.exportStage(from.id))

      if (
        exportStage === 'answering_question' ||
        exportStage === 'entering_sq_answer' ||
        exportStage === 'answering_password'
      ) {
        await verifySecurityQuestionHandler(ctx)
        return
      }

      /* ─── 4. Secure 3-layer export — final TOTP ─── */
      if (exportStage === 'awaiting_totp') {
        await verifyTOTPForExportHandler(ctx)
        return
      }

      /* ─── 5. Withdraw conversation ─── */
      const withdrawState = getWithdrawState(from.id)
      if (withdrawState) {
        await withdrawConversationHandler(ctx)
        return
      }

      /* ─── 6. Wallet naming ─── */
      const isNamingWallet = await redis.get(`wallet:naming:${from.id}`)
      if (isNamingWallet) {
        await handleWalletNaming(ctx)
        return
      }

      /* ─── 7. Normal command routing ─── */
      await routeCommand(ctx)
    } catch (err) {
      console.error('[Bot Error]', err)
      await ctx.reply('❌ Unexpected error occurred.').catch(() => {})
    }
  })

  /* ═══════════════════════════════════════════
     CALLBACK ROUTER
  ═══════════════════════════════════════════ */

  bot.on('callback_query:data', async (ctx) => {
    try {
      await routeCallback(ctx)
    } catch (err) {
      console.error('[Callback Error]', err)
      await ctx
        .answerCallbackQuery({ text: 'Something went wrong', show_alert: true })
        .catch(() => {})
    }
  })

  await bot.start()
  console.log('[Bot] 🚀 Running')
}