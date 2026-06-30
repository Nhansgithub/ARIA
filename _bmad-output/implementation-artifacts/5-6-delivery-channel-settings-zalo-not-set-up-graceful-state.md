---
story: 5-6
title: Delivery Channel Settings & Zalo-Not-Set-Up Graceful State
status: done
epic: 5
sprint: 1
baseline_commit: ""
---

# Story 5.6: Delivery Channel Settings & Zalo-Not-Set-Up Graceful State

## Story

As an Owner, I want clear Settings controls for my notification channels and a graceful in-app experience when Zalo is not yet configured, so that I always understand which channels are active and can manage them without breaking the proactive delivery flow.

## Acceptance Criteria

1. Settings → Notification Channels panel shows all three channels: in-app (always-on), Zalo OA (status), Email (toggle)
2. In-app shown as "Luôn bật" / non-toggleable
3. Zalo OA shows connection status (not_configured/connected/token_expired) with CTA
4. When Zalo not configured: non-blocking info card "Zalo OA chưa kết nối — thông báo chủ động chỉ qua email và in-app."
5. Email toggle with default enabled; disabling shows warning "Nếu Zalo thất bại sẽ không có kênh dự phòng"
6. Email off + Zalo not set up → blocking confirmation dialog before proceeding
7. One-time note on first check-in when Zalo not configured: "Bật Zalo OA trong Cài đặt để nhận tin nhắn này qua Zalo."
8. After note dismissed → PATCH marks zalo_setup_note_shown=true, note never reappears

## Tasks

- [x] Migration: add email_enabled, zalo_status, zalo_setup_note_shown to settings
- [x] API: GET/PATCH /api/settings/notification-channels
- [x] NotificationChannelsPanel.tsx component
- [x] AppShell.tsx: register NotificationChannelsPanel
- [x] ChatPanel.tsx: one-time Zalo setup note
- [x] Tests: lib/__tests__/deliveryChannelSettings56.test.ts (60 tests)
- [x] package.json: test:delivery-channel-settings56 script + chain entry
