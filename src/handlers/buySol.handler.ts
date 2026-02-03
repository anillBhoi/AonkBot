import { Context, InlineKeyboard } from "grammy";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";

export async function buySolHandler(ctx: Context): Promise<void>{
    try {
        const userId = ctx.from?.id;
        if(!userId) {
            await ctx.reply("Unable to identify user. ");
            return; 
        }

        const wallet = await getOrCreateWallet(userId);

        //build moonpay url dynamically 
        const moonpayUrl = 
         "https://buy.moonpay.com/?" +
         `apiKey=${process.env.MOONPAY_PUBLIC_KEY}` +
         `&walletAddress=${wallet.publicKey}` +
         "&currencyCode=sol" +
         "&showWalletAddressForm=true";

         const keyboard = new InlineKeyboard()
      .url("🚀 Buy SOL via MoonPay", moonpayUrl)
      .row()
      .text("⬅ Back to Wallet", "cmd:wallet");

    // 4️⃣ Respond
    await ctx.reply(
      "💳 *Buy SOL*\n\n" +
        "You’ll be redirected to MoonPay to purchase SOL.\n\n" +
        "🔐 Funds will be credited directly to your wallet.",
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (err) {
    console.error("[Buy SOL Handler Error]", err);
    await ctx.reply("❌ Failed to generate Buy SOL link. Please try again.");
  }
}
    