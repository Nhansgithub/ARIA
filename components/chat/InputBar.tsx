'use client'

import { useRef, useEffect } from 'react'
import { Send, Square } from 'lucide-react'

interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
}

const LINE_HEIGHT = 24 // px — 15px font * 1.6

export function InputBar({ value, onChange, onSend, onStop, isStreaming }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea (1 to 5 lines)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * 5 + 24)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isStreaming && value.trim()) onSend()
    }
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault()
      onStop()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid #2a3350',
        background: '#0a0e27',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        placeholder="Nhắn ARIA… / Message ARIA…"
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: '#141a2e',
          border: '1px solid #2a3350',
          borderRadius: 12,
          padding: '10px 14px',
          color: isStreaming ? 'rgba(226,232,240,0.5)' : '#e2e8f0',
          fontSize: 15,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          lineHeight: `${LINE_HEIGHT}px`,
          outline: 'none',
          overflowY: 'auto',
          cursor: isStreaming ? 'not-allowed' : 'text',
          opacity: isStreaming ? 0.5 : 1,
          transition: 'border-color 0.15s, box-shadow 0.15s, opacity 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#14b8a6'
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(20,184,166,0.20)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#2a3350'
          e.currentTarget.style.boxShadow = 'none'
        }}
        aria-label="Message input"
      />

      {isStreaming ? (
        /* Stop button */
        <button
          onClick={onStop}
          aria-label="Stop generation / Dừng lại"
          style={{
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'transparent',
            border: '1px solid #f87171',
            borderRadius: 8,
            color: '#f87171',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: 'pointer',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <Square size={16} />
          <span style={{ fontSize: 13 }}>Dừng</span>
        </button>
      ) : (
        /* Send button */
        <button
          onClick={() => {
            if (value.trim()) onSend()
          }}
          disabled={!value.trim()}
          aria-label="Send message"
          style={{
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: value.trim() ? '#14b8a6' : '#2a3350',
            border: 'none',
            borderRadius: 8,
            color: value.trim() ? '#0a0e27' : '#94a3b8',
            cursor: value.trim() ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <Send size={16} />
        </button>
      )}
    </div>
  )
}
