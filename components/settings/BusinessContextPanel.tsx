'use client'

import { useEffect, useRef, useState } from 'react'
import { MAX_BUSINESS_CONTEXT_CHARS } from '@/lib/businessContext/constants'

const PLACEHOLDER = `My agency overview:
- Services: [web design, web apps, automation, etc.]
- Typical pricing: web design 20-80M VND, apps 60-150M VND
- Target clients: [SMEs in F&B / retail / professional services]

Pricing rules:
- Always request 30-50% deposit on signing
- Price floor for web design: 20M VND

Follow-up cadences:
- Warm leads: follow up within 3 days if no response
- Cold leads after proposal: 1 week then 1 month

My agency's strengths:
- [describe what you do best]`

export function BusinessContextPanel() {
  const [content, setContent] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetch('/api/business-context')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((data) => {
        const ctx = data.businessContext ?? ''
        setContent(ctx)
        setInitialContent(ctx)
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/business-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessContext: content }),
      })
      if (!res.ok) throw new Error('save failed')
      setInitialContent(content)
      setStatus('saved')
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = content !== initialContent
  const charCount = content.length
  const overBudget = charCount > MAX_BUSINESS_CONTEXT_CHARS

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#e2e8f0',
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>
        Business Context
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
        ARIA loads this context at the start of every session. Include your agency services, pricing
        benchmarks, follow-up cadences, and any rules you want ARIA to remember.
      </p>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setStatus('idle')
            }}
            placeholder={PLACEHOLDER}
            rows={20}
            style={{
              width: '100%',
              background: '#141a2e',
              border: `1px solid ${overBudget ? '#ef4444' : '#2a3350'}`,
              borderRadius: 8,
              padding: '12px 14px',
              color: '#e2e8f0',
              fontSize: 14,
              lineHeight: 1.65,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Budget indicator */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: overBudget ? '#ef4444' : '#94a3b8',
              }}
            >
              {charCount.toLocaleString()} / {MAX_BUSINESS_CONTEXT_CHARS.toLocaleString()} chars
              {overBudget && ' — will be trimmed before injection'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {status === 'saved' && <span style={{ fontSize: 13, color: '#14b8a6' }}>Saved</span>}
              {status === 'error' && (
                <span style={{ fontSize: 13, color: '#ef4444' }}>Save failed — try again</span>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                style={{
                  background: isDirty && !saving ? '#14b8a6' : '#2a3350',
                  color: isDirty && !saving ? '#0a0e27' : '#64748b',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
