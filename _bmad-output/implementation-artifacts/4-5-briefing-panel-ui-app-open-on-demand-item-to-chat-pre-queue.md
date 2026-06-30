---
story: 4-5
title: Briefing Panel UI — App-Open, On-Demand & Item-to-Chat Pre-Queue
status: done
epic: 4
sprint: 1
baseline_commit: c2efd6a
---

# Story 4-5: Briefing Panel UI — App-Open, On-Demand & Item-to-Chat Pre-Queue

## Summary

Builds the full Briefing Panel UI:
- `app/api/briefing/today/route.ts` — server route to read/generate today's briefing
- `components/briefing/BriefingPanel.tsx` — full panel: skeleton, Today cards, markdown render, refresh
- `components/layout/AppShell.tsx` — default mode = briefing, badge state, callback wiring

## Scope

- **FR-27, UJ-1**: App-open defaults to Briefing if briefing exists; falls back to Chat if empty CRM
- **FR-27**: Skeleton loading while data fetches; on-demand generation if no cached briefing
- **FR-27, UJ-1**: Today cards (max 3) are tappable → Chat mode with pre-queued message (NOT auto-sent)
- **DESIGN.md §7.2**: First Today item = amber left border (`#f59e0b`); others = teal (`#14b8a6`)
- **EXPERIENCE.md**: Skeleton rows match section structure; no empty state flicker
- **FR-38**: Briefing nav item shows amber badge count (severity:high flags); clears when seen
- **FR-27**: Refresh button in footer; spinner during generation; updates `generated_at` display
- **AD-6**: Degraded sub-banner "Dữ liệu từ [time]" when status = degraded
- **AD-13**: API route uses `createServerClient()` for read; `generateBriefingForOwner` (service role) only for on-demand generation (system task)

## Files Created / Modified

- `app/api/briefing/today/route.ts` — NEW: read today's briefing; on-demand generation
- `components/briefing/BriefingPanel.tsx` — NEW: full briefing UI panel
- `components/layout/AppShell.tsx` — MODIFY: default mode, badge, callbacks
- `lib/__tests__/briefingPanelUI45.test.ts` — NEW: inline ts-node tests
- `package.json` — add `test:briefing-panel-ui45` + CI chain

## Architecture Decisions

- **AD-13**: API route reads briefings via `createServerClient()` (owner's scoped client); generation via `generateBriefingForOwner` (service role, acceptable — system task triggered on-demand)
- **Pre-queue, no auto-send**: Chat input is pre-populated but NEVER auto-submitted; owner must press Send
- **Degraded banner**: `status: 'degraded'` → show sub-banner with `generated_at` from prior day
- **Badge lifecycle**: `onHighFlagCount` callback from BriefingPanel → badge in AppShell nav; clears on nav away from briefing
- **On-demand generation**: If no cached briefing → `?generate=true` triggers `generateBriefingForOwner`; empty CRM → `onEmpty()` → switch to Chat

## Tasks/Subtasks

- [x] T1: Create `app/api/briefing/today/route.ts` — GET handler with auth, read + on-demand generation
- [x] T2: Create `components/briefing/BriefingPanel.tsx` — full panel component
- [x] T3: Update `components/layout/AppShell.tsx` — default briefing mode, badge, callbacks
- [x] T4: Write `briefingPanelUI45.test.ts` with ≥60 tests; all pass
- [x] T5: Update `package.json` — test script + CI chain

## Acceptance Criteria

1. App shell defaults to `mode = 'briefing'`; BriefingPanel calls `onEmpty()` → Chat if no briefing
2. BriefingPanel shows skeleton rows while fetching briefing
3. Today cards (max 3) render with amber border (#1) and teal border (others)
4. Tapping a Today card calls `onOpenChat(prequeueMsg)` — message is NOT auto-sent
5. Pre-queue message is editable in InputBar before sending
6. Briefing nav item badge = count of severity:high flags; clears when user navigates away
7. Refresh button triggers re-generation; shows spinner during; updates timestamp on completion
8. `status: 'degraded'` → amber sub-banner showing cached data time
9. API route: authenticated, uses `createServerClient()` for read (AD-13)
10. forceRefresh=true query param → re-generate via `generateBriefingForOwner`

## Dev Agent Record

### Completion Notes

- `BriefingPanel` fetches `/api/briefing/today` on mount; if null AND no generate attempt yet → triggers `?generate=true`; if still null → calls `onEmpty()` (empty CRM → Chat)
- Today items derived from `flags.items` filtered to overdue, cadence_reminder, high-stale (max 3)
- Amber `#f59e0b` left border for the highest-urgency Today item (index 0), teal `#14b8a6` for the rest
- Pre-queue message composed as `${flag.label}. ARIA nghĩ tiếp theo nên làm gì?` — editable before send
- Badge count = `flags.items.filter(f => f.severity === 'high').length`; passed to AppShell via `onHighFlagCount` callback
- AppShell: `setBriefingBadgeCount` state; badge clears when user navigates away from briefing tab

### File List

- `app/api/briefing/today/route.ts` — NEW
- `components/briefing/BriefingPanel.tsx` — NEW
- `components/layout/AppShell.tsx` — MODIFIED
- `lib/__tests__/briefingPanelUI45.test.ts` — NEW
- `package.json` — MODIFIED

### Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story implemented — full briefing panel UI, app-open behavior, item-to-chat pre-queue |
