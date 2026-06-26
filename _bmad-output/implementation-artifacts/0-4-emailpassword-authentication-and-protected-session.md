---
baseline_commit: ""
---

# Story 0.4: Email/Password Authentication and Protected Session

Status: ready-for-dev

## Story

As an Owner, I want to sign up and sign in with email and password — and have my session enforced on every route — so that unauthenticated access to ARIA is denied and all data operations are automatically scoped to my account (FR-34, AD-13).

## Acceptance Criteria

1. **Given** the `/auth/login` page is rendered,
   **When** the Owner submits a valid email and password,
   **Then** Supabase Auth creates a session; the Owner is redirected to the app's authenticated home route; the session cookie/token is set.

2. **Given** the `/auth/signup` page is rendered,
   **When** the Owner submits a new valid email and password,
   **Then** Supabase Auth creates the user record in `auth.users`; the Owner may be asked to confirm their email (configurable); on confirmation/completion the Owner is redirected to the authenticated home route.

3. **Given** a user is not authenticated,
   **When** any authenticated route (e.g. `/`, `/chat`, `/settings`) is requested,
   **Then** the request is redirected to `/auth/login`; no owner data is returned in the response.

4. **Given** the Owner has an active session,
   **When** an API route handler or Server Action is called,
   **Then** the handler retrieves the session via `supabase.auth.getUser()` (not from a client-passed token); the handler rejects the request with 401 if no valid session is found.

5. **Given** the Owner logs out,
   **When** the logout action is invoked,
   **Then** the Supabase session is destroyed server-side; subsequent requests to authenticated routes redirect to login.

6. **Given** a valid session exists,
   **When** the session JWT is decoded,
   **Then** `auth.uid()` matches the `owner_id` used by RLS policies — confirming the auth boundary is intact (AD-13).

## Tasks / Subtasks

- [ ] **Task 1: Install Supabase auth packages** (AC: all)
  - [ ] Run `npm install @supabase/supabase-js @supabase/ssr`
  - [ ] Verify both packages appear in `dependencies` in `package.json`

- [ ] **Task 2: Create Supabase client utilities** (AC: 1, 2, 4, 6)
  - [ ] Create `lib/supabase/client.ts` — browser client factory using `createBrowserClient` from `@supabase/ssr`
  - [ ] Create `lib/supabase/server.ts` — server client factory `createServerClient()` using `createServerClient` from `@supabase/ssr` with `next/headers` cookie store
  - [ ] Note: `createServiceClient()` (service-role) is added in Story 0.6; do NOT add it here

- [ ] **Task 3: Create Next.js middleware for route protection** (AC: 3)
  - [ ] Create `middleware.ts` at project root
  - [ ] Middleware refreshes the Supabase session (updates cookies) on every request
  - [ ] If no authenticated user and path does NOT start with `/auth`, redirect to `/auth/login`
  - [ ] Allow all `/auth/*` paths through without auth check
  - [ ] Matcher config excludes `_next/static`, `_next/image`, `favicon.ico`

- [ ] **Task 4: Create auth pages** (AC: 1, 2)
  - [ ] Create `app/auth/login/page.tsx` — Client Component with email/password form; calls `supabase.auth.signInWithPassword()`; redirects to `/` on success
  - [ ] Create `app/auth/signup/page.tsx` — Client Component with email/password form; calls `supabase.auth.signUp()`; shows "Check your email" on success
  - [ ] Create `app/auth/callback/route.ts` — Route Handler that exchanges `code` query param for a Supabase session (`exchangeCodeForSession`); redirects to `/` on success or `/auth/login?error=…` on failure
  - [ ] Create `app/auth/layout.tsx` — minimal centered layout for auth pages (no navigation)

- [ ] **Task 5: Update app home to authenticated stub** (AC: 3, 5, 6)
  - [ ] Update `app/page.tsx` — Server Component showing signed-in user's email; includes logout form; adds server-side `supabase.auth.getUser()` redirect-to-login fallback (defense in depth)
  - [ ] Create `app/actions/auth.ts` — Server Action `logout()` that calls `supabase.auth.signOut()` and redirects to `/auth/login`

