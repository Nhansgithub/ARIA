# UI/UX review lens (ui-ux-pro-max)

Foundational context for code review. Adds a UI/UX lens alongside the existing adversarial
review layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) and the triage step.

**Trigger:** the changed set includes front-end files (`.tsx/.jsx/.vue/.svelte/.html/.css`,
templates, components, styles). For changes with no UI surface, skip this lens.

Interpreter: `python` (fallback `py`), **never `python3`**.

## How to apply

Review the changed UI against `ui-ux-pro-max`'s priority rules + pre-delivery checklist, and
(where present) the project's `DESIGN.md` / `EXPERIENCE.md` spines. Pull authoritative rules on
demand:

```bash
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<concern e.g. accessibility contrast focus touch>" --domain ux
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<topic>" --stack <project stack>
```

Look for: contrast < 4.5:1; missing/invisible focus states; icon-only controls without labels;
touch targets < 44×44px; emoji used as icons; missing loading/disabled/error states; hover-only
affordances on touch; layout-shifting hover; missing responsive handling; content behind fixed
chrome; missing alt text / form labels; ignored `prefers-reduced-motion`; chart type/data
mismatch.

## Output

Do **not** write a separate report. Fold findings into the skill's existing **triage** step as
review findings, each with: file + line, severity (accessibility/touch = high), and a concrete
fix. This keeps the orchestrator's pass/fail logic and reporting unchanged — UI/UX issues simply
appear as additional triaged findings.
