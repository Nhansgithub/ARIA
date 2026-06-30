'use client'

import { useEffect, useRef, useState } from 'react'

interface CadenceConfig {
  daily_cap: number
  high_priority_threshold_days: number
  standard_threshold_days: number
  enabled: boolean
}

const DEFAULT_CONFIG: CadenceConfig = {
  daily_cap: 3,
  high_priority_threshold_days: 3,
  standard_threshold_days: 5,
  enabled: true,
}

export function CadencePanel() {
  const [config, setConfig] = useState<CadenceConfig>(DEFAULT_CONFIG)
  const [initial, setInitial] = useState<CadenceConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetch('/api/settings/cadence')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((data: { config: CadenceConfig }) => {
        setConfig(data.config)
        setInitial(data.config)
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false))
  }, [])

  function validateConfig(c: CadenceConfig): string | null {
    if (c.high_priority_threshold_days >= c.standard_threshold_days) {
      return 'Ngưỡng ưu tiên cao nên ngắn hơn ngưỡng thông thường.'
    }
    if (c.daily_cap < 1 || c.daily_cap > 10) {
      return 'Số lượng check-in tối đa mỗi ngày phải từ 1 đến 10.'
    }
    return null
  }

  function handleChange(field: keyof CadenceConfig, value: number | boolean) {
    const next = { ...config, [field]: value }
    setConfig(next)
    setValidationError(validateConfig(next))
    setStatus('idle')
  }

  async function handleSave() {
    const err = validateConfig(config)
    if (err) { setValidationError(err); return }
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings/cadence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setValidationError((body as { error?: string }).error ?? 'Lưu thất bại.')
        setStatus('error')
        return
      }
      setInitial(config)
      setStatus('saved')
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(initial)
  const canSave = isDirty && !saving && !validationError

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
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>
        Check-In Cadence
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
        Điều chỉnh tần suất ARIA gửi nhắc nhở check-in. Thay đổi sẽ áp dụng từ lần chạy lịch tiếp theo.
      </p>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {/* Enabled toggle */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="cadence-enabled"
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <input
                id="cadence-enabled"
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                Bật nhắc nhở check-in tự động
              </span>
            </label>
          </div>

          {/* Daily cap */}
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="cadence-daily-cap"
              style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}
            >
              Số lượng check-in tối đa mỗi ngày (1–10)
            </label>
            <input
              id="cadence-daily-cap"
              type="number"
              min={1}
              max={10}
              value={config.daily_cap}
              onChange={(e) => handleChange('daily_cap', Number(e.target.value))}
              style={{
                width: 100,
                background: '#141a2e',
                border: '1px solid #2a3350',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none',
              }}
            />
          </div>

          {/* High-priority threshold */}
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="cadence-high-threshold"
              style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}
            >
              Ngưỡng không hoạt động — Deal ưu tiên cao (ngày)
            </label>
            <input
              id="cadence-high-threshold"
              type="number"
              min={1}
              max={89}
              value={config.high_priority_threshold_days}
              onChange={(e) => handleChange('high_priority_threshold_days', Number(e.target.value))}
              style={{
                width: 100,
                background: '#141a2e',
                border: '1px solid #2a3350',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none',
              }}
            />
          </div>

          {/* Standard threshold */}
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="cadence-standard-threshold"
              style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}
            >
              Ngưỡng không hoạt động — Deal thông thường (ngày)
            </label>
            <input
              id="cadence-standard-threshold"
              type="number"
              min={1}
              max={90}
              value={config.standard_threshold_days}
              onChange={(e) => handleChange('standard_threshold_days', Number(e.target.value))}
              style={{
                width: 100,
                background: '#141a2e',
                border: '1px solid #2a3350',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none',
              }}
            />
          </div>

          {/* Validation error */}
          {validationError && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: '#f59e0b',
                marginBottom: 12,
                padding: '8px 12px',
                background: 'rgba(245,158,11,0.08)',
                borderRadius: 6,
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              {validationError}
            </div>
          )}

          {/* Save row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {status === 'saved' && (
              <span style={{ fontSize: 13, color: '#14b8a6' }}>Đã lưu</span>
            )}
            {status === 'error' && !validationError && (
              <span style={{ fontSize: 13, color: '#ef4444' }}>Lưu thất bại — thử lại</span>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                background: canSave ? '#14b8a6' : '#2a3350',
                color: canSave ? '#0a0e27' : '#64748b',
                border: 'none',
                borderRadius: 6,
                padding: '8px 18px',
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                cursor: canSave ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
