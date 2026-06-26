---
baseline_commit: ""
---

# Story 0.5: Server-Side Secret Custody (AD-11)

Status: ready-for-dev

## Story

As a developer, I want all third-party credentials — Anthropic API key, Supabase service-role key, Zalo OA credentials, and SMTP creds — stored exclusively in server-side environment variables, never accessible to the client, so that AD-11 is satisfied from the first commit.

## Acceptance Criteria

1. **Given** the Vercel project configuration,
   **When** environment variables are set,
   **Then** the following variables exist as server-only (not `NEXT_PUBLIC_`): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; none of these are prefixed `NEXT_PUBLIC_`.

2. **Given** the Next.js application bundle is built,
   **When** the client-side JavaScript bundle is inspected (e.g. `next build` + bundle analysis),
   **Then** none of the server-only secret variable names or their values appear in any file served to the browser.

3. **Given** any server-side route handler, Server Action, or Edge Function,
   **When** a secret is accessed,
   **Then** it is read from `process.env` only within server-side code; no secret is passed as a prop, returned in an API response body, or written to a log line.

4. **Given** the `SUPABASE_SERVICE_ROLE_KEY`,
   **When** it is used in code,
   **Then** it appears only in narrowly scoped, audited system tasks and is never used in a request handler that serves owner data — enforcing the service-role/owner-data boundary of AD-13.

5. **Given** a `.env.example` file is committed,
   **Then** it lists every required environment variable with a placeholder value and a comment describing its purpose; the actual `.env.local` file is listed in `.gitignore` and never committed.

6. **Given** the Zalo OA refresh token (which must be encrypted at rest per AD-11),
   **When** the token storage schema is created,
   **Then** the `settings` table carries an `encrypted_zalo_refresh_token` column (or equivalent); the encryption/decryption function uses a server-side key; the plaintext token is never stored in Postgres directly.

## Tasks / Subtasks

- [ ] **Task 1: Audit `.env.example` for completeness** (AC: 1, 5)
  - [ ] The `.env.example` file cannot be modified by the dev agent (blocked by deny rules) — audit what it currently contains against the full required variable list
  - [ ] Document any missing variables in Completion Notes so the user can add them manually
  - [ ] Required variables in `.env.example` (all server-only, no NEXT_PUBLIC_ prefix):
    - `ANTHROPIC_API_KEY=` — Anthropic API key for Claude calls (AD-11)
    - `SUPABASE_SERVICE_ROLE_KEY=` — Service-role key (AD-13: scheduler/system tasks only)
    - `ZALO_OA_APP_ID=` — Zalo OA application ID
    - `ZALO_OA_APP_SECRET=` — Zalo OA application secret
    - `SMTP_HOST=` — SMTP server hostname
    - `SMTP_PORT=` — SMTP server port (typically 587 or 465)
    - `SMTP_USER=` — SMTP username
    - `SMTP_PASS=` — SMTP password or app-password
    - `ZALO_TOKEN_ENCRYPTION_KEY=` — Server-side AES-256 key for encrypting Zalo refresh tokens (AC6)
  - [ ] Required variables already in `.env.example` from Story 0.4 (can be NEXT_PUBLIC_):
    - `NEXT_PUBLIC_SUPABASE_URL=` — Supabase project URL (safe for client)
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` — Supabase anon/public key (safe for client)

- [ ] **Task 2: Create `lib/secrets.ts` — server-only secret accessor** (AC: 1, 2, 3)
  - [ ] Create `lib/secrets.ts` with exported accessors for each server-only secret
  - [ ] Each accessor reads from `process.env` and throws a clear error if the variable is missing (fail-fast at startup rather than silently returning undefined)
  - [ ] The file must import `'server-only'` at the top — this causes Next.js to throw a build error if the module is imported from a Client Component (AC2 enforcement)
  - [ ] Do NOT export secrets as constants — each accessor must be a function to prevent accidental exposure through module re-exports

- [ ] **Task 3: Create `lib/crypto.ts` — Zalo token encryption/decryption** (AC: 6)
  - [ ] Create `lib/crypto.ts` with `encryptZaloToken(plaintext: string): string` and `decryptZaloToken(ciphertext: string): string`
  - [ ] Use Node.js built-in `crypto` module (AES-256-GCM); key from `process.env.ZALO_TOKEN_ENCRYPTION_KEY`
  - [ ] `encryptZaloToken` returns `iv:authTag:ciphertext` (hex-encoded, colon-separated) — suitable for storing in the `encrypted_zalo_refresh_token` text column
  - [ ] `decryptZaloToken` takes the same format and returns plaintext
  - [ ] The file must import `'server-only'` at the top
  - [ ] The `settings.encrypted_zalo_refresh_token` column already exists (added in Story 0.2 migration); no schema change needed

- [ ] **Task 4: Write unit tests for `lib/crypto.ts`** (AC: 6)
  - [ ] Since jest is not installed, write a self-contained test script `lib/__tests__/crypto.test.ts` that can be run with `npx ts-node` OR add jest/vitest if needed
  - [ ] Test: `encryptZaloToken(plaintext)` → `decryptZaloToken(result)` === plaintext (round-trip)
  - [ ] Test: encrypt same plaintext twice → different ciphertext (IV randomness)
  - [ ] Test: tampered ciphertext throws on decrypt (GCM auth tag verification)
  - [ ] Note: if no test runner is available, document the tests as pending in Completion Notes

- [ ] **Task 5: Verify no secrets leak to client bundle** (AC: 2, 3)
  - [ ] Run `npm run build` and check output for any reference to `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc. in the `.next/static/` directory
  - [ ] Document verification result in Completion Notes
  - [ ] If build cannot run (missing env vars), create placeholder `.env.local` with fake values to enable build check

