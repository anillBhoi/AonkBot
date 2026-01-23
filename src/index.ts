import { startBot } from './bot.js';

async function bootstrap() {
  try {
    console.log('[Bot] Starting AonkBot...');
    await startBot();
  } catch (err) {
    console.error('[Fatal] Bot failed to start');
    console.error('Error:', err);
    if (err instanceof Error) {
      console.error('Message:', err.message);
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }
}

bootstrap().catch(err => {
  console.error('[Fatal] Bootstrap error');
  console.error('Error:', err);
  if (err instanceof Error) {
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
  }
  process.exit(1);
});
