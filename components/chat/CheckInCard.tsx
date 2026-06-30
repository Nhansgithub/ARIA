'use client'

import { useState } from 'react'

export interface CheckInCardData {
  id: string
  deal_id: string
  deal_title: string
  trigger_type: 'stale_7d' | 'pre_action_due' | 'cadence_followup'
  due_date: string
  prompt: string
}

interface CheckInCardProps {
  checkIn: CheckInCardData
  onDismiss: (id: string) => void
}

const QUICK_REPLY_BUTTONS: { label: string; value: 'yes' | 'no' | 'later' }[] = [
  { label: 'Có', value: 'yes' },
  { label: 'Không', value: 'no' },
  { label: 'Để sau', value: 'later' },
]

export function CheckInCard({ checkIn, onDismiss }: CheckInCardProps) {
  const [loading, setLoading] = useState(false)

  async function handleAnswer(answer: 'yes' | 'no' | 'later' | 'skipped') {
    if (loading) return
    setLoading(true)
    try {
      await fetch(`/api/check-ins/${checkIn.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
    } catch {
      // AD-6: silently continue — card is dismissed regardless
    } finally {
      setLoading(false)
      onDismiss(checkIn.id)
    }
  }

  return (
    <div
      style={{
        background: '#141a2e',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 6,
        padding: '12px 14px',
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Header row: deal title + dismiss */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#f59e0b',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: '0.04em',
          }}
        >
          {checkIn.deal_title}
        </span>
        <button
          aria-label="Bỏ qua"
          onClick={() => handleAnswer('skipped')}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#94a3b8',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 4px',
            opacity: loading ? 0.5 : 1,
          }}
        >
          ×
        </button>
      </div>

      {/* AI-generated question */}
      <span
        style={{
          fontSize: 13,
          color: '#e2e8f0',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          lineHeight: 1.4,
        }}
      >
        {checkIn.prompt}
      </span>

      {/* Quick-reply buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_REPLY_BUTTONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleAnswer(value)}
            disabled={loading}
            style={{
              background: '#1e2a45',
              border: '1px solid #2A3350',
              borderRadius: 6,
              padding: '6px 14px',
              color: '#e2e8f0',
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#263352'
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1e2a45'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
