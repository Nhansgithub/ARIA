'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ZaloStatus = 'not_configured' | 'connected' | 'token_expired'

interface ChannelSettings {
  email_enabled: boolean
  zalo_status: ZaloStatus
  zalo_setup_note_shown: boolean
}

type PatchableSettings = Pick<ChannelSettings, 'email_enabled' | 'zalo_setup_note_shown'>

const DEFAULTS: ChannelSettings = {
  email_enabled: true,
  zalo_status: 'not_configured',
  zalo_setup_note_shown: false,
}

const ZALO_STATUS_LABEL: Record<ZaloStatus, string> = {
  not_configured: 'Chưa kết nối',
  connected: 'Đã kết nối',
  token_expired: 'Hết hạn — cần kết nối lại',
}

const ZALO_STATUS_COLOR: Record<ZaloStatus, string> = {
  not_configured: '#64748b',
  connected: '#14b8a6',
  token_expired: '#f59e0b',
}

export function NotificationChannelsPanel() {
  const [settings, setSettings] = useState<ChannelSettings>(DEFAULTS)
  const [zaloServerConfigured, setZaloServerConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [showEmailOffDialog, setShowEmailOffDialog] = useState(false)

  // Zalo setup wizard state
  const [showZaloWizard, setShowZaloWizard] = useState(false)
  const [zaloUserId, setZaloUserId] = useState('')
  const [zaloFollowConfirmed, setZaloFollowConfirmed] = useState(false)
  const [zaloConnecting, setZaloConnecting] = useState(false)
  const [zaloConnectError, setZaloConnectError] = useState<string | null>(null)
  const [zaloDisconnectError, setZaloDisconnectError] = useState<string | null>(null)

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogTriggerRef = useRef<HTMLElement | null>(null)
  const dialogCancelRef = useRef<HTMLButtonElement | null>(null)

  // Callback ref — focuses input when wizard mounts, no setTimeout needed
  const zaloUserIdRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus()
  }, [])

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }
  }, [])

  // Restore focus to trigger element when email dialog closes
  useEffect(() => {
    if (showEmailOffDialog) { dialogCancelRef.current?.focus() }
    else { (dialogTriggerRef.current as HTMLElement | null)?.focus() }
  }, [showEmailOffDialog])

  useEffect(() => {
    fetch('/api/settings/notification-channels')
      .then((r) => r.json())
      .then((body: { settings?: ChannelSettings; zalo_server_configured?: boolean }) => {
        if (body?.settings) setSettings(body.settings)
        setZaloServerConfigured(body?.zalo_server_configured ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function persistPatch(patch: Partial<PatchableSettings>) {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch('/api/settings/notification-channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { setSaveStatus('error') }
      else {
        setSettings((prev) => ({ ...prev, ...patch }))
        setSaveStatus('saved')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
      }
    } catch { setSaveStatus('error') }
    finally { setSaving(false) }
  }

  function handleEmailToggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !settings.email_enabled
    if (!next && settings.zalo_status !== 'connected') {
      dialogTriggerRef.current = e.currentTarget
      setShowEmailOffDialog(true)
      return
    }
    persistPatch({ email_enabled: next })
  }

  function closeEmailDialog() { setShowEmailOffDialog(false) }
  function confirmEmailOff() { setShowEmailOffDialog(false); persistPatch({ email_enabled: false }) }

  function closeZaloWizard() {
    setShowZaloWizard(false)
    setZaloUserId('')
    setZaloFollowConfirmed(false)
    setZaloConnectError(null)
  }

  async function handleZaloConnect() {
    if (!zaloUserId.trim() || !zaloFollowConfirmed) return
    setZaloConnecting(true)
    setZaloConnectError(null)
    try {
      const res = await fetch('/api/settings/zalo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zalo_user_id: zaloUserId.trim() }),
      })
      const body = await res.json() as { ok?: boolean; error?: string; message?: string }
      if (!res.ok) {
        setZaloConnectError(body.error ?? 'Kết nối thất bại — thử lại')
      } else {
        setSettings((prev) => ({ ...prev, zalo_status: 'connected' }))
        closeZaloWizard()
      }
    } catch {
      setZaloConnectError('Lỗi mạng — thử lại')
    } finally {
      setZaloConnecting(false)
    }
  }

  async function handleZaloDisconnect() {
    setZaloDisconnectError(null)
    const res = await fetch('/api/settings/zalo/disconnect', { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      setZaloDisconnectError('Ngắt kết nối thất bại — thử lại')
      return
    }
    setSettings((prev) => ({ ...prev, zalo_status: 'not_configured' }))
  }

  const zaloStatusColor = ZALO_STATUS_COLOR[settings.zalo_status]
  const zaloStatusLabel = ZALO_STATUS_LABEL[settings.zalo_status]
  const canConnectZalo = zaloUserId.trim().length > 0 && zaloFollowConfirmed && !zaloConnecting

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#e2e8f0',
        borderTop: '1px solid #2A3350',
      }}
    >
      {/* aria-live region — always mounted so screen readers register it */}
      <div role="status" aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {saveStatus === 'saved' ? 'Đã lưu' : saveStatus === 'error' ? 'Lỗi lưu — thử lại' : ''}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>
        Kênh Thông Báo
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
        ARIA gửi thông báo qua nhiều kênh. In-app luôn được bật.
      </p>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Đang tải…</div>
      ) : (
        <>
          {/* ─── In-app ─────────────────────────────────────────────── */}
          <ChannelRow title="In-app" description="Thông báo trong ứng dụng ARIA — kênh chính, luôn hoạt động.">
            <span style={{ fontSize: 12, fontWeight: 600, color: '#14b8a6', background: 'rgba(20,184,166,0.12)', borderRadius: 4, padding: '3px 8px' }}>
              Luôn bật
            </span>
          </ChannelRow>

          {/* ─── Zalo OA ─────────────────────────────────────────────── */}
          <ChannelRow title="Zalo OA" description="Nhận thông báo qua Zalo Official Account.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: zaloStatusColor, background: `${zaloStatusColor}22`, borderRadius: 4, padding: '3px 8px' }}>
                {zaloStatusLabel}
              </span>
              {settings.zalo_status === 'connected' ? (
                <button
                  onClick={handleZaloDisconnect}
                  style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef444466', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
                >
                  Ngắt kết nối
                </button>
              ) : zaloServerConfigured ? (
                <button
                  onClick={() => setShowZaloWizard(true)}
                  style={{ fontSize: 13, color: '#14b8a6', background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
                >
                  {settings.zalo_status === 'token_expired' ? 'Kết nối lại' : 'Kết nối Zalo OA'}
                </button>
              ) : (
                <span style={{ fontSize: 12, color: '#64748b' }}>Chưa được cấu hình</span>
              )}
            </div>
          </ChannelRow>

          {zaloDisconnectError && (
            <div style={{ background: '#1e0a0a', border: '1px solid #ef444466', borderRadius: 6, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#ef4444' }} role="alert">
              {zaloDisconnectError}
            </div>
          )}

          {/* Zalo not configured info card */}
          {settings.zalo_status !== 'connected' && (
            <div style={{ background: '#141a2e', border: '1px solid #2a3350', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              {zaloServerConfigured
                ? 'Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app.'
                : 'Tính năng Zalo chưa được cấu hình trên máy chủ. Xem hướng dẫn trong thư mục zalo-docs/ để thiết lập ZALO_APP_ID và ZALO_SECRET_KEY.'}
            </div>
          )}

          {/* ─── Email ──────────────────────────────────────────────── */}
          <ChannelRow title="Email" description="Nhận thông báo qua email dự phòng khi Zalo không khả dụng.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saveStatus === 'saved' && <span aria-hidden="true" style={{ fontSize: 13, color: '#14b8a6' }}>Đã lưu</span>}
              {saveStatus === 'error' && <span aria-hidden="true" style={{ fontSize: 13, color: '#ef4444' }}>Lỗi — thử lại</span>}
              <Toggle checked={settings.email_enabled} onChange={handleEmailToggle} disabled={saving} ariaLabel="Bật/tắt thông báo email" />
            </div>
          </ChannelRow>

          {!settings.email_enabled && (
            <div style={{ background: '#141a2e', border: '1px solid #f59e0b44', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#f59e0b', lineHeight: 1.6 }} role="alert">
              Nếu Zalo thất bại sẽ không có kênh dự phòng.
            </div>
          )}
        </>
      )}

      {/* ─── Zalo setup wizard ───────────────────────────────────── */}
      {showZaloWizard && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          role="dialog" aria-modal="true" aria-label="Kết nối Zalo OA"
          onKeyDown={(e) => { if (e.key === 'Escape') closeZaloWizard() }}
        >
          <div style={{ background: '#141a2e', border: '1px solid #2a3350', borderRadius: 12, padding: 28, maxWidth: 440, width: '92%', color: '#e2e8f0' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Kết nối Zalo OA</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
              ARIA sẽ gửi Briefing và nhắc nhở qua Zalo của bạn.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Bước 1 — Nhập Zalo User ID của bạn
              </label>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                Mở app Zalo → Hồ sơ → ID Zalo (dãy số bên dưới tên). Ví dụ: 123456789012.
              </p>
              <input
                ref={zaloUserIdRef}
                type="text"
                inputMode="numeric"
                value={zaloUserId}
                onChange={(e) => setZaloUserId(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập Zalo User ID..."
                style={{ width: '100%', background: '#0a0e27', border: '1px solid #2a3350', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={zaloFollowConfirmed}
                  onChange={(e) => setZaloFollowConfirmed(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong style={{ color: '#e2e8f0' }}>Bước 2 — </strong>
                  Tôi đã mở app Zalo, tìm trang OA &quot;{process.env.NEXT_PUBLIC_ZALO_OA_NAME ?? 'ARIA'}&quot; và nhấn <strong style={{ color: '#14b8a6' }}>Quan tâm</strong> (Follow).
                </span>
              </label>
            </div>

            {zaloConnectError && (
              <div style={{ background: '#1e0a0a', border: '1px solid #ef444466', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }} role="alert">
                {zaloConnectError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={closeZaloWizard}
                style={{ fontSize: 14, color: '#94a3b8', background: 'transparent', border: '1px solid #2a3350', borderRadius: 6, padding: '7px 16px', cursor: 'pointer' }}
              >
                Huỷ
              </button>
              <button
                onClick={handleZaloConnect}
                disabled={!canConnectZalo}
                style={{ fontSize: 14, color: canConnectZalo ? '#0a0e27' : '#64748b', background: canConnectZalo ? '#14b8a6' : '#1e2a45', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: canConnectZalo ? 'pointer' : 'not-allowed', fontWeight: 600 }}
              >
                {zaloConnecting ? 'Đang kết nối…' : 'Kết nối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Email off confirmation dialog ───────────────────────── */}
      {showEmailOffDialog && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          role="dialog" aria-modal="true" aria-label="Xác nhận tắt email"
          onKeyDown={(e) => { if (e.key === 'Escape') closeEmailDialog() }}
        >
          <div style={{ background: '#141a2e', border: '1px solid #2a3350', borderRadius: 12, padding: 28, maxWidth: 400, width: '90%', color: '#e2e8f0' }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
              Nếu tắt email và Zalo chưa kết nối, anh sẽ chỉ thấy thông báo trong app. Tiếp tục không?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button ref={dialogCancelRef} onClick={closeEmailDialog} style={{ fontSize: 14, color: '#94a3b8', background: 'transparent', border: '1px solid #2a3350', borderRadius: 6, padding: '7px 16px', cursor: 'pointer' }}>
                Huỷ
              </button>
              <button onClick={confirmEmailOff} style={{ fontSize: 14, color: '#0a0e27', background: '#14b8a6', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 }}>
                Tắt email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChannelRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#141a2e', border: '1px solid #2a3350', borderRadius: 8, padding: '14px 16px', marginBottom: 12, gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, disabled, ariaLabel }: { checked: boolean; onChange: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled: boolean; ariaLabel: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={ariaLabel}
      onClick={onChange} disabled={disabled}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? '#14b8a6' : '#2a3350', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.15s', opacity: disabled ? 0.6 : 1 }}
    >
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
    </button>
  )
}
