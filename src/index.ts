import { startBot } from './bot'

async function bootstrap() {
  await startBot()
  console.log('🚀 System initialized')
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
