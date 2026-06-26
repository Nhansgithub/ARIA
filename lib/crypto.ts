import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getZaloTokenEncryptionKey } from './secrets'

const ALGORITHM = 'aes-256-gcm'

export function encryptZaloToken(plaintext: string): string {
  const key = Buffer.from(getZaloTokenEncryptionKey(), 'hex')
  const iv = randomBytes(12) // 96-bit IV — recommended for AES-GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag() // must be called after final()
  // Stored format: iv:authTag:ciphertext (all hex, colon-separated)
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptZaloToken(stored: string): string {
  const key = Buffer.from(getZaloTokenEncryptionKey(), 'hex')
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format: expected iv:authTag:ciphertext')
  }
  // Length checked above — elements are guaranteed to be strings
  const ivHex = parts[0]!
  const authTagHex = parts[1]!
  const ciphertextHex = parts[2]!
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
