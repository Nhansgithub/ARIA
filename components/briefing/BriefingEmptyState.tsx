'use client'

export function BriefingEmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '48px 24px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 15,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div>
        <p style={{ margin: 0, marginBottom: 8 }}>Chưa có briefing.</p>
        <p style={{ margin: 0, fontSize: 13 }}>Hãy kể cho ARIA nghe về một deal trước nhé.</p>
      </div>
    </div>
  )
}
