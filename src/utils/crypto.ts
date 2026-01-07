import crypto from 'crypto'
import { config } from './config.js'

const ALGO = 'aes-256-gcm'

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    ALGO,
    Buffer.from(config.encryptionSecret, 'hex'),
    iv
  )
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
    tag: tag.toString('hex')
  }
}
