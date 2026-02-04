import { Context } from "grammy";
import { setWithdrawState } from "../core/state/withdraw.state.js";

export async function withdrawXHandler(ctx: Context){
      
    const userId = ctx.from?.id;
    if(!userId) return;

    setWithdrawState(userId, {
        step: "awaiting_amount"
    });

    await ctx.reply("Enter amount of SOL to withdraw: ");
}