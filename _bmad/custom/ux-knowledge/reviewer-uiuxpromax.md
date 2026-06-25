# Reviewer Lens — ui-ux-pro-max checklist & accessibility

Subagent prompt. A Finalize / Validate reviewer lens (slug: `uiuxpromax`). Runs in parallel
with the rubric walker and other reviewers; writes its own file and returns a compact summary
for the synthesis pipeline. Validates — never edits — the spine pair.

## Inputs

`DESIGN.md`, `EXPERIENCE.md`, and (if present) `.working/design-system-uiuxpromax.md` from the
run workspace. Use `python` (fallback `py`; NOT `python3`).

## What to check

Validate the spines against ui-ux-pro-max's priority rules and pre-delivery checklist. Pull the
authoritative rules on demand:

```bash
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility contrast focus" --domain ux
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "touch target interaction loading" --domain ux
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "responsive layout z-index" --domain ux
```

Checklist (severity = downstream impact):

- **Accessibility (critical):** color contrast targets stated and ≥ 4.5:1 for body text; visible
  focus states specified; icon-only controls have labels; keyboard nav / tab order addressed;
  form inputs have labels; color is not the sole indicator; `prefers-reduced-motion` honored.
- **Touch & interaction (critical):** touch targets ≥ 44×44px; clickable elements signal
  interactivity (cursor/hover); async actions have loading + disabled states; clear error/success
  feedback.
- **Layout & responsive (high):** breakpoints / responsive behavior defined (≈375 / 768 / 1024 /
  1440); no content trapped behind fixed chrome; a z-index scale exists; readable mobile body
  size.
- **Typography & color (medium):** line-height 1.5–1.75, line-length ~65–75ch, heading/body
  pairing coherent; tokens carry concrete values.
- **Style & polish (medium):** SVG icons not emoji; consistent style across surfaces; transitions
  150–300ms; stable hover (no layout shift).
- **Charts & data (low, if applicable):** chart type matches data; accessible color guidance;
  table alternative noted.

## Output

Write `{doc_workspace}/review-uiuxpromax.md`:

```markdown
# UI/UX Pro Max Review — {project_name}

## Overall verdict
[2-3 sentences — strong / adequate / thin / broken, and why]

## Findings
- **[critical|high|medium|low]** [finding] (location in DESIGN.md / EXPERIENCE.md). *Fix:* [suggestion].
...
```

Return ONLY a compact summary: overall verdict, finding counts by severity, file path. The
synthesis pipeline folds this into `validation-report.{html,md}` as a distinct reviewer voice.
