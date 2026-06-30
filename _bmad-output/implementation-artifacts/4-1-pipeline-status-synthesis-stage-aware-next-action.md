---
story: 4-1
title: Pipeline Status Synthesis & Stage-Aware Next-Action
status: done
epic: 4
sprint: 1
---

# Story 4-1: Pipeline Status Synthesis & Stage-Aware Next-Action

## Summary

Adds a dedicated `pipeline_status` intent bucket (Haiku-routed per AD-4) for Owner queries about pipeline health, deal status, and next-action recommendations. ARIA returns prose synthesis — not raw field dumps — with stage-aware, service-type-informed recommendations. Stale deals (>7 days idle) are surfaced explicitly. Degrades gracefully when the Claude API is unavailable.

## Scope

- **FR-14**: Synthesized status reply — prose, not field dump
- **FR-15**: Stage-aware next-action — specific to stage × service_type
- **Bilingual**: full Vietnamese or English response per detected language
- **Degradation**: raw CRM data + degraded notice when API unavailable
- **Model**: Haiku for all pipeline/status queries (economical tier, AD-4)

## Files Created / Modified

- `lib/ai/pipelineStatusTools.ts` — NEW: read-only tool set (get_activity_log, get_deal, get_pipeline_summary, list_deals)
- `lib/ai/orchestrator.ts` — add `pipeline_status` bucket + classifier update + specialist prompt + model map + VALID_BUCKETS
- `app/api/chat/route.ts` — add routing for `pipeline_status` intent
- `lib/__tests__/pipelineStatusSynthesis41.test.ts` — NEW: ts-node inline tests
- `package.json` — add `test:pipeline-status41` script

## Architecture Decisions

- **AD-4**: `pipeline_status` → `ARIA_MODELS.economical` (Haiku); only deal_intelligence uses Sonnet for high-judgment synthesis
- **AD-2**: Tool execution already enforces `.eq('owner_id', ownerId)` in all service functions
- **AD-5**: Tools sorted alphabetically in `PIPELINE_STATUS_TOOLS`
- **AD-6**: Degradation envelope: `{ status: degraded }` sentinel triggers the existing Story 1.6 banner
- Free-text stages are interpreted contextually — never rejected as invalid (FR-15)

## Acceptance Criteria

See epics.md Story 4.1 for full BDD specs. Key scenarios:
1. "What's my pipeline status?" → `list_deals` + synthesis → prose with client, stage, value, days idle, next action
2. "What should I do next with deal X?" → `get_deal` → stage-aware recommendation
3. Deal idle >7 days → surfaced with explicit day count as requiring attention
4. API unavailable → raw CRM fields + "AI tạm thời không khả dụng" message
5. Vietnamese query → full Vietnamese response including stage labels

### Review Findings

- [ ] [Review][Decision] Classifier boundary ambiguity — "How is deal X going?" belongs to both `pipeline_status` and `deal_intelligence` by description; no tiebreaker rule. Wrong bucket = wrong model, missing intelligence-field write-back, no error visible to user. Options: (A) add explicit tiebreaker line to classifier prompt ("pipeline_status if the user asks for status/next-step; deal_intelligence if the user asks for risk/why/analysis"), (B) accept occasional misroute as acceptable given the fallback-to-general_chat safety net. [lib/ai/orchestrator.ts classifier prompt]

- [ ] [Review][Patch] `!` non-null assertions in pipelineStatusTools.ts will produce silent `undefined` in PIPELINE_STATUS_TOOLS if any source tool is renamed — crashing every pipeline_status request with a cryptic runtime error in agentWithTools [lib/ai/pipelineStatusTools.ts:9-12]

- [ ] [Review][Patch] `test:pipeline-status41` not added to `npm test` — all 15 Story 4.1 tests are invisible to CI [package.json:12]

- [ ] [Review][Patch] `list_deals()` called with no `limit` parameter — defaults to 20, silently truncating owners with >20 active deals; specialist prompt should instruct `limit=50` for broad queries [lib/ai/orchestrator.ts pipeline_status specialist prompt Step 1a]

- [ ] [Review][Patch] Stale threshold off-by-one: pipeline_status uses `>7 days`; deal_intelligence uses `>=7 days`; tool description says `≥7 days`. A deal on day 7 appears stalled in DI but healthy in pipeline synthesis — unify to `>=7` [lib/ai/orchestrator.ts:235 vs dealIntelligenceTools.ts:141]

- [ ] [Review][Patch] Degradation message is Vietnamese-only (`"AI tạm thời không khả dụng — đang hiển thị dữ liệu thô."`) with no English fallback — English users receive untranslated error string [lib/ai/orchestrator.ts pipeline_status DEGRADATION]

- [ ] [Review][Patch] T13 tests string presence in source file via `fs.readFileSync`, not the exported runtime array — a renamed tool produces `undefined` in PIPELINE_STATUS_TOOLS with all T13 assertions still green; add import-level assertion to test actual array contents and non-undefined entries [lib/__tests__/pipelineStatusSynthesis41.test.ts:187-196]

- [x] [Review][Defer] `get_deal` sourced from DI_TOOLS carries "Always call this first … Four-Layer Synthesis" description that may confuse Haiku into DI protocol — no runtime divergence today, but fragile to future tool-splitting; address when tools are separated by intent [lib/ai/pipelineStatusTools.ts:10] — deferred, pre-existing tooling architecture choice

- [x] [Review][Defer] Double `.sort()` — pipelineStatusTools sorts once at module load; agentWithTools re-sorts on every request; module-level sort is dead work — low impact, cleanup opportunity [lib/ai/pipelineStatusTools.ts:15-20] — deferred, pre-existing

- [x] [Review][Defer] `get_deal(title=<name>)` has no disambiguation protocol when multiple deals share a similar title — silent wrong-deal selection; pre-existing gap in all intents that use title-based lookup [lib/ai/orchestrator.ts pipeline_status Step 1b] — deferred, pre-existing
