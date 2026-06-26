// Crypto round-trip test script
// Usage (set a valid 64-hex-char key before running):
//   ZALO_TOKEN_ENCRYPTION_KEY=<64-hex-chars> npx ts-node lib/__tests__/crypto.test.ts
//
// Generate a test key:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// No test framework — uses Node.js assert module.

import assert from 'assert'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Inline the crypto logic to avoid 'server-only' import boundary in test context
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ZALO_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ZALO_TOKEN_ENCRYPTION_KEY must be set as a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

function decrypt(stored: string): string {
  const key = getKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid format: expected iv:authTag:ciphertext')
  // Length checked above — elements are guaranteed strings
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

// Set test key if not provided
if (!process.env.ZALO_TOKEN_ENCRYPTION_KEY) {
  process.env.ZALO_TOKEN_ENCRYPTION_KEY =
    '0000000000000000000000000000000000000000000000000000000000000001'
}

const TEST_TOKEN = 'zalo_refresh_abc123_test_token_value'

// Test 1: round-trip
const enc1 = encrypt(TEST_TOKEN)
assert.strictEqual(decrypt(enc1), TEST_TOKEN, 'Round-trip: decrypted must equal original')
console.log('  round-trip: OK')

// Test 2: IV randomness
const enc2 = encrypt(TEST_TOKEN)
assert.notStrictEqual(enc1, enc2, 'IV randomness: two encryptions must differ')
console.log('  IV randomness: OK')

// Test 3: tamper detection (GCM auth tag rejects modified ciphertext)
const splitParts = enc1.split(':')
const iv = splitParts[0]!
const tag = splitParts[1]!
const ct = splitParts[2]!
const tampered = `${iv}:${tag}:${ct.slice(0, -2)}ff`
assert.throws(() => decrypt(tampered), Error, 'Tamper detection: must throw on modified ciphertext')
console.log('  tamper detection: OK')

// Test 4: invalid format
assert.throws(() => decrypt('noColons'), Error, 'Invalid format: must throw')
assert.throws(() => decrypt('a:b:c:d'), Error, 'Too many colons: must throw')
console.log('  invalid format: OK')

console.log('\nAll crypto tests passed.')
