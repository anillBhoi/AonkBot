import { Context, InlineKeyboard } from "grammy";
import { getSolBalance } from "../blockchain/balance.service.js";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";

export async function withdrawMenuHandler(ctx: Context) {

  const userId = ctx.from?.id;
  if (!userId) return;

  const wallet = await getOrCreateWallet(userId);
  const balance = await getSolBalance(wallet.publicKey);
  
  const keyboard = new InlineKeyboard()
    .text("Withdraw All SOL", "cmd:withdrawall")
    .row()
    .text("Withdraw X SOL", "cmd:withdrawx")
    .row()
    .text("Cancel", "cmd:cancelwithdraw");

  await ctx.reply(
    `💰 Wallet Balance: ${balance.toFixed(4)} SOL\n\nSelect withdrawal option:`,
    { reply_markup: keyboard }
  );
}
