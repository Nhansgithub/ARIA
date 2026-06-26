'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from './MessageBubble'
import { InputBar } from './InputBar'
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal'

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const idCounterRef = useRef(0)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleExpand(id: string) {
    setExpandedMessages((prev) => new Set(Array.from(prev).concat(id)))
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsStreaming(false)
    setMessages((prev) => {
      const msgs = [...prev]
      const lastIdx = msgs.length - 1
      const last = msgs[lastIdx]
      if (lastIdx >= 0 && last && last.role === 'assistant') {
        msgs[lastIdx] = { ...last, stopped: true }
      }
      return msgs
    })
  }

  async function handleSend(text: string, isRetry = false) {
    const trimmedText = text.trim()
    if (!trimmedText || isStreaming) return

    // Build API payload from CURRENT state (before any state updates)
    // isRetry: user msg is already in state — include it; just add blank assistant slot
    // !isRetry: user msg not in state yet — append it to payload
    const currentMessages = messages.map((m) => ({ role: m.role, content: m.content }))
    const apiMessages = isRetry
      ? currentMessages
      : [...currentMessages, { role: 'user' as const, content: trimmedText }]

    // Set up in-progress assistant slot
    const assistantId = String(++idCounterRef.current)
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    if (!isRetry) {
      const userMsgId = String(++idCounterRef.current)
      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        content: trimmedText,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInputValue('')
    } else {
      setMessages((prev) => [...prev, assistantMsg])
    }

    setIsStreaming(true)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Detect JSON response (privacy gate) vs streaming text
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const body = await response.json()
        if (body.requiresAcknowledgement) {
          setIsStreaming(false)
          // Remove blank assistant slot; keep user message visible
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          setShowPrivacyModal(true)
          setPendingMessage(trimmedText)
          return
        }
      }

      // Streaming path — read chunks and append to in-progress assistant message
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const msgs = [...prev]
          const lastIdx = msgs.length - 1
          const last = msgs[lastIdx]
          if (lastIdx >= 0 && last && last.id === assistantId) {
            msgs[lastIdx] = { ...last, content: last.content + chunk }
          }
          return msgs
        })
      }

      setIsStreaming(false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // handleStop() already updated state
        return
      }
      setIsStreaming(false)
      setMessages((prev) => {
        const msgs = [...prev]
        const lastIdx = msgs.length - 1
        const last = msgs[lastIdx]
        if (lastIdx >= 0 && last && last.id === assistantId) {
          msgs[lastIdx] = {
            ...last,
            content:
              last.content.length > 0
                ? last.content + '\n\nSomething went wrong. Please retry.'
                : 'Something went wrong. Please retry.',
          }
        }
        return msgs
      })
    }
  }

  function handlePrivacyAcknowledge() {
    setShowPrivacyModal(false)
    if (pendingMessage) {
      const msg = pendingMessage
      setPendingMessage(null)
      // isRetry=true: user message is already in state; just stream the response
      handleSend(msg, true)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0e27',
        position: 'relative',
      }}
    >
      {/* Transcript */}
      <div
        ref={transcriptRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
                color: '#94a3b8',
                fontSize: 15,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                textAlign: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#14b8a6',
                  letterSpacing: '0.08em',
                }}
              >
                ARIA
              </span>
              <span>How can I help you today?</span>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming}
                isLastMessage={idx === messages.length - 1}
                expanded={expandedMessages.has(msg.id)}
                onExpand={() => handleExpand(msg.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Input bar */}
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        <InputBar
          value={inputValue}
          onChange={setInputValue}
          onSend={() => handleSend(inputValue)}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>

      {/* Privacy notice modal */}
      {showPrivacyModal && <PrivacyNoticeModal onAcknowledge={handlePrivacyAcknowledge} />}
    </div>
  )
}
