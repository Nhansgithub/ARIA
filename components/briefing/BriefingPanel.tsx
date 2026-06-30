'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BriefingFlag {
  type: 'overdue' | 'stale' | 'missing_doc' | 'cadence_reminder'
  deal_id: string
  severity: 'high' | 'medium'
  label: string
}

interface FlagsPayload {
  items?: BriefingFlag[]
  deal_count?: number
  doc_pending_count?: number
  activity_count_24h?: number
}

interface BriefingData {
  id: string
  owner_id: string
  date: string
  content_md: string | null
  flags: FlagsPayload
  generated_at: string
  status: 'generated' | 'degraded'
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BriefingPanelProps {
  onOpenChat: (prefill: string) => void
  onEmpty: () => void
  onHighFlagCount: (count: number) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Today-eligible flag types (mirrors getTier logic from briefingService)
function isTodayEligible(flag: BriefingFlag): boolean {
  if (flag.type === 'overdue') return true
  if (flag.type === 'cadence_reminder') return true
  if (flag.type === 'stale' && flag.severity === 'high') return true
  return false
}

// Sort today flags: overdue=0, cadence_reminder=2, high-stale=3
function todayFlagTier(flag: BriefingFlag): number {
  if (flag.type === 'overdue') return 0
  if (flag.type === 'cadence_reminder') return 2
  return 3
}

export function composePrequeueMessage(flag: BriefingFlag): string {
  switch (flag.type) {
    case 'overdue':
      return `${flag.label}. ARIA có thể gợi ý bước tiếp theo không?`
    case 'cadence_reminder':
      return `${flag.label}. Em nên theo dõi thế nào?`
    case 'stale':
      return `${flag.label}. ARIA nghĩ tiếp theo nên làm gì?`
    default:
      return `${flag.label}. ARIA nghĩ sao?`
  }
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[80, 60, 100, 40, 70].map((w, i) => (
        <div
          key={i}
          style={{
            height: 16,
            width: `${w}%`,
            background: '#1e2a45',
            borderRadius: 6,
            animation: 'aria-skeleton-pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}

// ── Today item card ───────────────────────────────────────────────────────────

function TodayCard({
  flag,
  index,
  onTap,
}: {
  flag: BriefingFlag
  index: number
  onTap: () => void
}) {
  const isUrgent = index === 0
  const borderColor = isUrgent ? '#f59e0b' : '#14b8a6'
  const badgeColor = flag.type === 'overdue' ? '#f59e0b' : '#14b8a6'
  const badgeLabel =
    flag.type === 'overdue'
      ? 'Quá hạn'
      : flag.type === 'cadence_reminder'
        ? 'Nhắc nhở'
        : 'Trì hoãn'

  return (
    <button
      onClick={onTap}
      title="Hỏi ARIA về deal này"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        background: '#141a2e',
        border: 'none',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 6,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = '#1e2a45')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = '#141a2e')
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: badgeColor,
            background: `${badgeColor}22`,
            borderRadius: 4,
            padding: '2px 6px',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {badgeLabel}
        </span>
        <span
          style={{
            fontSize: 13,
            color: '#e2e8f0',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {flag.label}
        </span>
      </div>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>Nhấn để hỏi ARIA →</span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type PanelState = 'loading' | 'generating' | 'loaded' | 'empty' | 'error'

export default function BriefingPanel({ onOpenChat, onEmpty, onHighFlagCount }: BriefingPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('loading')
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const mountedRef = useRef(true)
  const generateAttemptedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const applyBriefing = useCallback(
    (data: BriefingData) => {
      setBriefing(data)
      setPanelState('loaded')
      // Opening Briefing = owner sees it; mark seen immediately and clear badge
      // P1-2 fix: pass 0 (not highCount) — seen_at is being set now, so badge contribution = 0
      onHighFlagCount(0)
      if (data.date) {
        fetch(`/api/briefings/${data.date}/seen`, { method: 'POST' }).catch(() => {})
      }
    },
    [onHighFlagCount]
  )

  // Initial load — fetch cached briefing, trigger on-demand generation if missing
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/briefing/today')
        if (!res.ok) { if (mountedRef.current) setPanelState('error'); return }
        const { briefing: data } = (await res.json()) as { briefing: BriefingData | null }

        if (mountedRef.current) {
          if (data) {
            applyBriefing(data)
          } else if (!generateAttemptedRef.current) {
            // No cached briefing — trigger on-demand generation (ref prevents double-fire in strict mode)
            generateAttemptedRef.current = true
            setPanelState('generating')
            const genRes = await fetch('/api/briefing/today?generate=true')
            if (!genRes.ok) { if (mountedRef.current) setPanelState('error'); return }
            const { briefing: generated } = (await genRes.json()) as { briefing: BriefingData | null }
            if (mountedRef.current) {
              if (generated) {
                applyBriefing(generated)
              } else {
                // Empty CRM or generation failed — fall back to Chat
                setPanelState('empty')
                onEmpty()
              }
            }
          }
        }
      } catch {
        if (mountedRef.current) setPanelState('error')
      }
    }

    void load()
  // onEmpty and applyBriefing are stable callbacks; mountedRef/generateAttemptedRef are refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/briefing/today?forceRefresh=true')
      if (res.ok && mountedRef.current) {
        const { briefing: data } = (await res.json()) as { briefing: BriefingData | null }
        if (data) applyBriefing(data)
      }
    } catch {
      // Silently ignore refresh errors
    }
    if (mountedRef.current) setRefreshing(false)
  }

  function handleTodayItemTap(flag: BriefingFlag) {
    const msg = composePrequeueMessage(flag)
    onOpenChat(msg)
  }

  // ── Render states ─────────────────────────────────────────────────────────

  const sharedWrap: React.CSSProperties = {
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0e27',
  }

  if (panelState === 'loading' || panelState === 'generating') {
    return (
      <div style={sharedWrap}>
        <div style={{ padding: '24px 24px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {panelState === 'generating' ? 'Đang tạo briefing…' : 'Briefing hôm nay'}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {panelState === 'generating' ? 'ARIA đang phân tích dữ liệu CRM của bạn…' : 'Đang tải…'}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <BriefingSkeleton />
        </div>
      </div>
    )
  }

  if (panelState === 'error') {
    return (
      <div style={{ ...sharedWrap, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Không thể tải briefing. Vui lòng thử lại sau.
        </span>
      </div>
    )
  }

  if (panelState === 'empty' || !briefing) return null

  const todayFlags = (briefing.flags?.items ?? [])
    .filter(isTodayEligible)
    .sort((a, b) => todayFlagTier(a) - todayFlagTier(b))
    .slice(0, 3)

  const issuedAt = briefing.generated_at
    ? formatTime(briefing.generated_at)
    : null

  return (
    <div style={sharedWrap}>
      {/* Degraded banner */}
      {briefing.status === 'degraded' && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 24px',
            background: '#78350f22',
            borderBottom: '1px solid #f59e0b44',
            fontSize: 12,
            color: '#f59e0b',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <AlertTriangle size={13} />
          <span>Dữ liệu từ {issuedAt ?? briefing.date} — briefing mới nhất chưa tạo được</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: '20px 24px 12px',
          borderBottom: '1px solid #2a3350',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Briefing {formatDate(briefing.date)}
        </span>
        {issuedAt && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Tạo lúc {issuedAt}</span>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 0' }}>
        {/* Today action cards */}
        {todayFlags.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#94a3b8',
                marginBottom: 10,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Hành động hôm nay
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayFlags.map((flag, i) => (
                <TodayCard
                  key={`${flag.deal_id}-${flag.type}`}
                  flag={flag}
                  index={i}
                  onTap={() => handleTodayItemTap(flag)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Full markdown content */}
        {briefing.content_md ? (
          <div style={{ paddingBottom: 80 }}>
            <MarkdownRenderer content={briefing.content_md} />
          </div>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Nội dung briefing không khả dụng.</p>
        )}
      </div>

      {/* Footer: refresh */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid #2a3350',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#0a0e27',
        }}
      >
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: refreshing ? '#4b5a7a' : '#94a3b8',
            fontSize: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: refreshing ? 'not-allowed' : 'pointer',
            padding: '4px 0',
          }}
        >
          <RefreshCw
            size={13}
            style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {refreshing ? 'Đang cập nhật…' : 'Làm mới'}
        </button>
      </div>
    </div>
  )
}
