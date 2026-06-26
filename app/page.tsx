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
