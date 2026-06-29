'use client'

import { useRef, useEffect, useState } from 'react'
import { Send, Square, Paperclip, X } from 'lucide-react'

interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  pendingImage?: File | null
  onImageAttach?: (file: File) => void
  onImageRemove?: () => void
  imageError?: string | null
}

const LINE_HEIGHT = 24 // px — 15px font * 1.6

export function InputBar({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  pendingImage,
  onImageAttach,
  onImageRemove,
  imageError,
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Derive blob URL from pendingImage for the chip thumbnail
  useEffect(() => {
    if (!pendingImage) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingImage)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])

  // Auto-grow the textarea (1 to 5 lines)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT * 5 + 24)}px`
  }, [value])

  const canSend = !isStreaming && (value.trim().length > 0 || Boolean(pendingImage))

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
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
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        borderTop: '1px solid #2a3350',
        background: '#0a0e27',
      }}
    >
      {/* Image preview chip */}
      {pendingImage && previewUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={previewUrl}
            alt="Image to send"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              objectFit: 'cover',
              border: '1px solid #2A3350',
              flexShrink: 0,
            }}
          />
          <button
            onClick={onImageRemove}
            aria-label="Remove image"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid #14b8a6'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
              e.currentTarget.style.outlineOffset = '0'
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Inline image error */}
      {imageError && (
        <span
          style={{
            color: '#f87171',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {imageError}
        </span>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {/* Paperclip attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          aria-label="Attach image"
          style={{
            minWidth: 36,
            minHeight: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid #2a3350',
            borderRadius: 8,
            color: isStreaming ? '#4a5568' : '#94a3b8',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          <Paperclip size={16} />
        </button>

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
              if (canSend) onSend()
            }}
            disabled={!canSend}
            aria-label="Send message"
            style={{
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: canSend ? '#14b8a6' : '#2a3350',
              border: 'none',
              borderRadius: 8,
              color: canSend ? '#0a0e27' : '#94a3b8',
              cursor: canSend ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <Send size={16} />
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImageAttach?.(file)
          e.target.value = '' // reset so same file can be re-attached
        }}
      />
    </div>
  )
}
