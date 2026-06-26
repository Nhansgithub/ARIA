import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getZaloTokenEncryptionKey } from './secrets'

const ALGORITHM = 'aes-256-gcm'

function resolveEncryptionKey(): Buffer {
  const hex = getZaloTokenEncryptionKey()
  if (hex.length !== 64) {
    throw new Error(
      `ZALO_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes); got ${hex.length}`
    )
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error('ZALO_TOKEN_ENCRYPTION_KEY contains non-hex characters')
  }
  return key
}

export function encryptZaloToken(plaintext: string): string {
  const key = resolveEncryptionKey()
  const iv = randomBytes(12) // 96-bit IV — NIST-recommended for AES-GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag() // must be called after final()
  // Stored format: iv:authTag:ciphertext (all hex, colon-separated)
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptZaloToken(stored: string): string {
  const key = resolveEncryptionKey()
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
  // Accumulate into a single Buffer before decoding to avoid multi-byte UTF-8 split corruption
  const plainBuf = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plainBuf.toString('utf8')
}
