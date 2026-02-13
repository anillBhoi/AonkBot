import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer | null {
  const hex = process.env.TOTP_ENC_KEY
  if (!hex) return null
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) return null
  return buf
}

export function encrypt(text: string): string {
  const key = getKey()
  if (!key) {
    // no encryption configured — return plaintext (not recommended for prod)
    return `PLAIN::${text}`
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`
}

export function decrypt(payload: string): string | null {
  const key = getKey()
  if (!key) {
    // If payload begins with PLAIN::, return remainder
    if (payload.startsWith('PLAIN::')) return payload.slice('PLAIN::'.length)
    return null
  }

  const parts = payload.split(':')
  if (parts.length !== 3) return null
  const iv = Buffer.from(parts[0], 'hex')
  const ct = Buffer.from(parts[1], 'hex')
  const tag = Buffer.from(parts[2], 'hex')
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    return plain
  } catch (e) {
    return null
  }
}