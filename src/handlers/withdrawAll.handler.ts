import { Context } from "grammy";
import { setWithdrawState } from "../core/state/withdraw.state.js";

export async function withdrawAllHandler(ctx: Context){

    const userId = ctx.from?.id;
    if(!userId) return;

    setWithdrawState(userId,{
        step: "awaiting_address", 
        amount: -1 // -1 means withdraw full balance
    });

    await ctx.reply("Enter destination wallet address:");
}