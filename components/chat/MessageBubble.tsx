'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stopped?: boolean
}

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  isLastMessage?: boolean
  expanded: boolean
  onExpand: () => void
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
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'
  const showCursor = isStreaming && isLastMessage && !isUser
  const isCollapsible = !isUser && message.content.length > COLLAPSE_THRESHOLD
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
          {message.content}
        </div>
      ) : (
        /* ARIA bubble */
        <div
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

          {/* Message content */}
          <div aria-live="polite" style={{ paddingRight: message.content ? 24 : 0 }}>
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
