// import crypto from 'crypto'
// import { config } from './config.js'

// const ALGO = 'aes-256-gcm'

// export function encrypt(text: string) {
//   const iv = crypto.randomBytes(16)
//   const cipher = crypto.createCipheriv(
//     ALGO,
//     Buffer.from(config.encryptionSecret, 'hex'),
//     iv
//   )
//   const encrypted = Buffer.concat([
//     cipher.update(text, 'utf8'),
//     cipher.final()
//   ])
//   const tag = cipher.getAuthTag()

//   return {
//     iv: iv.toString('hex'),
//     content: encrypted.toString('hex'),
//     tag: tag.toString('hex')
//   }
// }



import crypto from 'crypto'
import { config } from './config.js'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 16

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = Buffer.from(config.encryptionSecret, 'hex')

  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ])

  const tag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex')
  ].join('.')
}



export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split('.')

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(dataHex, 'hex')
  const key = Buffer.from(config.encryptionSecret, 'hex')

  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}
