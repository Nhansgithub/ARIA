# Deferred Work

## Deferred from: code review of 1-2-orchestrator-intent-classification-and-routing (2026-06-26)

- **req.json() body not validated** — `null` or missing `messages` field in request body crashes the route handler; `body.messages as ChatTurn[]` is an unchecked cast. Pre-existing in `route.ts`. Fix: add a null/array guard before passing to classifyIntent and streamChat, return 400 on invalid input.
- **Empty messages array forwarded to Anthropic API** — sending `messages: []` returns a 400 from the API; error surfaces as a stream sentinel (HTTP 200), not a proper HTTP error response. Pre-existing in `streamChat.ts`. Fix: guard `messages.length > 0` before creating the stream.
- **Classifier serializes before stream start** — `classifyIntent` runs fully before `streamChat` begins; P95 latency of the classification call adds directly to time-to-first-byte. Architectural trade-off accepted for now.
- **max_tokens hardcoded 4096 in streamChat** — does not adapt per model; Sonnet-quality deal analysis may need more tokens. Pre-existing from Story 1.1. Fix: derive cap from model like `callAI` does, or accept as a parameter.
- **No per-user rate limiting before AI calls** — a single authenticated user can trigger unbounded concurrent classifier + stream call pairs. Out of scope for MVP; address in a dedicated rate-limit story.
- **streamChat error sentinel visible to user** — Anthropic SDK errors are written as `[ARIA error: ...]` into the stream body. Pre-existing from Story 1.1. Fix: Story 1.6 (degraded AI banner) should intercept this sentinel on the client side.
- **businessContext synthetic 'Understood.' ack turn** — the synthetic assistant turn injected between cache breakpoints could affect cache alignment if content ever changes. Pre-existing from Story 1.1. Revisit if prompt caching metrics show unexpected misses.

## Deferred from: code review of 1-3-bilingual-detection-and-language-mirroring (2026-06-26)

- **Diacritics-free Vietnamese defaults to English** — messages typed without full diacritics (e.g., "ok anh oi") contain no Vietnamese-specific Unicode code points and classify as English. Known limitation accepted per spec dev notes ("short greetings default to English"). No fix planned; would require stopword heuristics or external NLP.
- **Streaming `lang` flip mid-ARIA-response** — `detectLanguage` is called on every render. During streaming, ARIA responses that begin with ASCII chars (e.g., "Anh ơi,") show `lang="en"` until the first Vietnamese char arrives, then snap to `lang="vi"`. Accessibility regression for screen-readers. Deferring — inherent to per-render detection on partial content. Fix: pass `detectedLang` from server to client to pre-set the lang attribute before streaming.
- **No runtime validation that `body.messages` is an array** — pre-existing from Story 0.x routes. See also deferred from story 1.2 review.
- **Test inlines `detectLanguage` rather than importing the real module** — project ts-node convention established in Story 0.7. Unlike modules with `server-only`, `detectLanguage.ts` is pure and importable; the inline copy risks test/implementation divergence. Fix: switch to `import { detectLanguage } from '../language/detectLanguage'` in the test file.

## Deferred from: code review of 1-4-business-context-injection (2026-06-26)

- **`content.trim()` missing before length check in PUT** — leading/trailing whitespace counts toward the 20,000-char limit and gets stored verbatim. Low risk; cosmetic UX improvement for a future polish pass.
- **Auth error from `supabase.auth.getUser()` not logged** — both GET and PUT handlers in `app/api/business-context/route.ts` return 401 when `user` is null, but never log the underlying auth error. Pre-existing pattern across all routes; address as an observability concern in a dedicated logging story.
- **SQL `ALTER TYPE ... ADD VALUE` is irreversible** — PostgreSQL cannot remove enum values once added. The `IF NOT EXISTS` guard makes re-runs safe, but there is no rollback path for the `'settings'` value. Known PostgreSQL limitation; document in migration runbook.
- **`trimToTokenBudget` inlined in test rather than imported** — `lib/__tests__/businessContext.test.ts` copies the pure function inline instead of importing from `getBusinessContext.ts` (which has `server-only`). Tests verify the copy, not the production function. Accepted tradeoff for the ts-node server-only isolation pattern; mitigated by B1 test asserting the constant value.

## Deferred from: code review of 1-5-guidance-stance-enforcement (2026-06-26)

- **D1 prompt length guard (`> 10` chars) is trivially weak** — `lib/__tests__/orchestrator.test.ts`: D1 checks `length > 10` to verify prompts are defined, but any string longer than 10 chars (even `BILINGUAL_REGISTER` alone at 92 chars) would pass. Pre-existing from Story 1.2; not caused by this story's changes.
- **E4 multi-OR false-positive risk** — `lib/__tests__/orchestrator.test.ts`: E4 checks for any one of three phrases (`'only want information' || 'no advice' || 'just tell me'`). If the primary phrase is removed but another OR-branch happens to remain for any reason, the test passes falsely. Pre-existing design choice for phrasing flexibility.
- **E9 multi-OR false-positive risk** — `lib/__tests__/orchestrator.test.ts`: Same issue as E4; E9 checks `'no unrequested advice' || 'no padding'`. Pre-existing design choice.
- **ARIA_MODELS model IDs hardcoded in test** — `lib/__tests__/orchestrator.test.ts`: Model strings `'claude-haiku-4-5-20251001'` and `'claude-sonnet-4-6'` are inlined and do not verify against `lib/ai/models.ts`. A model ID change in `models.ts` would go undetected by C1–C4. Pre-existing from Story 1.2.

## Deferred from: code review of 1-6-graceful-degradation-envelope-and-ui-banner (2026-06-26)

- **AC-2 partial content in degraded bubble** — `components/chat/ChatPanel.tsx`: When a sentinel is detected, partial AI content streamed before the error is preserved in the bubble rather than replaced with the spec's fixed string "AI synthesis is temporarily unavailable. [Retry]". Spec wording is ambiguous; partial content + Retry button is arguably better UX. Revisit if user research shows confusion.
- **Sentinel strip regex `\n\n` prefix dependency** — `components/chat/ChatPanel.tsx`: Detection constant is `'[ARIA error:'` (no newlines) but strip regex is `/\n\n\[ARIA error:[^\]]*\]/g`. Consistent with `streamChat.ts` always prepending `\n\n`; if server format changes, both detection and strip must be updated together.
- **`handleRetry` network failure does not restore `inputValue`** — `components/chat/ChatPanel.tsx`: When `_streamAssistant` is called from `handleRetry` (no `restoreInputValue`), a network failure during retry does not restore the input bar. Intentional — user message remains visible in transcript; input restore only needed for initial-send failures.
- **ID ordering: `assistantId` lower than `userMsgId`** — `components/chat/ChatPanel.tsx` `handleSend`: For non-retry sends, `assistantId` is assigned `++idCounterRef.current` before `userMsgId`, giving the assistant slot a numerically lower ID than the user message appended before it. Pre-existing pattern from Story 1.1.
- **Double-click race on Retry button** — `components/chat/ChatPanel.tsx` `handleRetry`: `isStreaming` guard reads from React closure state which hasn't re-rendered yet when two clicks arrive sub-millisecond apart. Two concurrent `_streamAssistant` calls can theoretically start. A ref-based `isStreamingRef` guard would fully eliminate this.
- **AC-5 toast missing [Retry] CTA button** — `components/chat/ChatPanel.tsx`: Toast shows informational copy + auto-dismisses; has no inline [Retry] button calling `handleSend`. Core AC-5 behavior (input restored, blank slot removed) is met; explicit Retry button is a UX enhancement.
