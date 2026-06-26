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
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ marginBottom: 16 }}>Check your email</h1>
        <p style={{ color: '#A0AEC0' }}>
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
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
        Have an account?{' '}
        <a href="/auth/login" style={{ color: '#63B3ED' }}>
          Sign in
        </a>
      </p>
    </div>
  )
}
