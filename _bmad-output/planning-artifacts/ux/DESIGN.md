---
title: "ARIA Visual Identity Contract"
status: final
updated: 2026-06-25
author: UX / Brand Design

tokens:
  colors:
    bg:           "#0A0E27"
    surface:      "#141A2E"
    surfaceRaised:"#1C2440"
    border:       "#2A3350"
    primary:      "#14B8A6"
    primaryHover: "#0D9488"
    accent:       "#F59E0B"
    text:         "#E2E8F0"
    textMuted:    "#94A3B8"
    success:      "#34D399"
    warning:      "#FBBF24"
    danger:       "#F87171"
    userBubble:   "#1C2440"
    ariaBubble:   "#141A2E"

  typography:
    heading: "Plus Jakarta Sans"
    body:    "Plus Jakarta Sans"
    mono:    "JetBrains Mono"

  rounded:
    sm:   "6px"
    md:   "8px"
    lg:   "12px"
    xl:   "16px"
    full: "9999px"

  spacing:
    base: "4px"
    scale:
      1: "4px"
      2: "8px"
      3: "12px"
      4: "16px"
      6: "24px"
      8: "32px"

  components:
    chatBubble:
      user:
        bg:        "#1C2440"   # surfaceRaised
        text:      "#E2E8F0"
        radius:    "12px 12px 4px 12px"
        padding:   "12px 16px"
      aria:
        bg:        "#141A2E"   # surface
        text:      "#E2E8F0"
        radius:    "12px 12px 12px 4px"
        padding:   "12px 16px"
        accentBar: "2px solid #14B8A6"  # left border

    dealCard:
      bg:          "#141A2E"
      border:      "1px solid #2A3350"
      radius:      "12px"
      padding:     "16px"
      riskHighBg:  "#F87171/10"
      riskHighBorder: "#F87171"

    statusPill:
      radius:      "9999px"
      padding:     "2px 10px"
      fontSize:    "12px"
      fontWeight:  "500"
      active:
        bg:    "#14B8A6/15"
        text:  "#14B8A6"
      stale:
        bg:    "#F59E0B/15"
        text:  "#F59E0B"
      closed:
        bg:    "#2A3350"
        text:  "#94A3B8"
      danger:
        bg:    "#F87171/15"
        text:  "#F87171"

    button:
      primary:
        bg:        "#14B8A6"
        bgHover:   "#0D9488"
        text:      "#0A0E27"
        fontWeight: "600"
        radius:    "8px"
        height:    "40px"
        padding:   "0 20px"
      secondary:
        bg:        "#1C2440"
        bgHover:   "#2A3350"
        text:      "#E2E8F0"
        border:    "1px solid #2A3350"
        radius:    "8px"
        height:    "40px"
      ghost:
        bg:        "transparent"
        bgHover:   "#141A2E"
        text:      "#94A3B8"
        textHover: "#E2E8F0"
        radius:    "8px"
        height:    "40px"
      accent:
        bg:        "#F59E0B"
        bgHover:   "#D97706"
        text:      "#0A0E27"
        fontWeight: "600"
        radius:    "8px"
        height:    "40px"

    inputBar:
      bg:          "#141A2E"
      border:      "1px solid #2A3350"
      borderFocus: "1px solid #14B8A6"
      radius:      "12px"
      padding:     "12px 16px"
      text:        "#E2E8F0"
      placeholder: "#94A3B8"
      focusRing:   "0 0 0 2px #14B8A6/30"

    checkInChip:
      bg:          "#1C2440"
      bgHover:     "#2A3350"
      border:      "1px solid #2A3350"
      borderHover: "1px solid #14B8A6"
      text:        "#E2E8F0"
      radius:      "9999px"
      padding:     "8px 16px"
      fontSize:    "14px"

    degradedBanner:
      bg:          "#F59E0B/12"
      border:      "1px solid #F59E0B/40"
      text:        "#FBBF24"
      iconColor:   "#F59E0B"
      radius:      "8px"
      padding:     "10px 16px"
      iconRequired: true  # icon MUST accompany text — color is never the sole indicator

    documentViewer:
      chrome:
        bg:          "#141A2E"
        headerBg:    "#0A0E27"
        headerBorder:"1px solid #2A3350"
        radius:      "12px"
        padding:     "0"
      toolbar:
        height:      "48px"
        buttonSize:  "32px"
        gap:         "8px"
      content:
        bg:          "#0A0E27"
        padding:     "32px"
        maxWidth:    "720px"
        fontFamily:  "Plus Jakarta Sans"
        fontSize:    "15px"
        lineHeight:  "1.65"
