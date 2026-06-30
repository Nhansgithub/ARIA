'use client'

import { useState } from 'react'
import { computeDiff, formatVersionLabel } from './DocumentViewer'
import type { DiffLine } from './DocumentViewer'

// Inline types (no lib/ import — AD-11)
type DocumentStatus = 'draft' | 'review' | 'sent' | 'signed' | 'archived'
type DocumentType =
  'proposal' | 'contract' | 'brief' | 'sop' | 'report' | 'invoice' | 'onboarding' | 'other'

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

interface VersionHistoryPanelProps {
  versions: DocumentRow[]
  onClose: () => void
}

export default function VersionHistoryPanel({ versions, onClose }: VersionHistoryPanelProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])

  // Reverse for display (newest first)
  const reversed = [...versions].reverse()

  function handleVersionClick(ver: DocumentRow) {
    if (expandedVersionId === ver.id) {
      setExpandedVersionId(null)
      setDiffLines([])
      return
    }

    // Find previous version in the original (asc) list
    const idx = versions.findIndex((v) => v.id === ver.id)
    const prevVer = idx > 0 ? versions[idx - 1] : null

    const oldLines = (prevVer?.content_md ?? '').split('\n')
    const newLines = (ver.content_md ?? '').split('\n')

    setDiffLines(computeDiff(oldLines, newLines))
    setExpandedVersionId(ver.id)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 99,
        }}
      />

      {/* Slide-over panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 320,
          background: '#0f1629',
          borderLeft: '1px solid #2a3350',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #2a3350',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: '#e2e8f0',
            }}
          >
            Version History
          </span>
          <button
            onClick={onClose}
            aria-label="Close version history"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Version list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {reversed.length === 0 ? (
            <div
              style={{
                padding: 20,
                color: '#94a3b8',
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              No versions yet.
            </div>
          ) : (
            reversed.map((ver, i) => {
              const isFirst = i === 0 // newest version
              return (
                <div key={ver.id} style={{ borderBottom: '1px solid #141a2e' }}>
                  {/* Version row */}
                  <button
                    onClick={() => handleVersionClick(ver)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: expandedVersionId === ver.id ? '#141a2e' : 'transparent',
                      border: 'none',
                      padding: '12px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                    onMouseEnter={(e) => {
                      if (expandedVersionId !== ver.id) e.currentTarget.style.background = '#141a2e'
                    }}
                    onMouseLeave={(e) => {
                      if (expandedVersionId !== ver.id)
                        e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Version number badge */}
                    <span
                      style={{
                        fontSize: 11,
                        color: isFirst ? '#14b8a6' : '#94a3b8',
                        background: isFirst ? 'rgba(20,184,166,0.15)' : '#1e2a45',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      v{ver.version}
                    </span>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#e2e8f0',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {ver.created_by === 'ai' ? 'ARIA' : 'You'}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          marginTop: 2,
                        }}
                      >
                        {formatVersionLabel(ver.created_by, ver.created_at).split(' · ')[1]}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>
                      {expandedVersionId === ver.id ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Diff panel — inline below the row */}
                  {expandedVersionId === ver.id && (
                    <div
                      style={{
                        background: '#0a0e27',
                        borderTop: '1px solid #2a3350',
                        padding: '12px 20px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        lineHeight: 1.6,
                        maxHeight: 360,
                        overflowY: 'auto',
                      }}
                    >
                      {diffLines.length === 0 ? (
                        <span style={{ color: '#64748b' }}>No changes vs. previous version.</span>
                      ) : (
                        diffLines.map((dl, lineIdx) => (
                          <div
                            key={lineIdx}
                            style={{
                              background:
                                dl.type === 'added'
                                  ? '#dcfce7'
                                  : dl.type === 'removed'
                                    ? '#fee2e2'
                                    : 'transparent',
                              color:
                                dl.type === 'added'
                                  ? '#166534'
                                  : dl.type === 'removed'
                                    ? '#991b1b'
                                    : '#94a3b8',
                              padding: '1px 4px',
                              borderRadius: 2,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {dl.type === 'added' ? '+ ' : dl.type === 'removed' ? '− ' : '  '}
                            {dl.line}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
