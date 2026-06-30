'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import VersionHistoryPanel from './VersionHistoryPanel'

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

// Status constants (spec-exact — tests verify these values)
export const STATUS_COLOR: Record<DocumentStatus, string> = {
  draft: '#475569',
  review: '#d97706',
  sent: '#2563eb',
  signed: '#16a34a',
  archived: '#94a3b8',
}

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Nháp',
  review: 'Đang xét',
  sent: 'Đã gửi',
  signed: 'Đã ký',
  archived: 'Lưu trữ',
}

export const STATUS_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['review', 'archived'],
  review: ['sent', 'archived'],
  sent: ['signed', 'archived'],
  signed: ['archived'],
  archived: [],
}

// Greedy line-level diff (no external library — spec-exact)
export type DiffLine = { type: 'added' | 'removed' | 'unchanged'; line: string }

export function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []
  let i = 0,
    j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      result.push({ type: 'added', line: newLines[j++]! })
      continue
    }
    if (j >= newLines.length) {
      result.push({ type: 'removed', line: oldLines[i++]! })
      continue
    }
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', line: oldLines[i]! })
      i++
      j++
    } else {
      result.push({ type: 'removed', line: oldLines[i++]! })
      result.push({ type: 'added', line: newLines[j++]! })
    }
  }
  return result
}

