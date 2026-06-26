'use client'

import { useState } from 'react'

interface PrivacyNoticeModalProps {
  onAcknowledge: () => void
}

export function PrivacyNoticeModal({ onAcknowledge }: PrivacyNoticeModalProps) {
  const [loading, setLoading] = useState(false)

  async function handleAcknowledge() {
    setLoading(true)
    try {
      const res = await fetch('/api/privacy/acknowledge', { method: 'POST' })
      if (res.ok) {
        onAcknowledge()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-notice-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '2rem',
          maxWidth: 480,
          width: '90%',
        }}
      >
        <h2 id="privacy-notice-title" style={{ marginTop: 0, fontSize: '1.1rem' }}>
          AI Processing Notice / Thông báo xử lý AI
        </h2>
        <p style={{ lineHeight: 1.6 }}>
          Your deal and client information (including any screenshots) is processed by{' '}
          <strong>Anthropic</strong>, an external AI provider, to generate ARIA&apos;s analysis and
          recommendations.
        </p>
        <p style={{ lineHeight: 1.6 }}>
          Thông tin deal và khách hàng của anh (bao gồm ảnh chụp màn hình) được xử lý bởi{' '}
          <strong>Anthropic</strong>, nhà cung cấp AI bên ngoài, để tạo phân tích và đề xuất của
          ARIA.
        </p>
        <p>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Read our full Privacy Policy / Xem Chính sách bảo mật đầy đủ →
          </a>
        </p>
        <button
          onClick={handleAcknowledge}
          disabled={loading}
          autoFocus
          style={{
            marginTop: '1rem',
            padding: '0.6rem 1.5rem',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            backgroundColor: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          {loading ? 'Saving…' : 'Understood / Tôi hiểu rồi'}
        </button>
      </div>
    </div>
  )
}
