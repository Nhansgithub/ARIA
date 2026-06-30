'use client'

import { useState } from 'react'
import DocumentList from './DocumentList'
import DocumentViewer from './DocumentViewer'

interface DocumentsPanelProps {
  onOpenChat: (prefill: string) => void
}

export default function DocumentsPanel({ onOpenChat }: DocumentsPanelProps) {
  const [view, setView] = useState<'list' | 'viewer'>('list')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  function handleSelect(id: string) {
    setSelectedDocId(id)
    setView('viewer')
  }

  function handleBack() {
    setView('list')
    setSelectedDocId(null)
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', background: '#0a0e27' }}>
      {view === 'list' && <DocumentList onSelect={handleSelect} />}
      {view === 'viewer' && selectedDocId && (
        <DocumentViewer id={selectedDocId} onBack={handleBack} onOpenChat={onOpenChat} />
      )}
    </div>
  )
}
