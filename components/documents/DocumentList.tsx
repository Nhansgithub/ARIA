'use client'

import { useState, useEffect } from 'react'

// Inline types (no lib/ import — AD-11)
type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'
type DocumentType =
  | 'proposal'
  | 'contract'
  | 'brief'
  | 'sop'
  | 'report'
  | 'invoice'
  | 'onboarding'
  | 'other'

interface DocumentRow {
  id: string
  owner_id: string
  deal_id: string | null
  client_id: string | null
  type: DocumentType
  title: string
  status: DocumentStatus
  content_md: string | null
  file_url: string | null
  version: number
  created_by: 'ai' | 'human'
  created_at: string
  updated_at: string
}

const STATUS_COLOR: Record<DocumentStatus, string> = {
  draft: '#475569',
  review: '#d97706',
  sent: '#2563eb',
  signed: '#16a34a',
  archived: '#94a3b8',
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Nháp',
  review: 'Đang xét',
  sent: 'Đã gửi',
  signed: 'Đã ký',
  archived: 'Lưu trữ',
}

const TYPE_LABEL: Record<DocumentType, string> = {
  proposal: 'Proposal',
  contract: 'Contract',
  brief: 'Brief',
  sop: 'SOP',
  report: 'Report',
  invoice: 'Invoice',
  onboarding: 'Onboarding',
  other: 'Other',
}

const STATUS_FILTERS: { value: DocumentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Nháp' },
  { value: 'review', label: 'Đang xét' },
  { value: 'sent', label: 'Đã gửi' },
  { value: 'signed', label: 'Đã ký' },
  { value: 'archived', label: 'Lưu trữ' },
]

function truncateTitle(title: string, maxLen = 60): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen) + '…'
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

interface DocumentListProps {
  onSelect: (id: string) => void
}

export default function DocumentList({ onSelect }: DocumentListProps) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<DocumentStatus | 'all'>('all')

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true)
      setFetchError(null)
      try {
        const url =
          activeFilter === 'all'
            ? '/api/documents'
            : `/api/documents?status=${activeFilter}`
        const res = await fetch(url)
        if (!res.ok) {
          setFetchError('Failed to load documents. Please try again.')
          setDocs([])
        } else {
          const data = (await res.json()) as DocumentRow[]
          setDocs(data)
        }
      } catch {
        setFetchError('Network error — could not reach the server.')
        setDocs([])
      }
      setLoading(false)
    }
    void fetchDocs()
  }, [activeFilter])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0e27',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid #2a3350',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: '#e2e8f0',
            margin: '0 0 12px',
          }}
        >
          Documents
        </h2>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => {
            const isActive = activeFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: isActive ? '1px solid #14b8a6' : '1px solid #2a3350',
                  background: isActive ? 'rgba(20,184,166,0.15)' : 'transparent',
                  color: isActive ? '#14b8a6' : '#94a3b8',
                  fontSize: 12,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {fetchError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60%',
              color: '#f87171',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 14,
              textAlign: 'center',
              padding: '0 32px',
            }}
          >
            {fetchError}
          </div>
        ) : loading ? (
          // Loading skeleton: 3 grey placeholder rows
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid #141a2e',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    height: 14,
                    width: '60%',
                    background: '#1e2a45',
                    borderRadius: 4,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    height: 12,
                    width: '30%',
                    background: '#1e2a45',
                    borderRadius: 4,
                  }}
                />
              </div>
            ))}
          </>
        ) : docs.length === 0 ? (
          // Empty state
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60%',
              color: '#94a3b8',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textAlign: 'center',
              padding: '0 32px',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>📄</span>
            <span style={{ fontSize: 15, color: '#e2e8f0' }}>
              Chưa có tài liệu nào. / No documents yet.
            </span>
            <span style={{ fontSize: 13 }}>Ask ARIA to draft one for you.</span>
          </div>
        ) : (
          docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #141a2e',
                padding: '12px 20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#141a2e'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                {/* Title */}
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#e2e8f0',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {truncateTitle(doc.title, 60)}
                </span>

                {/* Date */}
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 12,
                    color: '#94a3b8',
                    flexShrink: 0,
                  }}
                >
                  {formatRelativeDate(doc.updated_at ?? doc.created_at)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Type chip */}
                <span
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    background: '#1e2a45',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {TYPE_LABEL[doc.type] ?? doc.type}
                </span>

                {/* Status pill */}
                <span
                  style={{
                    fontSize: 11,
                    color: '#fff',
                    background: STATUS_COLOR[doc.status],
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {STATUS_LABEL[doc.status]}
                </span>

                {/* Client/deal placeholder — "—" if null */}
                {(doc.client_id || doc.deal_id) && (
                  <span
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {doc.client_id ?? doc.deal_id ?? '—'}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