- [ ] **Task 6: Document environment variables** (AC: all)
  - [ ] `.env.example` is blocked by deny rules — document as manual prerequisite:
    - `NEXT_PUBLIC_SUPABASE_URL=<your-project-url>` (safe for client)
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>` (safe for client; NOT the service role key)
  - [ ] Note in Completion Notes that user must set these in `.env.local` and Vercel before auth works

- [ ] **Task 7: CI checks and commit** (AC: all)
  - [ ] Run `npm run lint` — must pass
  - [ ] Run `npx tsc --noEmit` — must pass
  - [ ] Run `npm run format:check` — must pass
  - [ ] Commit all new and modified files

## Dev Notes

### Architecture Constraints (Non-Negotiable)

- **AD-13 — Auth boundary.** Owner-data access flows through the authenticated owner's RLS-enforced session. `supabase.auth.getUser()` (server-side) is the only source of identity — NEVER trust a user-passed token. The session cookie is the auth mechanism.
- **AD-11 — Server-side secrets.** `SUPABASE_SERVICE_ROLE_KEY` (added in Story 0.5) is NEVER `NEXT_PUBLIC_`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are deliberately public — the anon key is designed to be safe in browsers; RLS (Story 0.3) is the data protection layer.
- **AD-2 — RLS boundary.** The Supabase JWT `sub` claim maps to `auth.uid()` in RLS. When the server client is created with the session cookies, every query is automatically filtered by the authenticated owner's ID. No manual `owner_id` filter is needed in query code.
- **Story 0.6 dependency.** `createServiceClient()` (service-role key) is defined and lint-enforced in Story 0.6. Do NOT add it here. Story 0.4 only needs `createServerClient()` (anon key + session).

### Packages to Install

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Both go to `dependencies` (not devDependencies) — they run at runtime.

### Environment Variables

These are **NOT secrets** — the Supabase anon key is public-safe because RLS protects data:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL (e.g. `https://abcdef.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your project's anon/public key

They must be set in `.env.local` (local) and in Vercel (production). The `.env.example` file cannot be modified by the dev agent (blocked by permission rules) — the user must add them manually.

### Supabase Client Factories

#### `lib/supabase/client.ts` (browser / Client Components)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Use this in `'use client'` components. Creates a client with cookie-based session management.

#### `lib/supabase/server.ts` (Server Components, Server Actions, Route Handlers)

```typescript
import { createServerClient as createSupabaseSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  const cookieStore = cookies()
  return createSupabaseSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component where cookies are read-only — safe to ignore
          }
        },
      },
    }
  )
}
```

Note: In Next.js 14 `cookies()` is synchronous. The `try/catch` in `setAll` is required — Server Components cannot set cookies; only Server Actions and Route Handlers can. The Supabase SSR client handles this gracefully.

Story 0.6 adds `createServiceClient()` to this same file. Export name `createServerClient` is the canonical name Story 0.6 will reference.

### Middleware (Critical — Gets Route Protection Right)

Create `middleware.ts` at the project root (same level as `package.json`):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Must create a new response on every call so cookies are refreshed
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Always use getUser() not getSession() — getUser() validates the JWT server-side
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

**Critical:** Import `createServerClient` from `@supabase/ssr` directly in middleware (NOT from `lib/supabase/server`). Middleware runs in Edge Runtime; `next/headers` is NOT available there. The middleware must use `request.cookies` and `response.cookies` directly — see the pattern above.

**Critical:** Always use `supabase.auth.getUser()` (not `getSession()`). `getSession()` reads from the cookie without server-side validation and can be spoofed. `getUser()` validates the JWT against the Supabase Auth server on every request.

### Auth Pages

#### `app/auth/layout.tsx`

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#0D1117',
        color: '#E2E8F0',
      }}
    >
      {children}
    </div>
  )
}
```

#### `app/auth/login/page.tsx`

Client Component. Calls `supabase.auth.signInWithPassword()`. On success: `router.push('/')` + `router.refresh()`. On error: display the error message.

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <h1 style={{ marginBottom: 24, fontSize: 24 }}>Sign in to ARIA</h1>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
        </div>
        {error && <p style={{ color: '#FC8181', marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <a href="/auth/signup" style={{ color: '#63B3ED' }}>Sign up</a>
      </p>
    </div>
  )
}
```

#### `app/auth/signup/page.tsx`

