# Grounded Design-System Renderer (ui-ux-pro-max)

Subagent prompt. Produce candidate, **knowledge-base-grounded** design directions so the user
can pick — the picks are theirs. This is the bridge between bmad-ux's "elicit, never impose"
facilitation and ui-ux-pro-max's precise recommendations: the KB supplies *concrete* options;
the facilitator presents them; the user decides.

## Inputs (passed by the parent)

Current `.memlog.md`, any relevant prior `.working/` captures, the user's stated intent for this
pass, and the output path `.working/design-system-options-{n}.html`. From these, derive query
terms: **product type, industry, visual style keywords, target UI stack, form-factor**.

## Steps

1. **Generate the grounded system.** Use `python` (fallback `py`; NOT `python3`):

   ```bash
   python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <style kw>" --design-system -f markdown
   ```

   Save the raw markdown verbatim to `.working/design-system-uiuxpromax.md` (audit trail).

2. **Gather alternates** for genuine variety with 1–3 supplementary domain searches, e.g.:

   ```bash
   python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<style kw>" --domain style -n 4
   python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<mood kw>" --domain typography -n 4
   python {project-root}/.claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry>" --domain color -n 4
   ```

3. **Render 2–4 distinct candidate directions** into the supplied
   `.working/design-system-options-{n}.html`. Each candidate gets: a header (direction name +
   one-line register), color token chips with concrete hex for every role (primary, secondary,
   CTA, background, text, border), a font-pairing preview (heading + body, real Google Fonts),
   the style name + key effects, and a short **avoid** note from the KB's anti-patterns. Show
   light and dark side-by-side when both modes are in scope. One realistic UI snippet per
   candidate using content drawn from the conversation, not lorem. Curate — drop KB rows that
   clearly mismatch the product (the KB is heuristic and can mis-rank).

   Inline CSS only, system font stack for chrome, no JS, no network beyond Google-Font `<link>`
   if previewing fonts. Document concrete hex + font names in `<style>` comments per candidate so
   the chosen values can be lifted into `DESIGN.md`. The spine itself stays semantic.

## Return

Return to the parent ONLY: the file path, one line per candidate (name + the palette/font/style
in a phrase), and mode coverage. Do not dump HTML into the parent context. If interactive, open
with `python -c "import webbrowser, pathlib; webbrowser.open(pathlib.Path('PATH').resolve().as_uri())"`
(fallback `py -c`). Skip opening in headless.

The facilitator then presents the candidates, the user picks (or asks for another pass), and the
decision is appended to `.memlog.md` via `memlog.py append --type decision`.
