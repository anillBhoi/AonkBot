import { Context } from "grammy"
import { executeSwap } from "../services/swap.service.js"
// import { executeSolSwap} from "../services/swap.service.ts"

export async function handleBuyCallback(ctx: Context) {

  const data = ctx.callbackQuery?.data
  if (!data) return

  const parts = data.split(":")
  const mint = parts[2]
  const amountSol = Number(parts[3])

  await ctx.answerCallbackQuery()

  await ctx.reply(`⚡ Executing buy for ${amountSol} SOL...`)

  try {
    const txid = await executeSwap({
      userId: ctx.from!.id,
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: mint,
      amountSol
    })

    await ctx.reply(
      `✅ Swap Successful!\n\n` +
      `Bought token:\n\`${mint}\`\n` +
      `Amount: ${amountSol} SOL\n\n` +
      `Tx: https://solscan.io/tx/${txid}`,
      { parse_mode: "Markdown" }
    )

  } catch (err: any) {
    await ctx.reply(`❌ Swap Failed: ${err.message}`)
  }
}