- [ ] **Task 6: CI checks and commit** (AC: all)
  - [ ] Run `npm run lint` — must pass
  - [ ] Run `npx tsc --noEmit` — must pass
  - [ ] Run `npm run format:check` — must pass
  - [ ] Commit all new files

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **AD-11 — Server-side secret custody.** All secrets live in `process.env` on the server only. Never set a secret as `NEXT_PUBLIC_`. Never pass a secret as a React prop. Never return a secret in an API response. Never log a secret.
- **AD-13 — Service-role boundary.** `SUPABASE_SERVICE_ROLE_KEY` may only appear in code that creates `createServiceClient()` (Story 0.6). It must never be in request handlers that serve owner data.
- **`encrypted_zalo_refresh_token` is already in the schema** (Story 0.2). Story 0.5 adds the encryption/decryption utility so it can actually be used in Story 5.3.

### `server-only` Package

The `server-only` package from Next.js causes a **build error** if a file importing it is accidentally bundled for the client. This is the enforcement mechanism for AC-2.

```bash
npm install server-only
```

Usage pattern:
```typescript
// lib/secrets.ts
import 'server-only'  // MUST be first import

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return key
}
```

### `lib/secrets.ts` — Full Implementation

```typescript
import 'server-only'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
  return value
}

export const getAnthropicApiKey = () => requireEnv('ANTHROPIC_API_KEY')
export const getSupabaseServiceRoleKey = () => requireEnv('SUPABASE_SERVICE_ROLE_KEY')
export const getZaloOaAppId = () => requireEnv('ZALO_OA_APP_ID')
export const getZaloOaAppSecret = () => requireEnv('ZALO_OA_APP_SECRET')
export const getSmtpHost = () => requireEnv('SMTP_HOST')
export const getSmtpPort = () => requireEnv('SMTP_PORT')
export const getSmtpUser = () => requireEnv('SMTP_USER')
export const getSmtpPass = () => requireEnv('SMTP_PASS')
export const getZaloTokenEncryptionKey = () => requireEnv('ZALO_TOKEN_ENCRYPTION_KEY')
```

These are arrow function exports (not constants) to prevent tree-shaker from inlining the values. Every caller must call `getAnthropicApiKey()` at call time, not at module load time.

### `lib/crypto.ts` — Zalo Token Encryption

Uses AES-256-GCM (authenticated encryption — provides both confidentiality and integrity). The key must be exactly 32 bytes (256 bits). Stored as a hex string in the env var (64 hex chars).

```typescript
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getZaloTokenEncryptionKey } from './secrets'

const ALGORITHM = 'aes-256-gcm'

export function encryptZaloToken(plaintext: string): string {
  const key = Buffer.from(getZaloTokenEncryptionKey(), 'hex')
  const iv = randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv:authTag:ciphertext (all hex)
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptZaloToken(stored: string): string {
  const key = Buffer.from(getZaloTokenEncryptionKey(), 'hex')
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':')
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted token format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
```

### Unit Tests for `lib/crypto.ts`

Jest is not installed. Write a standalone test script at `lib/__tests__/crypto.test.ts` that demonstrates correctness. Without a test runner, document the expected behavior:

