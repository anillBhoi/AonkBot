import { Context } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";
import { buySolHandler } from "./buySol.handler.js";

export async function buySolEntryHandler(ctx: Context) {
  try {
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    // ✅ Ensure wallet exists
    await getOrCreateWallet(userId);

    // ✅ Forward to actual buy handler
    await buySolHandler(ctx);

  } catch (err) {
    console.error("Buy SOL entry error:", err);
    await ctx.reply("Something went wrong while opening Buy SOL.");
  }
}
