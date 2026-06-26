'use client'

import { useState } from 'react'
import { MessageSquare, FileText, LayoutDashboard, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ChatPanel from '@/components/chat/ChatPanel'
import { logout } from '@/app/actions/auth'

type Mode = 'chat' | 'briefing' | 'documents' | 'settings'

interface NavItem {
  id: Mode
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'briefing', label: 'Briefing', Icon: LayoutDashboard },
  { id: 'documents', label: 'Documents', Icon: FileText },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      title={item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 16px',
        background: active ? '#141a2e' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid #14b8a6' : '2px solid transparent',
        borderRadius: 0,
        color: active ? '#e2e8f0' : '#94a3b8',
        fontSize: 14,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <item.Icon size={18} color={active ? '#14b8a6' : '#94a3b8'} />
      <span className="aria-sidebar-label">{item.label}</span>
    </button>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#94a3b8',
        fontSize: 15,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {title} — coming soon
    </div>
  )
}

export default function AppShell() {
  const [mode, setMode] = useState<Mode>('chat')

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: '#0a0e27',
      }}
    >
      {/* Left sidebar */}
      <nav
        className="aria-sidebar"
        style={{
          background: '#0a0e27',
          borderRight: '1px solid #2a3350',
          overflowY: 'auto',
        }}
      >
        {/* Wordmark */}
        <div
          className="aria-sidebar-wordmark"
          style={{
            padding: '20px 16px 16px',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#14b8a6',
            }}
          >
            ARIA
          </span>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11,
              color: '#94a3b8',
              letterSpacing: '0.06em',
            }}
          >
            Business Consultant
          </span>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, paddingTop: 8 }}>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={mode === item.id}
              onClick={() => setMode(item.id)}
            />
          ))}
        </div>

        {/* Settings / Sign out (bottom of sidebar) */}
        <div style={{ padding: '8px 0', borderTop: '1px solid #2a3350' }}>
          <form action={logout} style={{ padding: '4px 16px' }}>
            <button
              type="submit"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: 'pointer',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span className="aria-sidebar-label">Sign out</span>
            </button>
          </form>
        </div>
      </nav>

      {/* Main content area */}
      <main
        className="aria-main-content"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {mode === 'chat' && <ChatPanel />}
        {mode === 'briefing' && <Placeholder title="Briefing" />}
        {mode === 'documents' && <Placeholder title="Documents" />}
        {mode === 'settings' && <Placeholder title="Settings" />}
      </main>

      {/* Bottom tab bar — mobile only */}
      <div className="aria-bottom-tabs" role="tablist">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => setMode(item.id)}
            title={item.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              color: mode === item.id ? '#14b8a6' : '#94a3b8',
              fontSize: 10,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <item.Icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
