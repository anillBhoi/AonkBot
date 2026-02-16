import type { VercelRequest, VercelResponse } from "@vercel/node";
import { webhookCallback } from "grammy";
import { bot, initBot } from "../src/bot.js";

const handler = webhookCallback(bot, "http");

export default async function (req: VercelRequest, res: VercelResponse) {
  await initBot();          // registers handlers once
  return handler(req, res); // handles Telegram update
}
