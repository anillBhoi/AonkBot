import { Context } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";

export async function deposit(ctx: Context): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply("Unable to identify user. Please try again.");
      return;
    }

    const wallet = await getOrCreateWallet(userId);

    await ctx.reply(
      `💰 *Deposit SOL*\n\n` +
      `Send *SOL only* to the address below:\n\n` +
      `\`${wallet.publicKey}\`\n\n` +
      `⚠️ Sending other tokens may result in permanent loss.`,
      { parse_mode: "Markdown" }
    );

  } catch (error) {
    console.error("[Deposit Handler Error]", error);
    await ctx.reply("Something went wrong while generating your deposit address.");
  }
}
