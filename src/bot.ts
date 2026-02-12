import { Bot } from "grammy"
import { getOrCreateSession } from "./core/session.js"
import { config } from "./utils/config.js"
import { initRpcHealth, startRpcHealthCheck } from "./blockchain/solana.client.js"
import { routeCallback } from "./core/routeCallback.js"
import { routeCommand } from "./core/router.js"
import { withdrawConversationHandler } from "./handlers/withdrawConversation.handler.js"
import { getWithdrawState } from "./core/state/withdraw.state.js"
import { handleWalletNaming } from "./handlers/createWallet.handler.js"
import { redis } from "./config/redis.js"

const bot = new Bot(config.botToken)

export async function startBot() {

  console.log("[Bot] Initializing RPC endpoints...")
  await initRpcHealth()
  startRpcHealthCheck()

  /* ===============================
     TEXT MESSAGE ROUTER
  ================================ */
  bot.on("message:text", async (ctx) => {
    try {
      const from = ctx.from
      if (!from) return

      await getOrCreateSession(from.id, from.username)
        .catch(() => null)

      const withdrawState = getWithdrawState(from.id)

      if (withdrawState) {
        await withdrawConversationHandler(ctx)
        return
      }

      // Check if user is naming a wallet
      const isNamingWallet = await redis.get(`wallet:naming:${from.id}`)
      if (isNamingWallet) {
        await handleWalletNaming(ctx)
        return
      }

      await routeCommand(ctx)

    } catch (err) {
      console.error("[Bot Error]", err)
      await ctx.reply("❌ Unexpected error occurred.").catch(() => {})
    }
  })

  /* ===============================
     INLINE BUTTON CALLBACKS
  ================================ */
  bot.on("callback_query:data", async (ctx) => {
    try {
      await routeCallback(ctx)
    } catch (err) {
      console.error("[Callback Error]", err)

      await ctx.answerCallbackQuery({
        text: "Something went wrong",
        show_alert: true
      }).catch(() => {})
    }
  })

  await bot.start()
  console.log("[Bot] 🚀 Running!")
}