---

# ARIA Visual Identity Contract

> This document is the single source of truth for ARIA's visual system. Every value herein is a binding constraint for implementation. Tokens in the YAML frontmatter are machine-readable; prose sections add rationale, usage rules, and anti-patterns.

---

## 1. Brand & Style

### Brand Identity

**Product:** ARIA — Adaptive Revenue Intelligence Assistant. A calm, ever-present AI business consultant for a solo service-agency founder. The brand must feel like a trusted business partner, not a productivity app.

**Brand Voice (one line):** *Calm confidence that arrives before you ask.*

#### Wordmark

The wordmark is set in **Plus Jakarta Sans SemiBold (600)**, all-caps letter-spaced at `0.12em`:

```
A R I A
```

Color: `#E2E8F0` (text) against `#0A0E27` (bg). The "R" tracking draws the eye briefly — a subtle rhythm in the four-letter name that mirrors ARIA's analytical cadence.

#### Brand Mark Concept — "Dawn Arc"

Since ARIA has no logo today, this defines the v1 mark concept for handoff to a visual designer.

**Concept:** A half-disc (arc rising from a horizontal baseline) rendered in `#14B8A6` (primary teal), with a very subtle inner glow that fades to transparent at the center. The arc evokes:
- The **morning briefing** — dawn breaking, the daily intelligence arriving before the founder's day begins.
- **Ever-present guidance** — an assistant always on the horizon, not intrusive.
- **Aurora** — a natural, calm luminescence, not a technical UI artifact.

**Inline SVG concept (reference — not production-ready):**

```svg
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- baseline -->
  <line x1="4" y1="24" x2="28" y2="24" stroke="#2A3350" stroke-width="1.5" stroke-linecap="round"/>
  <!-- dawn arc — half-disc rising from baseline -->
  <path d="M6 24 A10 10 0 0 1 26 24" stroke="#14B8A6" stroke-width="2" stroke-linecap="round" fill="none"/>
  <!-- inner soft arc — lighter, suggests depth -->
  <path d="M9 24 A7 7 0 0 1 23 24" stroke="#14B8A6" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.4"/>
  <!-- center dot — the point of presence -->
  <circle cx="16" cy="24" r="2" fill="#14B8A6"/>
</svg>
```

**Mark usage:**
- App icon: dawn arc on `#0A0E27` background, with 4px padding inset.
- Favicon: simplified — single arc + dot only.
- Lockup: mark left, wordmark right, 8px gap, vertically centered on mark midpoint.
- Never recolor the mark to anything outside `#14B8A6` / `#0D9488`.
- Do not use the mark in amber/accent; accent is reserved for urgency, not identity.

**Rationale:** The arc avoids the over-used "AI brain/circuit" metaphor. It is culturally neutral (works in VI and EN contexts), inherently calm, and directly connected to ARIA's daily briefing concept — the thing that meets you at the start of the day. A full circle would read "complete/closed"; the half-arc reads "present, watching, ready."

---

## 2. Colors

### Direction: Focused Dark

The palette is **deep midnight** — dark navy, not black. The hierarchy runs through surface lightness: deeper backgrounds recede, lighter surfaces carry content, teal signals action and trust, amber signals attention without panic.

This is **not** cyberpunk. No neon gradients, no purple-pink glow. The darkness is the quiet of a late-night partner who is always working — calm, not dramatic.

### Color Roles

