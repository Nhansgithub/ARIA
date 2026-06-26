import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSupabaseSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseServiceRoleKey } from '@/lib/secrets'

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
            // Server Components cannot set cookies; safe to ignore here
          }
        },
      },
    }
  )
}

// AD-13: service-role key bypasses RLS entirely.
// NEVER use this factory in request handlers serving owner data.
// Use ONLY in scheduler/system tasks that scope every query to a known owner_id.
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
