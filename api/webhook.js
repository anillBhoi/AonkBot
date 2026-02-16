// api/webhook.ts
import { webhookCallback } from "grammy";
import { bot, initBot } from "../src/bot.js";
export default async function handler(req, res) {
    // ensure handlers are registered on cold start
    await initBot();
    // hand over request to grammy
    return webhookCallback(bot, "http")(req, res);
}