// Date formatter — no external library (spec-exact)
export function formatVersionLabel(createdBy: 'ai' | 'human', createdAt: string): string {
  const who = createdBy === 'ai' ? 'ARIA' : 'You'
  const d = new Date(createdAt)
  const fmt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${who} · ${fmt.format(d)}`
}

// Truncate helper (exported for tests)
export function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen) + '…'
}

interface DocumentViewerProps {
  id: string
  onBack: () => void
  onOpenChat: (prefill: string) => void
}

export default function DocumentViewer({ id, onBack, onOpenChat }: DocumentViewerProps) {
  const [doc, setDoc] = useState<DocumentRow | null>(null)
  const [versions, setVersions] = useState<DocumentRow[]>([])
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [displayVersion, setDisplayVersion] = useState<DocumentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState<DocumentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editConfirm, setEditConfirm] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stores the latest content requested while a save is in-flight (race-condition guard)
  const pendingContentRef = useRef<string | null>(null)

  // Fetch document and versions on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [docRes, versionsRes] = await Promise.all([
          fetch(`/api/documents/${id}`),
          fetch(`/api/documents/${id}/versions`),
        ])
        if (!docRes.ok) {
          setError('Document not found.')
          setLoading(false)
          return
        }
        const docData = (await docRes.json()) as DocumentRow
        const versionsData = versionsRes.ok ? ((await versionsRes.json()) as DocumentRow[]) : []
        setDoc(docData)
        setVersions(versionsData)
        setDisplayVersion(docData)
        setEditContent(docData.content_md ?? '')
      } catch {
        setError('Failed to load document.')
      }
      setLoading(false)
    }
    void load()
  }, [id])

  // Autosave: 2-second debounce (spec-exact pattern)
  function handleContentChange(value: string) {
    setEditContent(value)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void triggerSave(value)
    }, 2000)
  }

  async function triggerSave(content: string) {
    if (saving) {
      // A save is already in-flight — queue the latest content and return
      pendingContentRef.current = content
      return
    }
    pendingContentRef.current = null
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/documents/${id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_md: content }),
      })
      if (res.ok) {
        const newDoc = (await res.json()) as DocumentRow
        // Preserve locally confirmed status — don't let a stale server row revert it
        setDoc((prev) => ({ ...newDoc, status: prev?.status ?? newDoc.status }))
        setVersions((prev) =>
          prev.some((v) => v.id === newDoc.id) ? prev : [...prev, newDoc]
        )
        setDisplayVersion(newDoc)
      } else {
        setSaveError('Save failed — changes may not be saved. Try again.')
        pendingContentRef.current = null
      }
    } catch {
      setSaveError('Save failed — check your connection and try again.')
      pendingContentRef.current = null
    } finally {
      setSaving(false)
      const queued = pendingContentRef.current
      if (queued !== null) {
        pendingContentRef.current = null
        void triggerSave(queued)
      }
    }
  }

  function handleSaveClick() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    void triggerSave(editContent)
  }

  async function handleStatusChange(newStatus: DocumentStatus) {
    setShowStatusMenu(false)
    setStatusConfirm(null)
    setStatusError(null)
    const res = await fetch(`/api/documents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok && doc) {
      const updated = { ...doc, status: newStatus }
      setDoc(updated)
      if (displayVersion?.id === doc.id) {
        setDisplayVersion(updated)
      }
      // Also update the matching entry in versions snapshot
      setVersions((prev) => prev.map((v) => (v.id === doc.id ? { ...v, status: newStatus } : v)))
    } else {
      setStatusError('Status update failed. Please try again.')
    }
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch(`/api/documents/${id}/export`, { method: 'POST' })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${doc?.title ?? 'document'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        setExportError('Xuất PDF thất bại — thử lại / PDF export failed — try again')
      }
    } catch {
      setExportError('Xuất PDF thất bại — thử lại / PDF export failed — try again')
    } finally {
      setExporting(false)
    }
  }

  function handleSelectVersion(ver: DocumentRow) {
    setDisplayVersion(ver)
    setShowVersionDropdown(false)
    if (editMode) setEditMode(false)
  }

  const isViewingOldVersion = doc && displayVersion && displayVersion.id !== doc.id

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Loading…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          color: '#94a3b8',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <span>{error ?? 'Document not found.'}</span>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid #2a3350',
            color: '#94a3b8',
            padding: '6px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          ← Back
        </button>
      </div>
    )
  }

  const transitions = STATUS_TRANSITIONS[doc.status]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0e27',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #2a3350',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 14,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 0',
          }}
        >
          ← Back
        </button>

        {/* Title */}
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            color: '#e2e8f0',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.title}
        </span>

        {/* Status pill */}
        <span
          style={{
            fontSize: 12,
            color: '#fff',
            background: STATUS_COLOR[doc.status],
            padding: '3px 10px',
            borderRadius: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {STATUS_LABEL[doc.status]}
        </span>

        {/* Version indicator (clickable) */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowVersionDropdown((prev) => !prev)}
            style={{
              background: '#141a2e',
              border: '1px solid #2a3350',
              color: '#94a3b8',
              fontSize: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              padding: '3px 10px',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            v{displayVersion?.version ?? doc.version}
          </button>

          {/* Version dropdown */}
          {showVersionDropdown && versions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 32,
                right: 0,
                background: '#141a2e',
                border: '1px solid #2a3350',
                borderRadius: 8,
                zIndex: 50,
                minWidth: 220,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {[...versions].reverse().map((ver) => (
                <button
                  key={ver.id}
                  onClick={() => handleSelectVersion(ver)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: displayVersion?.id === ver.id ? '#1e2a45' : 'transparent',
                    border: 'none',
                    padding: '8px 14px',
                    color: '#e2e8f0',
                    fontSize: 13,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1e2a45'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      displayVersion?.id === ver.id ? '#1e2a45' : 'transparent'
                  }}
                >
                  {formatVersionLabel(ver.created_by, ver.created_at)}
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>v{ver.version}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Old-version banner */}
      {isViewingOldVersion && (
        <div
          style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#fbbf24',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '8px 20px',
            flexShrink: 0,
          }}
        >
          Viewing v{displayVersion?.version} (read-only) —{' '}
          <button
            onClick={() => setDisplayVersion(doc)}
            style={{
              background: 'none',
              border: 'none',
              color: '#fbbf24',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Return to latest
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 20px',
          borderBottom: '1px solid #2a3350',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Edit / Save buttons */}
        {!editMode && !isViewingOldVersion && (
          <button
            onClick={() => {
              if (doc.status === 'sent' || doc.status === 'signed' || doc.status === 'archived') {
                setEditConfirm(true)
              } else {
                setEditMode(true)
                setEditContent(doc.content_md ?? '')
              }
            }}
            style={toolbarBtnStyle}
          >
            Edit
          </button>
        )}
        {editMode && (
          <button
            onClick={handleSaveClick}
            disabled={saving}
            style={{ ...toolbarBtnStyle, background: saving ? '#2a3350' : '#14b8a6', color: saving ? '#94a3b8' : '#0a0e27' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {editMode && (
          <button
            onClick={() => setEditMode(false)}
            style={toolbarBtnStyle}
          >
            Cancel
          </button>
        )}

        {/* History */}
        <button onClick={() => setShowHistory(true)} style={toolbarBtnStyle}>
          History
        </button>

        {/* Status dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStatusMenu((prev) => !prev)}
            disabled={transitions.length === 0}
            style={{
              ...toolbarBtnStyle,
              opacity: transitions.length === 0 ? 0.4 : 1,
              cursor: transitions.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Status
          </button>

          {showStatusMenu && transitions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 36,
                left: 0,
                background: '#141a2e',
                border: '1px solid #2a3350',
                borderRadius: 8,
                zIndex: 50,
                minWidth: 160,
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              {transitions.map((t) => (
                <div key={t}>
                  <button
                    onClick={() => {
                      if (t === 'sent') {
                        setStatusConfirm(t)
                      } else {
                        void handleStatusChange(t)
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 16px',
                      color: '#e2e8f0',
                      fontSize: 13,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1e2a45'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none'
                    }}
                  >
                    {STATUS_LABEL[t]}
                  </button>

                  {/* Inline confirmation for "sent" */}
                  {statusConfirm === t && (
                    <div
                      style={{
                        padding: '8px 16px',
                        borderTop: '1px solid #2a3350',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: '#94a3b8',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}
                      >
                        Ghi vào lịch sử hoạt động? / Log to activity feed?
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => void handleStatusChange(t)}
                          style={{
                            ...toolbarBtnStyle,
                            fontSize: 12,
                            padding: '3px 10px',
                            background: '#14b8a6',
                            color: '#0a0e27',
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => {
                            setStatusConfirm(null)
                            setShowStatusMenu(false)
                          }}
                          style={{ ...toolbarBtnStyle, fontSize: 12, padding: '3px 10px' }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ask ARIA — embeds document id so ARIA can resolve revision requests without UUID lookup */}
        <button
          onClick={() => onOpenChat(`[document_id:${doc.id}] Tell me about ${doc.title}`)}
          style={{ ...toolbarBtnStyle, background: 'rgba(20,184,166,0.15)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.3)' }}
        >
          Ask ARIA
        </button>

        {/* Export PDF — always enabled regardless of edit mode */}
        <button
          onClick={() => void handleExport()}
          disabled={exporting}
          style={{
            ...toolbarBtnStyle,
            opacity: exporting ? 0.6 : 1,
            cursor: exporting ? 'not-allowed' : 'pointer',
          }}
        >
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        {editMode && !isViewingOldVersion ? (
          <textarea
            value={editContent}
            onChange={(e) => handleContentChange(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 400,
              background: '#141a2e',
              border: '1px solid #2a3350',
              borderRadius: 8,
              padding: '16px',
              color: '#e2e8f0',
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#14b8a6'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#2a3350'
            }}
          />
        ) : (
          <div style={{ maxWidth: 760 }}>
            <MarkdownRenderer content={displayVersion?.content_md ?? ''} />
          </div>
        )}
      </div>

      {/* Status error banner */}
      {statusError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '8px 20px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {statusError}
          <button
            onClick={() => setStatusError(null)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '8px 20px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {saveError}
          <button
            onClick={() => setSaveError(null)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Export error banner */}
      {exportError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '8px 20px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {exportError}
          <button
            onClick={() => setExportError(null)}
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Edit confirmation for sent/signed/archived */}
      {editConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-confirm-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setEditConfirm(false) }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10,14,39,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#141a2e',
              border: '1px solid #2a3350',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 420,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <p id="edit-confirm-title" style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 8px' }}>
              Tài liệu này đã được {STATUS_LABEL[doc.status].toLowerCase()}. Anh có chắc muốn sửa không? Em sẽ lưu phiên bản mới.
            </p>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>
              This document has already been {doc.status}. Are you sure you want to edit? A new version will be saved.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setEditConfirm(false)
                  setEditMode(true)
                  setEditContent(doc.content_md ?? '')
                }}
                style={{ ...toolbarBtnStyle, background: '#14b8a6', color: '#0a0e27', border: 'none' }}
              >
                Yes, edit
              </button>
              <button
                onClick={() => setEditConfirm(false)}
                style={toolbarBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History slide-over */}
      {showHistory && (
        <VersionHistoryPanel
          versions={versions}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

// Shared toolbar button style
const toolbarBtnStyle: React.CSSProperties = {
  background: '#141a2e',
  border: '1px solid #2a3350',
  color: '#e2e8f0',
  fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  padding: '5px 14px',
  borderRadius: 6,
  cursor: 'pointer',
}