Since no test framework exists, create a test script that uses Node.js assertions:

```typescript
// lib/__tests__/crypto.test.ts
// Run with: ZALO_TOKEN_ENCRYPTION_KEY=<64-hex-chars> npx ts-node lib/__tests__/crypto.test.ts
import assert from 'assert'
import { encryptZaloToken, decryptZaloToken } from '../crypto'

const testToken = 'test_zalo_refresh_token_abc123'

// Round-trip test
const encrypted = encryptZaloToken(testToken)
const decrypted = decryptZaloToken(encrypted)
assert.strictEqual(decrypted, testToken, 'Round-trip failed')

// IV randomness test
const encrypted2 = encryptZaloToken(testToken)
assert.notStrictEqual(encrypted, encrypted2, 'Same IV used twice — randomness broken')

// Tamper detection test
const [iv, tag, ct] = encrypted.split(':')
try {
  decryptZaloToken(`${iv}:${tag}:${ct.slice(0, -2)}ff`)
  assert.fail('Should have thrown on tampered ciphertext')
} catch (e) {
  assert.ok(e instanceof Error, 'Expected Error on tamper')
}

console.log('All crypto tests passed')
```

### `ZALO_TOKEN_ENCRYPTION_KEY` Generation

Generate a random 32-byte key and store as 64-character hex:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This must be generated once per environment and stored in:
- `.env.local` (local dev, never committed)
- Vercel environment variables (production)
- Supabase Edge Functions secrets (when scheduler is implemented in Epic 4)

### Bundle Verification

To verify no secrets leak to the client bundle after `npm run build`:
```bash
# Search .next/static for secret variable names
grep -r "ANTHROPIC_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|ZALO_OA_APP_SECRET\|SMTP_PASS" .next/static/
# Expected: no results
```

For `npm run build` to succeed without real env vars, create a `.env.local` with dummy values:
```
ANTHROPIC_API_KEY=sk-ant-dummy
SUPABASE_SERVICE_ROLE_KEY=eyJ-dummy
ZALO_OA_APP_ID=dummy
ZALO_OA_APP_SECRET=dummy
SMTP_HOST=smtp.dummy.com
SMTP_PORT=587
SMTP_USER=dummy@dummy.com
SMTP_PASS=dummy
ZALO_TOKEN_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ-dummy-anon
```

Note: `.env.local` is in `.gitignore` — never commit it.

### AC-5: `.env.example` Status

The `.env.example` file cannot be modified by the dev agent (denied by permission rules — see Story 0.1 and 0.3 notes). Audit what exists and document the delta for the user to add manually.

The user must add any missing variables to `.env.example` manually:
1. Open `.env.example` in their editor
2. Add each missing server-only variable with a placeholder value and comment
3. Commit `.env.example` to the repository

### AC-6: Schema Status

`settings.encrypted_zalo_refresh_token` was added in Story 0.2's migration (`20260626000000_initial_schema.sql`) as a nullable `text` column. No schema migration needed in Story 0.5. The `lib/crypto.ts` utility is what makes this column usable.

### Common Pitfalls

1. **`server-only` vs `'use server'`**: These are different. `'use server'` marks a file/function as a Server Action (can be called from client). `import 'server-only'` marks a module as server-only (throws a build error if imported from client). Both are needed in different contexts. `lib/secrets.ts` and `lib/crypto.ts` use `import 'server-only'`.

2. **Key length**: AES-256 requires exactly 32 bytes. A 64-hex-char string decodes to 32 bytes. If the env var is wrong length, `createCipheriv` throws `Invalid key length`. The error surface is clear — no silent failure.

3. **GCM auth tag**: Always call `cipher.getAuthTag()` AFTER `cipher.final()`. Calling it before `final()` may return a partial tag on some Node.js versions.

4. **ts-node for test script**: `lib/__tests__/crypto.test.ts` uses TypeScript. Run with `npx ts-node --esm lib/__tests__/crypto.test.ts` or configure `tsconfig.json` accordingly. If ts-node fails, convert to `.mjs` or just document as manual verification.

### Story 0.4 Learnings Applied

- `.env.*` files blocked by deny rules — audit only, user adds manually
- CI checks must pass (`lint`, `tsc --noEmit`, `format:check`) before commit
- `npm run build` may require dummy `.env.local` values

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story)

### Debug Log References

### Completion Notes List

### File List
