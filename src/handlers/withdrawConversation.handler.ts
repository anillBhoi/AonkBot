import { Context, InlineKeyboard } from "grammy";
import { getWithdrawState, setWithdrawState } from "../core/state/withdraw.state.js";

export async function withdrawConversationHandler(ctx: Context){

    const userId = ctx.from?.id;
    if(!userId) return;

    const state = getWithdrawState(userId);

    if(!state) return;

    const text = ctx.message?.text;
    if(!text) return;

    // step 1 amount

    if(state.step === "awaiting_amount") {
        const amount = Number(text);

        if(isNaN(amount) || amount <= 0) {
            await ctx.reply("❌ Invalid amount. Enter valid SOL amount.");
            return;
        }

        setWithdrawState(userId, {
            step: "awaiting_address",
            amount
        });

        await ctx.reply("📩 Enter destination wallet address:");
        return;
    }

    // step 2 destination 
    if(state.step === "awaiting_address") {
        state.destination = text;

        setWithdrawState(userId, {
            ...state, 
            step: "confirming"
        });

        const keyboard = new InlineKeyboard()
             .text("✅ Confirm Withdraw", "confirm_withdraw")
             .row()
             .text("❌ Cancel", "cancel_withdraw");

             const amountText = 
                  state.amount === -1
                    ? "ALL SOL"
                    : `${state.amount} SOL`;

                    await ctx.reply(
                        `Withdraw Preview
                        
                        Amount: ${amountText}
                        Destination: ${state.destination}
                        
                        confirm transaction`, 
                        {reply_markup: keyboard}
                    );
    }
}