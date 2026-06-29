'use client'

interface WelcomeCardProps {
  ownerName: string | null
  lang: 'vi' | 'en'
  onSkipBusinessContext: () => void
}

function buildGreeting(ownerName: string | null, lang: 'vi' | 'en'): string {
  if (lang === 'vi') {
    return ownerName
      ? `Chào Anh ${ownerName}! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
      : `Chào anh! Em là ARIA — trợ lý kinh doanh của anh. Anh chưa có deal nào cả, mình bắt đầu bằng cách anh kể cho em nghe một khách đang thương lượng được không? Không cần điền form — cứ kể tự nhiên.`
  }
  return ownerName
    ? `Hi ${ownerName}! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
    : `Hi there! I'm ARIA, your business consultant. You don't have any deals yet — just tell me about someone you're working with. No forms needed.`
}

export function WelcomeCard({ ownerName, lang, onSkipBusinessContext }: WelcomeCardProps) {
  const greeting = buildGreeting(ownerName, lang)
  const softPrompt =
    lang === 'vi'
      ? 'Anh đang thương lượng deal nào không? Kể cho em nghe đi.'
      : "Tell me about a deal you're working on."
  const asideText =
    lang === 'vi'
      ? 'Muốn cài đặt ngữ cảnh kinh doanh trước không? '
      : 'Want to set up business context first? '
  const skipLabel = lang === 'vi' ? 'Để sau' : 'Skip'

  return (
    <div
      style={{
        minHeight: 320,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: '#14b8a6',
          letterSpacing: '0.08em',
        }}
      >
        ARIA
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: '#e2e8f0',
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        {greeting}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: '#94a3b8',
          fontStyle: 'italic',
        }}
      >
        {softPrompt}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: '#94a3b8',
        }}
      >
        {asideText}
        <button
          onClick={onSkipBusinessContext}
          style={{
            background: 'none',
            border: 'none',
            color: '#14b8a6',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          {skipLabel}
        </button>
      </p>
    </div>
  )
}
