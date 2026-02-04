import { Context } from "grammy";
import { getWithdrawState, clearWithdrawState } from "../core/state/withdraw.state.js";
import { withdrawSol } from "../blockchain/withdraw.service.js";
import { config } from "../utils/config.js";

export async function confirmWithdrawHandler(ctx: Context) {

    const cluster =
          config.solanaCluster === 'devnet' ? 'devnet' : 'mainnet-beta'

  const userId = ctx.from?.id;
  if (!userId) return;

  const state = getWithdrawState(userId);
  if (!state) return;

  try {

    await ctx.reply("⏳ Processing withdrawal...");

    const signature = await withdrawSol(
      userId,
      state.destination!,
      state.amount!
    );

    const explorerUrl = (sig: string) =>
      cluster === 'mainnet-beta'
        ? `https://solscan.io/tx/${sig}`
        : `https://explorer.solana.com/tx/${sig}?cluster=devnet`

    await ctx.reply(
        `✅ Withdrawal Successful\n ${explorerUrl(signature)}`
    );

  } catch (err: any) {
  console.error(err);
  await ctx.reply(`❌ Withdrawal failed:\n${err.message}`);
}

  clearWithdrawState(userId);
}
