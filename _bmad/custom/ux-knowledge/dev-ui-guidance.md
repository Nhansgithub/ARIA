# UI implementation guidance (ui-ux-pro-max)

Foundational context for story implementation. **Applies only when the story touches UI /
front-end files** (`.tsx/.jsx/.vue/.svelte/.html/.css`, templates, components). For non-UI
stories, ignore.

The project's `DESIGN.md` / `EXPERIENCE.md` spines are the contract and win on conflict. Use
the `ui-ux-pro-max` knowledge base to implement them at professional quality.

Interpreter: `python` (fallback `py`), **never `python3`** (broken stub on this machine).

## Before implementing UI

1. Load the design spines if present (under `{planning_artifacts}/ux-designs/.../DESIGN.md` and
   `EXPERIENCE.md`) — tokens, components, IA, state patterns, accessibility floor.
2. Pull stack-specific best practices for the project's tech stack (default `html-tailwind` when
   none specified; otherwise the stack named in the architecture — React/Next/Vue/Svelte/shadcn/
   Flutter/SwiftUI/etc.):

   ```bash
   python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<topic e.g. form state list responsive>" --stack <stack>
   ```

3. For UX specifics (accessibility, interaction, performance) query `--domain ux`; for charts
   `--domain chart`.

## Pre-delivery checklist (apply at the Step 8 validation gate, before marking a UI task done)

Treat unmet **accessibility** and **touch** items as blocking (do not mark done):

- Icons are SVG (Heroicons/Lucide), not emoji; consistent set and sizing.
- All clickable elements have `cursor-pointer` and clear hover feedback; transitions 150–300ms,
  no layout-shift on hover.
- Visible focus states for keyboard navigation; tab order matches reading order.
- Light/dark contrast ≥ 4.5:1 for body text; borders + glass surfaces visible in both modes.
- Responsive at 375 / 768 / 1024 / 1440; no horizontal scroll on mobile; nothing hidden behind
  fixed chrome.
- All images have alt text; form inputs have labels; color is not the sole indicator;
  `prefers-reduced-motion` respected.

Record checklist adherence briefly in the Dev Agent Record completion notes.
