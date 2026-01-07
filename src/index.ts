import { startBot } from './bot.js';

async function bootstrap() {
  try {
    console.log("before the startBot -------------------------------------");
    await startBot();
  } catch (err) {
    console.error('[Fatal] Bot failed to start', err);
    process.exit(1);
  }
}

bootstrap();
