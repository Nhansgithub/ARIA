'use client'

import { useState } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { detectLanguage } from '@/lib/language/detectLanguage'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stopped?: boolean
  degraded?: boolean
  thumbnailUrl?: string // local blob URL for display only; not persisted or sent to API
}

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  isLastMessage?: boolean
  expanded: boolean
  onExpand: () => void
  onRetry?: () => void
}

const COLLAPSE_THRESHOLD = 400

function formatTimestamp(date: Date): string {
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const time = date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (isToday) return time

  const day = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `${day} ${time}`
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .trim()
}

export function MessageBubble({
  message,
  isStreaming,
  isLastMessage,
  expanded,
  onExpand,
  onRetry,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'
  const showCursor = isStreaming && isLastMessage && !isUser
  // AC-5: lang attribute for screen-reader pronunciation support.
  // Both user and ARIA bubbles use detectLanguage — user bubbles are typically 'vi' but English
  // users should not have their text announced with Vietnamese phonology.
  const bubbleLang = detectLanguage(message.content)
  // Never collapse while the message is actively streaming — the content
  // crosses 400 chars mid-stream and a collapse at that moment is disorienting.
  const isCollapsible =
    !isUser && !(isStreaming && isLastMessage) && message.content.length > COLLAPSE_THRESHOLD
  const showCollapsed = isCollapsible && !expanded

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(stripMarkdown(message.content))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable in some contexts
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
        maxWidth: '100%',
      }}
    >
      {isUser ? (
        /* User bubble */
        <div
          lang={bubbleLang}
          style={{
            background: '#1c2440',
            borderRadius: '12px 12px 4px 12px',
            padding: '12px 16px',
            maxWidth: '75%',
            color: '#e2e8f0',
            fontSize: 15,
            lineHeight: 1.65,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.thumbnailUrl && (
            <img
              src={message.thumbnailUrl}
              alt="Attached image"
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                objectFit: 'cover',
                border: '1px solid #2A3350',
                marginBottom: message.content ? 8 : 0,
                display: 'block',
              }}
            />
          )}
          {message.content}
          {/* Screen-reader label for image-only messages (no text content) */}
          {!message.content && message.thumbnailUrl && (
            <span
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              (image attached)
            </span>
          )}
        </div>
      ) : (
        /* ARIA bubble */
        <div
          lang={bubbleLang}
          className="aria-msg-bubble"
          style={{
            position: 'relative',
            background: '#141a2e',
            borderRadius: '12px 12px 12px 4px',
            borderLeft: '2px solid #14b8a6',
            padding: '12px 16px',
            maxWidth: '85%',
            minWidth: 48,
            wordBreak: 'break-word',
          }}
        >
          {/* Copy button */}
          <button
            className="aria-msg-copy-btn"
            onClick={handleCopy}
            aria-label="Copy message"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {copied ? <Check size={14} color="#14b8a6" /> : <Copy size={14} />}
          </button>

          {/* Message content — live region is off during streaming to avoid
              a screen-reader torrent of per-token announcements */}
          <div
            aria-live={isStreaming && isLastMessage ? 'off' : 'polite'}
            style={{ paddingRight: message.content ? 24 : 0 }}
          >
            {showCollapsed ? (
              <div style={{ position: 'relative' }}>
                <div style={{ maxHeight: 120, overflow: 'hidden' }}>
                  <MarkdownRenderer content={message.content} />
                </div>
                {/* Gradient fade */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 48,
                    background: 'linear-gradient(transparent, #141a2e)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}

            {/* Streaming cursor */}
            {showCursor && <span className="aria-streaming-cursor" aria-hidden="true" />}

            {/* Stopped suffix */}
            {message.stopped && <span style={{ color: '#94a3b8', fontSize: 13 }}> (stopped)</span>}
          </div>

          {/* Read more */}
          {showCollapsed && (
            <button
              onClick={onExpand}
              style={{
                marginTop: 8,
                background: 'transparent',
                border: 'none',
                color: '#14b8a6',
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Read more
            </button>
          )}

          {/* Retry button — visible only for degraded messages when not streaming */}
          {message.degraded && !isStreaming && onRetry && (
            <button
              onClick={onRetry}
              aria-label="Retry AI response"
              style={{
                marginTop: 8,
                background: 'transparent',
                border: '1px solid rgba(245,158,11,0.40)',
                color: '#F59E0B',
                fontSize: 12,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 10px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RotateCcw size={12} aria-hidden="true" />
              {bubbleLang === 'vi' ? 'Thử lại' : 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* Timestamp */}
      <span
        style={{
          fontSize: 12,
          color: '#94a3b8',
          marginTop: 4,
          marginLeft: isUser ? 0 : 4,
          marginRight: isUser ? 4 : 0,
        }}
      >
        {formatTimestamp(message.timestamp)}
      </span>
    </div>
  )
}
