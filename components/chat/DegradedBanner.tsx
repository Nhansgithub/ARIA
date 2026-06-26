'use client'

import { AlertTriangle, X } from 'lucide-react'

interface DegradedBannerProps {
  lang: 'vi' | 'en'
  onDismiss: () => void
}

const COPY = {
  en: 'AI synthesis is temporarily unavailable — showing raw data. Analysis will resume when the connection recovers.',
  vi: 'AI tạm thời không khả dụng — đang hiển thị dữ liệu thô. Phân tích sẽ trở lại khi kết nối phục hồi.',
}

export function DegradedBanner({ lang, onDismiss }: DegradedBannerProps) {
  return (
    <div
      role="alert"
      lang={lang}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '8px 16px',
        padding: '10px 16px',
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.40)',
        borderRadius: 8,
        fontSize: 13,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 500,
        color: '#FBBF24',
        flexShrink: 0,
      }}
    >
      {/* Icon — required; color is not the sole indicator */}
      <AlertTriangle size={16} color="#F59E0B" aria-hidden="true" style={{ flexShrink: 0 }} />

      <span style={{ flex: 1 }}>{COPY[lang]}</span>

      <button
        onClick={onDismiss}
        aria-label={lang === 'vi' ? 'Đóng thông báo' : 'Dismiss degraded banner'}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          padding: 4,
          borderRadius: 4,
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e2e8f0')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
      >
        <X size={14} />
      </button>
    </div>
  )
}
