# ui-ux-pro-max — facilitator guide (knowledge base on tap)

You (bmad-ux) have a precise UI/UX **knowledge base** available: `ui-ux-pro-max`. It is a
searchable design-intelligence engine, not a designer. Use it to make your facilitation
**concrete and grounded** — but stay a facilitator: you present options, **the user picks**.
`DESIGN.md` / `EXPERIENCE.md` remain the contract and win on every conflict.

## Stance — grounded options, user picks

- The KB turns "what colors do you want?" into "here are 3 *grounded* directions for a fintech
  dashboard — navy+amber (WCAG AAA), … — which feels right, or none?"
- Never silently adopt KB output as truth. It is heuristic (BM25 ranking) and can mis-rank
  (e.g. return a landing pattern for a dashboard query). Read it, curate it, offer the sensible
  subset, and record the user's decision in `.memlog.md`.

## Interpreter

Use `python` (fallback `py`). **Do NOT use `python3`** — it is a non-functional Windows Store
stub on this machine. The script path (from project root):
`.claude/skills/ui-ux-pro-max/scripts/search.py`.

## Command recipes

```bash
# Full grounded design system (markdown — embeddable). Lead with this.
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <style kw>" --design-system -f markdown [-p "Project Name"]

# Targeted domain searches (alternatives / deeper detail)
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain color       # palettes by product type
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain typography   # font pairings + Google Fonts
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain style        # visual styles + effects
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain landing      # page structure / CTA strategy
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain chart        # chart type + library
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain ux           # accessibility / interaction / perf rules
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --domain product      # product-type recommendations

# Stack-specific implementation guidance (default html-tailwind when unspecified)
python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<topic>" --stack <html-tailwind|react|nextjs|vue|svelte|shadcn|nuxtjs|astro|swiftui|react-native|flutter|jetpack-compose>
```

## When to reach for it

- **Discovery, at a visual/UX decision moment** — picking color tokens, visual personality,
  typography, chart choices, landing structure, or accessibility rules. Prefer the
  **design-system creative tool** (`creative-tool-design-system.md`) which renders candidate
  directions as option cards. The picks are the user's.
- **Any time a concrete reference helps** — fire a `--domain` search and surface the relevant
  rows as options. This is the `external_sources` path: consult on demand.

## At Finalize (distillation)

When distilling the spines, the subagent should **ground** them in the user's chosen KB output:

- `DESIGN.md` — real hex values, Google-Font pairings (with import), radius/spacing language,
  elevation/effects, and a Do's/Don'ts table seeded from the KB's anti-patterns + pre-delivery
  checklist. Keep the canonical section order.
- `EXPERIENCE.md` — accessibility floor (contrast ≥ 4.5:1, 44×44px touch targets, visible focus,
  keyboard nav, reduced-motion) and interaction primitives grounded in the KB's UX rules.
- Save the raw KB markdown the choices came from to `.working/design-system-uiuxpromax.md` for
  the audit trail.

**Spines win on conflict.** The KB informs; it does not override what the user decided.