| Token           | Hex       | Role                                                         |
|-----------------|-----------|--------------------------------------------------------------|
| `bg`            | `#0A0E27` | App background — the canvas everything sits on              |
| `surface`       | `#141A2E` | Cards, panels, ARIA chat bubbles, document chrome           |
| `surfaceRaised` | `#1C2440` | Modals, dropdowns, user chat bubbles, elevated sheets       |
| `border`        | `#2A3350` | All dividers, card outlines, input borders at rest          |
| `primary`       | `#14B8A6` | Teal — interactive affordance: links, focus rings, active states, ARIA accent bar |
| `primaryHover`  | `#0D9488` | Primary hover / pressed                                     |
| `accent`        | `#F59E0B` | Warm amber — CTAs that need urgency (not generic actions), warning badges, degraded-AI banner |
| `text`          | `#E2E8F0` | All primary readable content                                |
| `textMuted`     | `#94A3B8` | Secondary labels, timestamps, metadata, placeholders       |
| `success`       | `#34D399` | Positive status (deal won, doc sent, check-in answered)     |
| `warning`       | `#FBBF24` | Non-critical attention (stale deal, missing doc)            |
| `danger`        | `#F87171` | Risk flags, destructive actions, high-urgency alerts        |
| `userBubble`    | `#1C2440` | User's chat message background                              |
| `ariaBubble`    | `#141A2E` | ARIA's chat message background                              |

### Contrast Ratios

All ratios measured against `#0A0E27` (bg) and `#141A2E` (surface).