Similar to login. Calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '<origin>/auth/callback' } })`. On success show "Check your email" message (email confirmation required). On error display message.

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div>
        <h1>Check your email</h1>
        <p>We sent a confirmation link to <strong>{email}</strong>.</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <h1 style={{ marginBottom: 24, fontSize: 24 }}>Create your ARIA account</h1>
      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: 16 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            />
          </label>
        </div>
        {error && <p style={{ color: '#FC8181', marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Have an account? <a href="/auth/login" style={{ color: '#63B3ED' }}>Sign in</a>
      </p>
    </div>
  )
}
```

#### `app/auth/callback/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=Could+not+authenticate+user`)
}
```

### App Home (Protected Stub)

#### `app/actions/auth.ts`

```typescript
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function logout() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
```

#### `app/page.tsx` (replace existing)

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions/auth'

export default async function HomePage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#0D1117',
        color: '#E2E8F0',
        gap: 16,
      }}
    >
      <h1>ARIA</h1>
      <p style={{ color: '#A0AEC0' }}>Signed in as {user.email}</p>
      <form action={logout}>
        <button type="submit" style={{ padding: '8px 16px' }}>
          Sign out
        </button>
      </form>
    </main>
  )
}
```

### File Summary

| File | Action | Notes |
|------|--------|-------|
| `lib/supabase/client.ts` | NEW | Browser client factory |
| `lib/supabase/server.ts` | NEW | Server client factory (`createServerClient`) |
| `middleware.ts` | NEW | Route protection + session refresh |
| `app/auth/layout.tsx` | NEW | Centered layout for auth pages |
| `app/auth/login/page.tsx` | NEW | Email/password login form |
| `app/auth/signup/page.tsx` | NEW | Email/password signup form |
| `app/auth/callback/route.ts` | NEW | Email confirmation code exchange |
| `app/actions/auth.ts` | NEW | `logout()` Server Action |
| `app/page.tsx` | REPLACE | Authenticated home stub |
| `package.json` | MODIFY | Add `@supabase/supabase-js`, `@supabase/ssr` |

### Supabase Dashboard Setup (Manual Prerequisite)

For local dev with `supabase start` (requires Docker):
- Auth is pre-configured in the local stack; no dashboard needed locally.
- The confirmation email URL must match: `http://localhost:3000/auth/callback`

For production (Supabase cloud):
- In Auth > URL Configuration: add `<your-domain>/auth/callback` to Redirect URLs
- In Auth > Email Templates: email confirmation link points to the callback URL

### Common Pitfalls

1. **`getSession()` vs `getUser()`**: Never use `getSession()` server-side — it reads from the cookie without validation. Always use `getUser()` which performs server-side JWT validation against Supabase Auth.

2. **Middleware imports `@supabase/ssr` directly**: Do not import `createServerClient` from `lib/supabase/server` in middleware — the `next/headers` `cookies()` API is unavailable in Edge Runtime. The middleware creates its own client inline using `request.cookies`.

3. **`router.refresh()` after login**: After `router.push('/')`, call `router.refresh()` to force Next.js to re-fetch server components with the new session cookie. Without it, the protected page may still show stale (unauthenticated) data.

4. **`emailRedirectTo` must be the callback route**: The signup `emailRedirectTo` option must point to `<origin>/auth/callback` — this is the route that exchanges the code for a session. Without the callback route, email confirmation will fail.

5. **TypeScript strict null**: The `process.env.NEXT_PUBLIC_SUPABASE_URL!` non-null assertion is correct — these vars are guaranteed at runtime by the deployment config. Do not add null checks that hide missing-env bugs.

### Testing

No automated tests yet. Manual verification (local with Docker / Supabase Studio, or against cloud Supabase):

1. `npm run dev` — start dev server
2. Navigate to `http://localhost:3000` → should redirect to `/auth/login` (AC3)
3. Sign up with a new email → check email confirmation flow → redirect to `/` on success (AC2)
4. Sign in with existing credentials → redirect to `/` (AC1)
5. Visit `/` as authenticated user → see email displayed (AC4, AC6)
6. Sign out → redirect to `/auth/login`; back to `/` → redirect again to login (AC5)

### Story 0.3 Learnings

- Docker not available for local Supabase — test against cloud Supabase project.
- `.env.*` files blocked by deny rules — document any new env vars in Completion Notes; user sets them manually.
- CI checks (`lint`, `tsc --noEmit`, `format:check`) must all pass before commit.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (create-story)

### Debug Log References

### Completion Notes List

### File List
