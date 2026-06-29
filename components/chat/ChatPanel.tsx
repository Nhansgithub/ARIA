'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { AlertCircle, MoreHorizontal } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import type { Message } from './MessageBubble'
import { InputBar } from './InputBar'
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal'
import { DegradedBanner } from './DegradedBanner'
import { WelcomeCard } from './WelcomeCard'
import { detectLanguage } from '@/lib/language/detectLanguage'
import { validateImageFile, compressImage } from '@/lib/imageUtils'

const SENTINEL = '[ARIA error:'

const NETWORK_TOAST_COPY = {
  en: 'Connection lost — your message has been restored. Please try again.',
  vi: 'Mất kết nối — tin nhắn của bạn đã được khôi phục. Vui lòng thử lại.',
}

// RenderItem discriminated union — used to interleave messages and dividers in transcript (AC-3)
type RenderItem = { kind: 'message'; msg: Message } | { kind: 'divider'; id: string; label: string }

export default function ChatPanel() {
  // Context window — sent to the API. Reset to [] on "Start new topic" (AC-3, AC-4).
  const [messages, setMessages] = useState<Message[]>([])
  // Full visual transcript: messages + dividers in insertion order. Never reset (AC-3).
  const [transcriptItems, setTranscriptItems] = useState<RenderItem[]>([])

  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isDegraded, setIsDegraded] = useState(false)
  const [degradedLang, setDegradedLang] = useState<'vi' | 'en'>('en')
  const [networkToast, setNetworkToast] = useState(false)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // First-run onboarding state (null = status fetch in-flight)
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)

  // "Start new topic" overflow menu state
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement | null>(null)

  // "Context cleared" 2s toast state (AC-3)
  const [newTopicToast, setNewTopicToast] = useState(false)
  const newTopicToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const idCounterRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch first-run status on mount (AC-9)
  useEffect(() => {
    fetch('/api/onboarding/status')
      .then((r) => r.json())
      .then((data: { isFirstRun: boolean; ownerName: string | null }) => {
        setIsFirstRun(data.isFirstRun)
        setOwnerName(data.ownerName)
      })
      .catch(() => setIsFirstRun(false)) // graceful degradation: treat as returning user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (newTopicToastTimerRef.current) clearTimeout(newTopicToastTimerRef.current)
    }
  }, [])

  // Auto-scroll to bottom whenever transcriptItems change
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcriptItems])

  // Click-outside listener to close overflow menu (Task 1)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    if (overflowOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [overflowOpen])

  // Keyboard shortcut Ctrl/Cmd+Shift+N → Start new topic (Task 1, AC-6)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = /mac/i.test(navigator.userAgent)
      const modKey = isMac ? e.metaKey : e.ctrlKey
      if (modKey && e.shiftKey && e.key.toUpperCase() === 'N') {
        e.preventDefault()
        handleStartNewTopic()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Re-register when guard conditions change to avoid stale closure (AD-12 note 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isStreaming])

  function handleImageAttach(file: File) {
    const validation = validateImageFile(file)
    if (!validation.ok) {
      setImageError(validation.error ?? 'Invalid image')
      setPendingImage(null)
      return
    }
    setImageError(null)
    setPendingImage(file)
  }

  function handleImageRemove() {
    setPendingImage(null)
    setImageError(null)
  }

  // Paste-to-attach: extract the first image/* item from the clipboard anywhere
  // in the window and route it through the same validation as the file picker.
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (isStreaming) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      handleImageAttach(file)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isStreaming])

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
    setTranscriptItems((prev) => {
      const items = [...prev]
      const lastIdx = items.length - 1
      const last = items[lastIdx]
      if (lastIdx >= 0 && last && last.kind === 'message' && last.msg.role === 'assistant') {
        items[lastIdx] = { kind: 'message', msg: { ...last.msg, stopped: true } }
      }
      return items
    })
  }

  // Task 2: "Start new topic" — resets context window, appends divider to transcript (AC-3, AC-4)
  function handleStartNewTopic() {
    if (isStreaming || messages.length === 0) return
    const dividerLabel = `New topic started — ${new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`
    const dividerId = String(++idCounterRef.current)
    setTranscriptItems((prev) => [...prev, { kind: 'divider', id: dividerId, label: dividerLabel }])
    // Reset context window — CRM data is never touched (AC-4)
    setMessages([])
    // Show 2s "Context cleared" tooltip (Task 4)
    setNewTopicToast(true)
    if (newTopicToastTimerRef.current) clearTimeout(newTopicToastTimerRef.current)
    newTopicToastTimerRef.current = setTimeout(() => setNewTopicToast(false), 2000)
    setOverflowOpen(false)
  }

  async function _streamAssistant(
    apiMessages: { role: string; content: string }[],
    assistantId: string,
    restoreInputValue?: string,
    imageBase64?: string,
    imageMediaType?: string
  ) {
    setIsStreaming(true)
    const controller = new AbortController()
    abortControllerRef.current = controller
    let gotResponse = false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, imageBase64, imageMediaType }),
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
          // Remove blank assistant slot from both state arrays; keep user message visible
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          setTranscriptItems((prev) =>
            prev.filter((item) => !(item.kind === 'message' && item.msg.id === assistantId))
          )
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
        setTranscriptItems((prev) => {
          const items = [...prev]
          const lastIdx = items.length - 1
          const last = items[lastIdx]
          if (lastIdx >= 0 && last && last.kind === 'message' && last.msg.id === assistantId) {
            items[lastIdx] = {
              kind: 'message',
              msg: { ...last.msg, content: last.msg.content + chunk },
            }
          }
          return items
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
        setTranscriptItems((prev) => {
          const items = [...prev]
          const idx = items.findIndex(
            (item) => item.kind === 'message' && item.msg.id === assistantId
          )
          if (idx >= 0) {
            const item = items[idx] as RenderItem
            if (item.kind === 'message') {
              items[idx] = {
                kind: 'message',
                msg: { ...item.msg, content: stripped, degraded: true },
              }
            }
          }
          return items
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
        setTranscriptItems((prev) =>
          prev.filter((item) => !(item.kind === 'message' && item.msg.id === assistantId))
        )
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
      setTranscriptItems((prev) => {
        const items = [...prev]
        const lastIdx = items.length - 1
        const last = items[lastIdx]
        if (lastIdx >= 0 && last && last.kind === 'message' && last.msg.id === assistantId) {
          const errContent =
            last.msg.content.length > 0
              ? last.msg.content + '\n\nSomething went wrong. Please retry.'
              : 'Something went wrong. Please retry.'
          items[lastIdx] = { kind: 'message', msg: { ...last.msg, content: errContent } }
        }
        return items
      })
    }
  }

  async function handleSend(text: string, isRetry = false) {
    if (isFirstRun) setIsFirstRun(false) // dismiss welcome card on first message (AC-7, AC-8)
    const trimmedText = text.trim()
    // Guard: need either text OR an attached image (not neither)
    if ((!trimmedText && !pendingImage) || isStreaming) return

    // Capture and compress the image (if any) before any state mutation.
    const imageFile = pendingImage
    let imageBase64: string | undefined
    let imageMediaType: string | undefined
    let thumbnailUrl: string | undefined

    if (imageFile) {
      try {
        const compressed = await compressImage(imageFile)
        imageBase64 = compressed.base64
        imageMediaType = compressed.mediaType
        // Reuse the compressed data-URL as the thumbnail — avoids a second blob URL
        // and the associated cleanup burden (blob URLs from createObjectURL are never
        // automatically GC'd and would leak across the session).
        thumbnailUrl = `data:${compressed.mediaType};base64,${compressed.base64}`
      } catch {
        setImageError('Failed to process image. Please try again.')
        return
      }
      setPendingImage(null)
      setImageError(null)
    }

    // Build API payload from CURRENT state (before any state updates)
    // isRetry: user msg is already in state — include it; just add blank assistant slot
    // !isRetry: user msg not in state yet — append it to payload
    // NOTE: imageBase64 is sent as a separate body field, never inside messages (FR-35)
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
        thumbnailUrl, // compressed data-URL for display; never sent to API
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setTranscriptItems((prev) => [
        ...prev,
        { kind: 'message', msg: userMsg },
        { kind: 'message', msg: assistantMsg },
      ])
      setInputValue('')
    } else {
      setMessages((prev) => [...prev, assistantMsg])
      setTranscriptItems((prev) => [...prev, { kind: 'message', msg: assistantMsg }])
    }

    await _streamAssistant(
      apiMessages,
      assistantId,
      isRetry ? undefined : trimmedText,
      imageBase64,
      imageMediaType
    )
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
    // Replace failed assistant slot in transcript with fresh placeholder
    setTranscriptItems((prev) => {
      const items = prev.filter(
        (item) => !(item.kind === 'message' && item.msg.id === failedAssistantId)
      )
      return [...items, { kind: 'message', msg: newAssistant }]
    })
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

  // Derive render list: messages in context + any additional transcript items from
  // transcriptItems that are not yet in context (dividers and post-new-topic messages).
  // Since transcriptItems IS the authoritative visual list, just use it directly.
  // It is kept in sync with messages through all code paths above.
  const renderItems = useMemo(() => transcriptItems, [transcriptItems])

  // Show empty state if no transcript items at all
  const isEmpty = transcriptItems.length === 0

  // Detect browser locale once per render — never changes during the session (AC-9, Task 4)
  const browserLang = useMemo<'vi' | 'en'>(() => {
    if (typeof navigator === 'undefined') return 'en' // SSR guard
    return navigator.language.startsWith('vi') ? 'vi' : 'en'
  }, [])

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
      {/* Chat header with overflow menu (Task 1) */}
      <div
        style={{
          background: '#0a0e27',
          borderBottom: '1px solid #2A3350',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: '#94a3b8',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          ARIA
        </span>

        {/* Overflow (···) button — only shown when messages exist (AC-6) */}
        {transcriptItems.length > 0 && (
          <div ref={overflowRef} style={{ position: 'relative' }}>
            <button
              aria-label="More options"
              onClick={() => setOverflowOpen((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                borderRadius: 4,
              }}
            >
              <MoreHorizontal size={20} color="#94a3b8" />
            </button>

            {/* Dropdown menu */}
            {overflowOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  background: '#141a2e',
                  border: '1px solid #2A3350',
                  borderRadius: 8,
                  padding: '8px 0',
                  zIndex: 100,
                  minWidth: 160,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                }}
              >
                <button
                  onClick={() => {
                    handleStartNewTopic()
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    color: '#94a3b8',
                    fontSize: 13,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = '#1e2a45'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                  }}
                >
                  Chủ đề mới
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* "Context cleared — CRM data kept" 2s tooltip (Task 4, AC-3) */}
      {newTopicToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 48,
            right: 16,
            background: '#1C2440',
            border: '1px solid #2A3350',
            borderRadius: 8,
            padding: '8px 14px',
            color: '#94a3b8',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          Context cleared — CRM data kept
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
          {isEmpty && isFirstRun === null ? null : isEmpty && isFirstRun === true ? (
            <WelcomeCard
              ownerName={ownerName}
              lang={browserLang}
              onSkipBusinessContext={() => {
                /* no-op — Business Context panel opened via Settings nav */
              }}
            />
          ) : isEmpty ? (
            // Regular empty state — returning user (isFirstRun false)
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
            renderItems.map((item, idx) => {
              if (item.kind === 'divider') {
                // Task 3: Divider rendering (AC-1, AC-3)
                return (
                  <div
                    key={item.id}
                    role="separator"
                    aria-label={item.label}
                    style={{
                      background: '#2A3350',
                      height: 1,
                      margin: '16px 0',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        color: '#94a3b8',
                        fontSize: 12,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        background: '#0a0e27',
                        padding: '0 12px',
                        position: 'absolute',
                        top: -9,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                )
              }
              // item.kind === 'message'
              const msg = item.msg
              // Determine if this is the last item in the render list AND it's a message
              const isLast = idx === renderItems.length - 1
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming}
                  isLastMessage={isLast}
                  expanded={expandedMessages.has(msg.id)}
                  onExpand={() => handleExpand(msg.id)}
                  onRetry={msg.degraded ? () => handleRetry(msg.id) : undefined}
                />
              )
            })
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
          pendingImage={pendingImage}
          onImageAttach={handleImageAttach}
          onImageRemove={handleImageRemove}
          imageError={imageError}
        />
      </div>

      {/* Privacy notice modal */}
      {showPrivacyModal && <PrivacyNoticeModal onAcknowledge={handlePrivacyAcknowledge} />}
    </div>
  )
}
