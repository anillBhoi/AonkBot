// src/index.ts
import { startBotPolling } from "./bot.js";

async function bootstrap() {
  try {
    console.log("[Bot] Starting AonkBot (local polling)...");
    await startBotPolling();
  } catch (err) {
    console.error("[Fatal] Bot failed to start");
    console.error("Error:", err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error("[Fatal] Bootstrap error");
  console.error("Error:", err);
  process.exit(1);
});