| Foreground  | On `bg` (#0A0E27) | On `surface` (#141A2E) | WCAG      |
|-------------|-------------------|------------------------|-----------|
| `text` `#E2E8F0`      | **12.6:1** | **11.2:1** | AAA (both) |
| `textMuted` `#94A3B8` | **5.3:1**  | **4.7:1**  | AA (both); note: use only for supplementary text, not body copy |
| `primary` `#14B8A6`   | **4.6:1**  | **4.1:1**  | AA on bg; fails strict AA on surface — **do not use primary alone as body text on surface; use it for interactive labels ≥14px bold, icons, and borders only** |
| `accent` `#F59E0B`    | **8.1:1**  | **7.2:1**  | AAA on bg, AA on surface |
| `success` `#34D399`   | **7.8:1**  | **6.9:1**  | AAA / AA |
| `warning` `#FBBF24`   | **9.4:1**  | **8.3:1**  | AAA (both) |
| `danger` `#F87171`    | **5.1:1**  | **4.5:1**  | AA (both) |

**Critical rule:** Color is never the only indicator of meaning. Every status, risk, or urgency signal pairs with an icon (SVG, Lucide or Heroicons set) and a text label. A colorblind user must understand every state.

### Color Application Rules

- **Never** use gradient backgrounds on the app canvas — `bg` is flat `#0A0E27`.
- **Teal (`primary`) = "I can interact with this / this is ARIA's voice."** Use it for: chat bubble left-border accent, focus rings, active nav items, links, selected chips, primary input border on focus.
- **Amber (`accent`) = "Pay attention / act now."** Use it for: CTA buttons on briefing items, degraded-AI banner, overdue-deal badges. Do not use amber for generic "primary action" buttons in chat — use teal-labeled ghost or secondary buttons there to preserve amber's urgency signal.
- **Do not mix teal and amber on the same element** (e.g. a button with amber border and teal icon). These two colors are semantically distinct; conflating them destroys the signal.
- **Alpha overlays** for status backgrounds (e.g. `#F87171` at 10–15% opacity on surface) prevent harsh color blocks while maintaining legibility. Always pair with a full-opacity icon or text label.
- **Avoid pure black (`#000000`)** anywhere. The darkest surface is `bg` at `#0A0E27`.

---

## 3. Typography

### Google Fonts Import

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Vietnamese diacritic note:** Plus Jakarta Sans is the required typeface because it provides full support for Vietnamese extended Latin characters (tonal diacritics: à á â ã ā ả ạ ă ắ ặ, etc.) with correct vertical metrics and optical weight. **Poppins is explicitly excluded** — it lacks adequate Vietnamese glyph coverage and produces incorrect diacritic stacking in production. This is a binding constraint; no future font substitution should be made without verifying full Vietnamese Unicode range (U+00C0–U+024F, U+1E00–U+1EFF) coverage.

### Type Scale

| Role             | Size | Weight | Line Height | Letter Spacing | Font       |
|------------------|------|--------|-------------|----------------|------------|
| `display`        | 28px | 700    | 1.2         | -0.02em        | Plus Jakarta Sans |
| `h1`             | 22px | 700    | 1.25        | -0.015em       | Plus Jakarta Sans |
| `h2`             | 18px | 600    | 1.3         | -0.01em        | Plus Jakarta Sans |
| `h3`             | 16px | 600    | 1.4         | 0              | Plus Jakarta Sans |
| `body`           | 15px | 400    | 1.65        | 0              | Plus Jakarta Sans |
| `body-medium`    | 15px | 500    | 1.65        | 0              | Plus Jakarta Sans |
| `small`          | 13px | 400    | 1.5         | 0.01em         | Plus Jakarta Sans |
| `label`          | 12px | 500    | 1.4         | 0.04em         | Plus Jakarta Sans |
| `code` / `mono`  | 13px | 400    | 1.6         | 0              | JetBrains Mono |
| `code-heading`   | 13px | 500    | 1.6         | 0              | JetBrains Mono |

**Minimum body size on mobile:** 15px (do not reduce below 15px even on 375px viewport — Vietnamese diacritics require the extra pixel for legibility at normal reading distance).

### Weight Usage

- `400` — body copy, ARIA message content, form inputs.
- `500` — labels, metadata, secondary UI text, code.
- `600` — headings (h2/h3), button labels, status pills, card titles.
- `700` — page/section headings (h1/display), critical emphasis.

### Line Length

Cap prose columns at **65–72 characters** (`max-width: 680px` on body text). Chat bubbles are naturally constrained by the column layout; document viewer content area is `max-width: 720px`.

### Markdown Rendering in Chat

ARIA responses render full GitHub-flavored markdown: `##` headings, `**bold**`, `_italic_`, `- ` bullets, `| table |`, `` `inline code` ``, ` ```fenced code blocks``` ` with syntax highlighting. Rendered font sizes follow the type scale above. Code blocks use `JetBrains Mono` on `#0A0E27` background with `#2A3350` border.

---

## 4. Layout & Spacing

### 4px Base Grid

All spacing values are multiples of 4px. Use the scale tokens:

| Token | Value | Common use |
|-------|-------|------------|
| `sp-1` | 4px  | Icon-to-label gaps, tight metadata rows |
| `sp-2` | 8px  | Intra-component padding (pill, badge) |
| `sp-3` | 12px | Chat bubble internal padding (vertical) |
| `sp-4` | 16px | Card padding, input padding, standard section gap |
| `sp-6` | 24px | Between card groups, section headers |
| `sp-8` | 32px | Page-level section spacing, document content padding |

Never use odd pixel values (1px, 3px, 5px, 7px) except for border widths (1px borders are fine).

### Three-Mode Shell Layout

The app has one persistent layout shell (FR-32):

```
┌────────────────────────────────────────────────────────────┐
│  Sidebar (240px, collapsible)  │  Main Panel (flex-1)      │
│                                │                           │
│  [Dawn Arc + ARIA wordmark]    │  ← Chat | Briefing | Doc  │
│                                │                           │
│  Nav items:                    │                           │
│  · Briefing  (badge if unread) │                           │
│  · Chat                        │                           │
│  · Documents                   │                           │
│  · Settings                    │                           │
│                                │                           │
│  [Business Context summary]    │  [Input bar — Chat mode]  │
└────────────────────────────────────────────────────────────┘
```

**Breakpoints:**

| Breakpoint | Behavior |
|------------|----------|
| `≥ 1024px` (desktop) | Sidebar visible (240px fixed), main panel fills remainder |
| `768–1023px` (tablet) | Sidebar collapses to icon rail (56px), main panel fills |
| `< 768px` (mobile) | Sidebar hidden, Chat primary, nav via bottom bar (4 items) |

**Sidebar:**
- bg: `#0A0E27` (same as page bg — sidebar is not a raised surface; it is carved from the background)
- Active nav item: `#141A2E` fill + `2px solid #14B8A6` left border + `#E2E8F0` text
- Inactive nav item: `#94A3B8` text, hover `#141A2E` fill
- Unread badge: amber `#F59E0B` dot (4px) or count chip

**Main panel max content width:** `1040px` centered; beyond that, extra space is left bg — avoids ultrawide line-length problems.

**Chat column:** max-width `760px` centered within the main panel. Bubbles align left (ARIA) and right (user) with a `16px` horizontal margin minimum from the column edge.

---

## 5. Elevation & Depth

In dark-mode, elevation is communicated through **surface lightness**, not shadow. This is the correct pattern — dark shadows on dark backgrounds are invisible; lighter surfaces read as "above."

| Layer       | Surface Token   | Hex       | Use                          |
|-------------|-----------------|-----------|------------------------------|
| Layer 0     | `bg`            | `#0A0E27` | Page canvas                  |
| Layer 1     | `surface`       | `#141A2E` | Cards, panels, ARIA bubbles  |
| Layer 2     | `surfaceRaised` | `#1C2440` | Modals, dropdowns, user bubbles, tooltips |
| Layer 3     | (inline style)  | `#222C52` | Active-state highlights only; no permanent surfaces at this level |

**Border as separator:** All Layer 1 surfaces include `1px solid #2A3350` borders. This keeps cards readable against the page background without relying solely on lightness difference.

**Subtle glow — used sparingly:**
- Focus ring on interactive inputs: `box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.30)` — the only glow in the system.
- No ambient glow on cards, panels, or headings.
- No neon glow. No `text-shadow` on headings.

**Drop shadow — minimal, purposeful:**
- Modals/drawers only: `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.48)` — dark, not colored.
- Never on cards or buttons.

---

## 6. Shapes

### Radius Usage

| Token    | Value   | Applied to |
|----------|---------|------------|
| `sm`     | 6px     | Status pills (alternative), small badges, code fence corners |
| `md`     | 8px     | Buttons, input fields, small cards, toolbar buttons |
| `lg`     | 12px    | Chat bubbles (main), deal/briefing cards, document chrome, modals |
| `xl`     | 16px    | Full-screen modals, large sheets (mobile bottom drawer) |
| `full`   | 9999px  | Status pills (default), check-in chips, notification badges, avatar |

**Chat bubble radius specifics:**
- ARIA bubble: `12px 12px 12px 4px` (flat on bottom-left — "tail" direction toward ARIA)
- User bubble: `12px 12px 4px 12px` (flat on bottom-right — "tail" direction toward user)
- Consecutive bubbles from same sender drop the tail: all corners `12px` except the "tail" corner which becomes `4px` on the last message in a sequence only.

**Never mix radius values** within the same component (e.g. a card with `12px` top and `0` bottom is only acceptable when the card is flush with a containing surface — e.g. a modal that opens from the bottom edge).

---

## 7. Components

### 7.1 Chat Bubbles

**ARIA bubble:**
- Background: `#141A2E` (surface)
- Left border accent: `2px solid #14B8A6` — signals "this is ARIA speaking"
- Text: `#E2E8F0`, 15px, weight 400, line-height 1.65
- Padding: `12px 16px` (12px top/bottom, 16px left without accent bar / 18px left accounting for 2px bar + 16px content padding)
- Radius: `12px 12px 12px 4px`
- Max-width: `80%` of chat column
- Typing indicator: three dots `#14B8A6`, animated at `600ms` ease-in-out, reduced-motion: static ellipsis

**User bubble:**
- Background: `#1C2440` (surfaceRaised)
- No accent bar
- Text: `#E2E8F0`, 15px, weight 400
- Padding: `12px 16px`
- Radius: `12px 12px 4px 12px`
- Aligned right
- Max-width: `80%` of chat column

**Timestamp:** `#94A3B8`, 12px, weight 400, appears below bubble on hover or on last message of a sequence. Never inline within the bubble.

**Copy-message button:** ghost icon button (Lucide `Copy`), appears on bubble hover at top-right, `#94A3B8` icon, hover `#E2E8F0`. 32x32px touch target.

**Stop generation button:** Appears in input bar during streaming. Lucide `Square` icon, `#F87171` color, labeled "Stop" — 44px minimum touch target.

---

### 7.2 Deal Cards & Briefing Cards

**Deal card:**
```
┌─────────────────────────────────────────────────────┐  border: 1px solid #2A3350
│  [Client name]  [status pill]            [3 days]   │  bg: #141A2E, radius: 12px
│  [Deal name]                                        │  padding: 16px
│  [Risk flags row — icon + label]                    │
│  [Next action — italic, textMuted]                  │
└─────────────────────────────────────────────────────┘
```

- Client name: 15px, 600 weight, `#E2E8F0`
- Deal name: 14px, 400, `#94A3B8`
- Days since movement: 12px, `#94A3B8`, right-aligned
- Risk flag: Lucide `AlertTriangle` icon (`#F87171` for HIGH, `#FBBF24` for MEDIUM) + label in same color, 13px, 500. Icon is **required** — never color-only.
- Next action: 13px, 400, italic, `#94A3B8`
- Hover state: border changes to `1px solid #14B8A6`, transition `150ms ease`
- `cursor-pointer` required

**Briefing card (today's priority item):**
- Same base as deal card
- Accent left border: `3px solid #F59E0B` when item is urgency-ranked first, `3px solid #14B8A6` otherwise
- Priority number badge: `#F59E0B` (amber) 12px bold in a `20px × 20px` circle, `full` radius, top-left corner of card

---

### 7.3 Status Pills

Radius: `full` (9999px). Padding: `2px 10px`. Font: 12px, weight 500. Always accompanied by a short text label — never icon-only at this size.

| State    | Background             | Text        |
|----------|------------------------|-------------|
| Active   | `#14B8A6` at 15% alpha | `#14B8A6`   |
| Draft    | `#94A3B8` at 15% alpha | `#94A3B8`   |
| Stale    | `#F59E0B` at 15% alpha | `#F59E0B`   |
| Sent     | `#34D399` at 15% alpha | `#34D399`   |
| Danger   | `#F87171` at 15% alpha | `#F87171`   |
| Closed   | `#2A3350`              | `#94A3B8`   |

Implementation: use CSS `rgba()` or Tailwind `/15` opacity modifier for backgrounds.

---

### 7.4 Buttons

**Primary button** (standard confirmative action):
- bg `#14B8A6` → hover `#0D9488`
- text `#0A0E27`, 15px, weight 600
- radius 8px, height 40px, padding `0 20px`
- Focus ring: `box-shadow: 0 0 0 2px rgba(20,184,166,0.40)`
- Disabled: `opacity: 0.40`, `cursor: not-allowed`
- Loading: left spinner (Lucide `Loader2`, animate-spin 700ms), button disabled during async

**Secondary button** (alternative / cancel):
- bg `#1C2440` → hover `#2A3350`
- border `1px solid #2A3350`
- text `#E2E8F0`, weight 500
- Same radius/height as primary

**Ghost button** (low-emphasis):
- bg transparent → hover `#141A2E`
- text `#94A3B8` → hover `#E2E8F0`
- No border at rest
- Same radius/height

**Accent/CTA button** (urgency-level action — use sparingly):
- bg `#F59E0B` → hover `#D97706`
- text `#0A0E27`, weight 600
- Use only for: primary briefing actions, "Act on this deal" prompts
- Never use for generic "Send" or "Submit" in chat

**Icon button** (toolbar, action row):
- 32×32px minimum for desktop, 44×44px on mobile
- bg transparent → hover `#141A2E`
- icon color `#94A3B8` → hover `#E2E8F0`
- radius 8px
- `aria-label` required — never icon-only without accessible label

---

### 7.5 Input Bar (Chat)

```
┌────────────────────────────────────────────┬──────────┐
│ [Attach 📎]  Type a message...             │  [Send]  │
└────────────────────────────────────────────┴──────────┘
```

- Outer container: `#141A2E`, `1px solid #2A3350`, radius `12px`, padding `8px 8px 8px 12px`
- Focus state: border `1px solid #14B8A6` + `box-shadow: 0 0 0 2px rgba(20,184,166,0.20)`
- Textarea: auto-grow from 1 line to max 5 lines, then scroll. Font: 15px, `#E2E8F0`, placeholder `#94A3B8`.
- Attach button (image upload for FR-9 vision): Lucide `Paperclip`, ghost icon button, `#94A3B8`, left of textarea.
- Send button: primary button (teal), right side, 36×36px, `aria-label="Send message"`. Disabled + spinner when AI is generating.
- Image preview chip: appears above the textarea after attach. Thumbnail (40×40px, radius 8px) + Lucide `X` to remove. Border `1px solid #2A3350`.
- "Start new topic" button: ghost, above input bar, `#94A3B8`, 13px — only shown after a conversation has content.

---

### 7.6 Document Viewer Chrome

- Header bar (48px): `#0A0E27` bg, `1px solid #2A3350` bottom border. Contains: doc title (15px, 600, `#E2E8F0`), status pill, linked deal chip (ghost secondary, 12px), and right-aligned action group: `[Edit] [Export PDF] [Change status ▾] [History]`
- Content area: `#0A0E27` bg, `max-width: 720px` centered, `padding: 32px`. Font: 15px/1.65, `#E2E8F0`. H1/H2/H3 follow type scale; `hr` is `1px solid #2A3350`.
- Version history panel (drawer, right): `#141A2E`, `1px solid #2A3350` left border, 280px wide. Each version: date, version number, actor badge (AI / User), click to preview.
- Status lifecycle pill in header reflects: `draft` → `review` → `sent` → `signed` / `archived`. Color per status pill rules (§7.3).

---

### 7.7 Check-In Quick-Reply Chips

Rendered as a horizontal scrollable row below an ARIA check-in message.

- Each chip: `#1C2440` bg, `1px solid #2A3350` border, `#E2E8F0` text, 14px weight 500, radius `9999px`, padding `8px 16px`, height `36px`
- Hover: border → `1px solid #14B8A6`, bg → `#2A3350`, transition `150ms`
- Selected: bg `#14B8A6` at 15%, border `1px solid #14B8A6`, text `#14B8A6`
- After selection: all chips disabled (`opacity: 0.5`, `cursor: not-allowed`), selected chip stays highlighted
- Touch target: natural from padding + height; minimum 44px on mobile — if chip height is < 44px at mobile, add `min-height: 44px` and center text vertically

---

### 7.8 Degraded-AI Banner

Shown when the Claude API is unavailable (FR-5). Appears at the top of the main panel, above the chat/briefing area.

- bg: `rgba(245, 158, 11, 0.12)` (amber at 12% alpha)
- border: `1px solid rgba(245, 158, 11, 0.40)`
- text: `#FBBF24`, 13px, weight 500
- Left icon: Lucide `AlertTriangle` in `#F59E0B` — **required, not optional** (color is not the sole indicator)
- Message: `"AI synthesis is temporarily unavailable — showing raw data."`
- Dismiss X (ghost): right side
- radius: 8px, margin: `8px 16px`, padding `10px 16px`
- **Never hide this when it's active.** The user must always know the AI layer is degraded.

---

## 8. Do's and Don'ts

### Dark-Mode Specifics

| Do | Don't |
|----|-------|
| Use surface lightness to convey elevation (`#0A0E27` → `#141A2E` → `#1C2440`) | Use dark box-shadows to separate layers — they vanish on dark backgrounds |
| Use `1px solid #2A3350` borders on all Layer 1 surfaces | Float borderless cards on `bg` — the contrast delta alone is insufficient at low brightness |
| Use `rgba` tinted backgrounds for status colors (e.g. `#F87171/15`) | Use full-saturation color blocks for status backgrounds — they destroy the calm atmosphere |
| Reserve the teal glow (`rgba(20,184,166,0.30)`) for focus rings only | Apply teal glow to headings, cards, or decorative elements |
| Use amber strictly for urgency/attention | Use amber as a general "primary" or "brand" color — it reads as "warning" and should mean it |

### Visual Quality

| Do | Don't |
|----|-------|
| Use SVG icons from Lucide or Heroicons (consistent 24px viewBox) | Use emojis as UI icons |
| Pair every risk/status color with an icon + text label | Rely on color alone to convey status |
| Test UI with Vietnamese text — diacritics in Plus Jakarta Sans | Substitute Poppins or Inter and assume Vietnamese will render correctly |
| Use `transition-colors duration-150` on interactive elements | Apply `scale` transforms on hover — they cause layout shift |
| Use `cursor-pointer` on all cards, buttons, and chips | Leave default cursor on interactive elements |
| Verify contrast: muted text (`#94A3B8`) meets 4.5:1 only on `bg` — check placement | Place `textMuted` on `surfaceRaised` for important labels (contrast may fall below 4.5:1) |

### Interaction

| Do | Don't |
|----|-------|
| Disable the Send button + show spinner while AI is generating | Allow double-sends or unresponsive buttons during async operations |
| Show the typing indicator immediately after user sends | Jump straight to the AI response without feedback |
| Provide "Stop generation" affordance (FR-33) | Let the user wait with no escape |
| Show the degraded-AI banner prominently and persistently when the API is down | Hide the degraded state or return a blank response |
| Use `prefers-reduced-motion` to disable/reduce animations | Force animation on users who have opted out |

### Layout & Spacing

| Do | Don't |
|----|-------|
| Use the 4px grid consistently — all spacing multiples of 4 | Use arbitrary values (e.g. 7px, 11px, 17px) |
| Set `max-width: 760px` on the chat column | Allow chat to span full ultrawide width — line length becomes unreadable |
| Ensure fixed headers account for their own height so content isn't hidden beneath them | Let content scroll under a fixed input bar without accounting for the overlap |
| Collapse sidebar to icon rail at tablet, hide at mobile | Force a full sidebar on mobile |

### Typography

| Do | Don't |
|----|-------|
| Use Plus Jakarta Sans for all text including Vietnamese content | Substitute any other font without verifying full Vietnamese diacritic coverage |
| Set body line-height `1.65` for Vietnamese prose (extra interline space aids diacritic legibility) | Use `1.4` or tighter for Vietnamese body text |
| Use JetBrains Mono for all code, inline `code`, and structured data dumps | Mix monospace fonts or use Plus Jakarta Sans for code |
| Render markdown correctly in AI responses (headings, bullets, tables, code blocks) | Display raw markdown symbols (`**bold**`) in the chat |

### Brand & Identity

| Do | Don't |
|----|-------|
| Use the dawn-arc mark in `#14B8A6` only | Recolor the mark to amber or any other palette color |
| Use the wordmark in Plus Jakarta Sans SemiBold, all-caps, letter-spaced | Render the wordmark in any other font or weight |
| Keep the brand calm — the darkness is intentional and reassuring | Add gradient backgrounds, animated glows, or neon effects to "make it pop" |
| Treat the morning briefing as the emotional peak of the UX — it deserves the most care | Treat the briefing as just another list view |

---

## 9. Accessibility Summary

- All text ≥ 4.5:1 contrast (AA). Primary text achieves AAA (12.6:1 on bg).
- `textMuted` meets AA (5.3:1 on bg) — use only for secondary/supplementary labels, never for primary content.
- `primary` (#14B8A6) on `surface` (#141A2E) achieves 4.1:1 — use only for interactive affordance labels at ≥14px bold, icons, and borders. Do not use as standalone body text.
- Focus rings: `box-shadow: 0 0 0 2px rgba(20,184,166,0.40)` on all interactive elements. Never `outline: none` without a replacement focus indicator.
- All icon buttons carry `aria-label`.
- All form inputs carry `<label>` associations.
- All status, risk, and urgency signals pair color with icon + text.
- `prefers-reduced-motion` check: chat typing indicator, skeleton loaders, and transition animations all respect `@media (prefers-reduced-motion: reduce)`.
- Touch targets: minimum 44×44px on all mobile interactive elements.
- Tab order follows visual DOM order; no focus traps outside modals.
