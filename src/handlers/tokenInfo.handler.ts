// handlers/tokenInfo.handler.ts
import { Context, InlineKeyboard } from "grammy";
import { formatSmallPrice } from "../utils/tokenDetector.js";
import { fetchTokenInfo } from "../services/token.service.js";
import { getOrCreateWallet } from "../blockchain/wallet.service.js";
import { getTokenBalanceAndDecimals } from "../blockchain/balance.service.js";

export async function tokenInfoHandler(ctx: Context, token: string) {
  const info = await fetchTokenInfo(token);

  if (!info || !info.price) {
    await ctx.reply("❌ Token not found or not tradable right now.");
    return;
  }

  const chartUrl =
    info.pairAddress
      ? `https://dexscreener.com/solana/${info.pairAddress}`
      : `https://dexscreener.com/solana/${token}`;

  let tokenBalance = 0;
  let solBalance = "0.0000";
  const userId = ctx.from?.id;
  if (userId) {
    try {
      const wallet = await getOrCreateWallet(userId);
      const { balance } = await getTokenBalanceAndDecimals(wallet.publicKey, token);
      tokenBalance = balance;
      const { getSolBalance } = await import("../blockchain/balance.service.js");
      solBalance = (await getSolBalance(wallet.publicKey)).toFixed(4);
    } catch {
      // keep defaults
    }
  }

  const keyboard = new InlineKeyboard()
    .text("Cancel", "close")
    .row()
    .text("✅ W1 (Master)", "cmd:selectedwallet")
    .text("Change Wallet", "cmd:managewallets")
    .row()
    .text("DCA Orders", "cmd:dcaorders")
    .text("Swap", "cmd:swap")
    .text("Limit Orders", "cmd:limitorders")
    .row()
    .text("Buy 1.0 SOL", `trade:buy:${token}:1`)
    .text("Buy 5.0 SOL", `trade:buy:${token}:5`)
    .row()
    .text("Buy X SOL", `trade:buyx:${token}`);

  if (tokenBalance > 0) {
    keyboard
      .row()
      .text("Sell 25%", `trade:sell:${token}:0.25`)
      .text("Sell 50%", `trade:sell:${token}:0.5`)
      .text("Sell 100%", `trade:sell:${token}:1`)
      .row()
      .text("Sell X", `trade:sellx:${token}`);
  }

  keyboard
    .row()
    .url("Open in DexScreener 📊", chartUrl)
    .row()
    .text("Refresh", `trade:refresh:${token}`);

  const priceImpactLine =
    info.priceImpact5SolPct != null
      ? `\nPrice Impact (5.0000 SOL): ${(info.priceImpact5SolPct * 100).toFixed(2)}%`
      : "";

  const tokenBalanceStr =
    tokenBalance > 0
      ? tokenBalance >= 1
        ? tokenBalance.toFixed(2)
        : tokenBalance.toFixed(6)
      : "0";

  const text =
    `*${info.name} | ${info.symbol}*\n` +
    `\`${token}\`\n` +
    `[Explorer](https://solscan.io/account/${token}) | [Chart](${chartUrl})\n\n` +
    `Price: $${formatSmallPrice(Number(info.price))}\n` +
    `5m: ${info.priceChange5m ?? "0.00"}%, 1h: ${info.priceChange1h ?? "0.00"}%, 6h: ${info.priceChange6h ?? "0.00"}%, 24h: ${info.priceChange24h ?? "0.00"}%\n` +
    `Market Cap: $${info.mcap ?? "0"}${priceImpactLine}\n\n` +
    `Wallet: *${solBalance} SOL* | *${tokenBalanceStr}* ${info.symbol}\n\n` +
    `[Share with Ref](https://t.me/aonkbot?start=st_${token})`;

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
    reply_to_message_id: ctx.message?.message_id,
    link_preview_options: { is_disabled: true },
  });
}
