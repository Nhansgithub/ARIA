'use client'

import { useState, useRef, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import type { Message } from './MessageBubble'
import { InputBar } from './InputBar'
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal'
import { DegradedBanner } from './DegradedBanner'
import { detectLanguage } from '@/lib/language/detectLanguage'

const SENTINEL = '[ARIA error:'

const NETWORK_TOAST_COPY = {
  en: 'Connection lost — your message has been restored. Please try again.',
  vi: 'Mất kết nối — tin nhắn của bạn đã được khôi phục. Vui lòng thử lại.',
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isDegraded, setIsDegraded] = useState(false)
  const [degradedLang, setDegradedLang] = useState<'vi' | 'en'>('en')
  const [networkToast, setNetworkToast] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const idCounterRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleExpand(id: string) {
    setExpandedMessages((prev) => new Set(Array.from(prev).concat(id)))
  }

  function handleStop() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    // isStreaming is cleared in the AbortError catch branch so there is no
    // window where isStreaming=false but the reader loop is still executing.
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

  async function _streamAssistant(
    apiMessages: { role: string; content: string }[],
    assistantId: string,
    restoreInputValue?: string
  ) {
    setIsStreaming(true)
    const controller = new AbortController()
    abortControllerRef.current = controller
    let gotResponse = false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      })
      gotResponse = true

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
          if (restoreInputValue !== undefined) setPendingMessage(restoreInputValue)
          return
        }
      }

      // Streaming path — read chunks and accumulate
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
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

      // Sentinel detection — AD-6 degraded envelope written by streamChat.ts
      if (accumulated.includes(SENTINEL)) {
        const stripped = accumulated.replace(/\n\n\[ARIA error:[^\]]*\]/g, '')
        setMessages((prev) => {
          const msgs = [...prev]
          const idx = msgs.findIndex((m) => m.id === assistantId)
          const existing = idx >= 0 ? msgs[idx] : undefined
          if (idx >= 0 && existing) {
            msgs[idx] = { ...existing, content: stripped, degraded: true }
          }
          return msgs
        })
        setIsDegraded(true)
      } else {
        setIsDegraded(false)
      }

      setIsStreaming(false)
      abortControllerRef.current = null
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // handleStop() marked the message stopped; we just clear streaming state
        setIsStreaming(false)
        return
      }

      if (!gotResponse) {
        // Network-level failure — fetch itself threw before receiving any response
        setIsStreaming(false)
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        if (restoreInputValue !== undefined) setInputValue(restoreInputValue)
        setNetworkToast(true)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => setNetworkToast(false), 4000)
        return
      }

      // HTTP or stream-read error — show in message bubble
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

    // Detect language for degraded banner from the user's message content
    const userContent = isRetry
      ? ([...messages].reverse().find((m) => m.role === 'user')?.content ?? trimmedText)
      : trimmedText
    setDegradedLang(detectLanguage(userContent))

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

    await _streamAssistant(apiMessages, assistantId, isRetry ? undefined : trimmedText)
  }

  async function handleRetry(failedAssistantId: string) {
    if (isStreaming) return
    // Compute cleaned state synchronously — avoids stale-closure issue if called via handleSend
    const cleanedMsgs = messages.filter((m) => m.id !== failedAssistantId)
    const apiPayload = cleanedMsgs.map((m) => ({ role: m.role, content: m.content }))
    const newAssistantId = String(++idCounterRef.current)
    const newAssistant: Message = {
      id: newAssistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    const lastUserContent = [...cleanedMsgs].reverse().find((m) => m.role === 'user')?.content ?? ''
    setDegradedLang(detectLanguage(lastUserContent))
    setMessages([...cleanedMsgs, newAssistant])
    setIsDegraded(false)
    await _streamAssistant(apiPayload, newAssistantId)
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
      {/* Degraded AI banner — shown above transcript when AI sentinel detected */}
      {isDegraded && <DegradedBanner lang={degradedLang} onDismiss={() => setIsDegraded(false)} />}

      {/* Network-loss toast — shown when fetch itself fails (no HTTP response) */}
      {networkToast && (
        <div
          role="alert"
          lang={degradedLang}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '8px 16px',
            padding: '10px 16px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.40)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 500,
            color: '#f87171',
            flexShrink: 0,
          }}
        >
          <AlertCircle size={16} color="#ef4444" aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{NETWORK_TOAST_COPY[degradedLang]}</span>
        </div>
      )}

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
                onRetry={msg.degraded ? () => handleRetry(msg.id) : undefined}
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
