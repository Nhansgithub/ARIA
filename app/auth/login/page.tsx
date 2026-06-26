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
      // Reset loading after timeout in case navigation silently fails and component stays mounted
      setTimeout(() => setLoading(false), 3000)
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
        No account?{' '}
        <a href="/auth/signup" style={{ color: '#63B3ED' }}>
          Sign up
        </a>
      </p>
    </div>
  )
}
