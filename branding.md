# Whitewall — Branding & Design Guide

> Reference document for maintaining visual consistency across all Whitewall surfaces (landing page, demo page, docs, etc.)

---

## 1. Brand Identity

### Name
**WHITEWALL** — the product. Always uppercase in display, capitalized in prose.
**WHITEWALL OS** — the underlying protocol/SDK layer. Used in code (`WhitewallOS`), package names (`@whitewall-os/sdk`), and developer-facing contexts.

### Tagline
*"A billion agents. Every one accountable."*

### Descriptor
*"License plates for the agentic economy."*

### Origin
Inspired by Cyberpunk 2077's "Blackwall" (a firewall separating rogue AIs from the net), flipped to represent a **whitehat** trust barrier — it blocks malicious agents but lets verified ones pass through.

### Analogy
Like license plates for cars or HTTPS for websites — Whitewall provides the missing identity layer for the agentic economy. Every agent gets a verifiable on-chain identity tied to an accountable human.

### Voice & Tone
- **Confident, not aggressive.** We state facts, not hype.
- **Technical but accessible.** We respect the reader's intelligence without gatekeeping.
- **Terse headlines, clear body copy.** Headlines are UPPERCASE, punchy, often incomplete sentences ending with a blue period. Body copy explains calmly.
- **No emojis in UI** (except problem card icons: 👤 🔄 ⚠).

### Core Message
> A billion agents. Every one accountable.

Three CTA axes:
| CTA | Purpose | Target |
|---|---|---|
| **Read the Memorandum** | Problem awareness / manifesto | `/memorandum` or external link |
| **Try Demo** | Hands-on verification experience | `/demo` |
| **GitHub** | Source code / contribution | GitHub repo URL |

---

## 2. Color System

### Primary Palette

| Token | Dark Mode | Light Mode | Usage |
|---|---|---|---|
| `bg` | `#0A0A0A` | `#FAFAFA` | Page background |
| `card` | `#141414` | `#FFFFFF` | Card surfaces |
| `cardBorder` | `#222222` | `#E0E0E0` | Borders, dividers |
| `ink` | `#EEEEEE` | `#111111` | Primary text |
| `inkMuted` | `#666666` | `#999999` | Secondary text, labels |

### Accent Colors (same in both themes)

| Token | Value | Usage |
|---|---|---|
| `blue` | `#375BD2` | Primary accent — CTAs, links, highlights, scrollbar, the blue period |
| `blueDark` | `#2A47A8` | Hover state for primary buttons (unused currently, reserved) |
| `blueLight` | `#5B7BF0` | Hover state for primary buttons |
| `red` | `#D94040` | Blocked agents, code keywords, terminal dot |
| `green` | `#2EAD6B` | Verified agents, code strings, terminal dot |

### Code Block Colors

| Token | Dark Mode | Light Mode | Usage |
|---|---|---|---|
| `codeBg` | `#0D0D0D` | `#F0F0F0` | Code block background |
| `codeHeader` | `#1A1A1A` | `#E8E8E8` | Code tab bar and terminal header |

### Semantic Code Highlighting

| Role | Mapped to |
|---|---|
| Keyword (`import`, `if`, `contract`) | `red` — `#D94040` |
| String literals | `green` — `#2EAD6B` |
| Blue highlights (identifiers, config keys) | `blue` — `#375BD2` |
| Comments | `inkMuted` |
| Default code | `ink` |

### Opacity Conventions
- Cards over mesh: `{card}CC` (80% opacity) + `backdrop-filter: blur(8px)`
- Content wrapper over mesh: `{bg}D0` (81% opacity) + `backdrop-filter: blur(4px)`
- Nav bar: `{bg}B0` (69% opacity) + `backdrop-filter: blur(12px)`
- Mobile menu: `{bg}F2` (95% opacity) + `backdrop-filter: blur(12px)`
- Divider lines: `{cardBorder}60` (38% opacity)
- Nav border: `{cardBorder}40` (25% opacity)
- Powered By tech names: `opacity: 0.3`

---

## 3. Typography

### Font Stack
```
'Inter', system-ui, -apple-system, sans-serif
```
Inter is the primary UI font. The landing page loads it inline — the Next.js layout also loads **Geist Sans** and **Geist Mono** as CSS variables (`--font-geist-sans`, `--font-geist-mono`) for potential use in other pages.

### Code Font Stack
```
'SF Mono', 'Fira Code', monospace
```

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Weight | Tracking | Notes |
|---|---|---|---|---|---|
| Hero H1 | 72px | 42px | 900 | -3px / -1.5px | UPPERCASE, line-height: 0.98 |
| Section H2 | 48px | 32px | 900 | -2px | UPPERCASE, line-height: 1.05 |
| Card H3 | 20px | 20px | 800 | -0.5px | Sentence case |
| Pipeline H3 | 18px | 18px | 800 | -0.3px | Sentence case |
| Body (hero) | 17px | 14px | 400 | — | line-height: 1.7 |
| Body (section) | 17px | 15px | 400 | — | line-height: 1.7 |
| Card body | 14px | 14px | 400 | — | line-height: 1.65 |
| Pipeline body | 13px | 13px | 400 | — | line-height: 1.6 |
| Section label | 12px | 12px | 700 | 2px | UPPERCASE, color: blue |
| Pipeline step | 11px | 11px | 800 | 1.5px | UPPERCASE, color: blue, opacity: 0.7 |
| Card number | 11px | 11px | 700 | 1px | color: inkMuted |
| Nav brand | 20px | 16px | 900 | 1px | UPPERCASE |
| Nav link | 14px | — | 600 | — | — |
| Button | 15px | 13px | 700 | — | — |
| Code | 13px | 12px | — | — | Monospace |
| SDK tab | 12px | 11px | 700 | 0.5px | Level label: 11px/9px, opacity 0.5 |
| Footer copyright | 11px | 11px | — | — | opacity: 0.35 |
| Powered By label | 12px | 10px | 500 | — | — |
| Powered By names | 12px | 9px | 800 | 0.5px | UPPERCASE, opacity: 0.3 |

### The Blue Period
Headlines end with a blue-colored period:
```jsx
<span style={{ color: "#375BD2" }}>.</span>
```
This is a core brand element — use it consistently on section headlines.

---

## 4. Spacing & Layout

### Container
- Max width: **1320px**, centered with `margin: 0 auto`
- Desktop padding: **48px** horizontal
- Mobile padding: **20px** horizontal

### Section Spacing
| | Desktop | Mobile |
|---|---|---|
| Section padding | `120px 48px` | `80px 20px` |
| Card grid gap | 20px | 20px |
| Pipeline grid gap | 1px (border-based) | 0 (border-based) |
| Divider between sections | 1px line, `{cardBorder}60` opacity |
| Section label → H2 | 16px top margin |
| H2 → body | 20px top margin |
| Body → grid | 56px top margin |

### Nav
- Desktop: `20px 40px` padding
- Mobile: `16px 20px` padding
- `position: sticky`, `top: 0`, `z-index: 20`
- Frosted glass: `background: {bg}B0` + `backdrop-filter: blur(12px)`

### Cards
- Border radius: **14px**
- Border: `1.5px solid {cardBorder}`
- Desktop padding: **32px**
- Mobile padding: **24px**
- Background: `{card}CC` + `backdrop-filter: blur(8px)`

---

## 5. Components

### Buttons (`Btn`)

Two variants:

**Primary** (filled):
- Background: `blue` → `blueLight` on hover
- Color: `#fff`
- Border: none
- Hover: `translateY(-1px)`

**Secondary** (outline):
- Background: transparent
- Border: `2px solid {cardBorder}` → `{ink}` on hover
- Color: `ink`

**Sizes:**
- Default: `14px 32px` padding, 15px font
- Small: `10px 20px` padding, 13px font (used on mobile)

All buttons: `border-radius: 8px`, `font-weight: 700`, `transition: all 0.2s`

Buttons with `href` render as `<a>` tags for proper navigation.

### Theme Toggle
- 36x36px, border-radius 8px
- Border: `1.5px solid {cardBorder}` → `{blue}` on hover
- Content: ☀ (dark mode) / ☾ (light mode)

### Logo
Three vertical bars (4px wide, 22px tall, 1px border-radius) with varying opacity:
- Dark: `[0.3, 0.6, 0.9]`
- Light: `[0.4, 0.6, 0.9]`

Color matches `ink` token. Followed by "WHITEWALL" wordmark.

### Section Labels
```
UPPERCASE • 12px • weight 700 • letter-spacing 2px • color: blue
```

### Hero Badge
```
UPPERCASE • 11px (9px mobile) • weight 700 • letter-spacing 1px • color: blue
border: 1.5px solid {blue} • border-radius: 20px • padding: 5px 14px
```

---

## 6. Animations

### Entrance Animation (`ha` class)
```css
@keyframes hi {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: none; }
}
.ha {
  opacity: 0;
  animation: hi 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```
Used on hero elements with staggered `animation-delay`:
- Badge: 0.2s
- H1 lines: 0.35s, 0.5s, 0.65s
- Body: 0.85s
- CTAs: 1s

### Scroll Reveal (`useReveal`)
Uses IntersectionObserver (threshold: 0.2 default, 0.3 for footer).
```
opacity: 0 → 1
transform: translateY(24px) → none  (headers)
transform: translateY(32px) → none  (cards)
transition: all 0.7-0.8s cubic-bezier(0.16, 1, 0.3, 1)
```
Cards use staggered delays: `0.2s + i * 0.12s` (problem), `0.3s + i * 0.1s` (pipeline).

### Easing
The standard easing curve is: `cubic-bezier(0.16, 1, 0.3, 1)` — a spring-like ease-out.

General UI transitions: `0.2s` linear/ease (buttons, hover states, theme transitions).
Theme color transitions: `0.4s`.

---

## 7. Three.js Mesh Background

The mesh is a core visual identity element — 6 wireframe plane layers rotated Y=PI/2, representing the Whitewall's verification gates.

### Setup
- Canvas: `position: fixed`, `inset: 0`, `z-index: 0`
- Camera: `PerspectiveCamera(40)` at `(8, 2, 45)` looking at `(4, 0, 0)` — shifted right so mesh occupies the right side of the screen
- Camera parallax: ±1.0 horizontal, ±0.6 vertical on mouse move

### Layers (6 total)
Each layer is a `PlaneGeometry(20, 20)` rotated 90° on Y. X-positions: `-4, -0.8, 2.5, 5.8, 9, 12`.
- White wireframe (dark mode) / black wireframe (light mode)
- Each has a blue (`#375BD2`) glow sub-layer at reduced opacity
- Vertices animate with sine/cosine deformation

### Agent Particles
- Spawn at x=-8, travel rightward
- Blue (`#375BD2`) → Green (`#2EAD6B`) when passing verification (x>13)
- Blocked agents turn Red (`#D94040`), shrink, and fade
- Each has a trailing line (18 segments)
- Max 90 agents, spawn every 0.2s
- 50% block chance per gate

### Edge Fade Overlay
```
position: fixed, inset: 0, z-index: 1, pointer-events: none
```
Horizontal: `{bg} 0% → {bg}88 15% → transparent 40% → transparent 85% → {bg} 100%`
Vertical: `{bg} 0% → transparent 15% → transparent 90% → {bg} 100%`

This creates a strong left-side fade (so mesh doesn't compete with text) and subtle top/bottom vignette.

---

## 8. Responsive Breakpoints

### Mobile: `< 768px`
Detected via `useIsMobile(768)` hook (client-side, `window.innerWidth`).

Key differences:
- Hamburger menu replaces nav links
- Fullscreen mobile menu overlay with large centered links
- Buttons use `small` variant (including footer)
- Font sizes reduce (see Type Scale)
- Grid layouts go to single column (`1fr`)
- Section padding: `80px 20px`
- Hero uses `100dvh` instead of `100vh` to account for mobile browser chrome
- Hero padding-top: `40px`
- Powered By items: smaller font (9-10px)
- SDK tabs: tighter padding, smaller fonts
- Footer social links: extra padding (8px 12px) for touch targets
- **Three.js optimizations**: pixelRatio capped at 1, antialiasing disabled, layer thickness reduced to 1, segment count halved, max agents 30 (vs 90), initial agents 8 (vs 22), dust particles 15 (vs 35)

### Desktop: `≥ 768px`
- Full nav bar with all links and CTAs
- 3-column grids for Problem and Pipeline sections
- Larger typography
- Section padding: `120px 48px`

---

## 9. Z-Index Layers

| Layer | Z-index | Element |
|---|---|---|
| Mesh canvas | 0 | `position: fixed` |
| Edge fade | 1 | `position: fixed` |
| Content wrapper | 2 | `position: relative` |
| Nav | 20 | `position: sticky` |
| Mobile menu | 100 | `position: fixed` |

---

## 10. Content Architecture

### Sections (in order)
1. **Nav** — Logo + links + CTAs (sticky, frosted glass)
2. **Hero** — Full viewport, left-aligned text, badge, headline, body, 3 CTAs. No cards.
3. **Problem** — "The Problem" — 3 cards (No Identity / Sybil Floods / No Trust Layer). Context: x402 payment protocol has no identity layer.
4. **Pipeline** — "The Pipeline" — 6 steps in 3×2 grid (G1-G4, DON, ACE). CRE 5-Gate architecture.
5. **SDK** — "The SDK" — 4-tab code viewer (Solidity dApp Level / TypeScript App Level / Go App Level / MCP Agent Level).
6. **Footer** — CTA headline + 3 buttons + Powered By bar + social links + copyright.

### Section Anchors
- `#problem`, `#pipeline`, `#sdk`
- Nav links map: Protocol → `#problem`, Pipeline → `#pipeline`, SDK → `#sdk`, Demo → `/demo`

### Powered By Technologies
`Chainlink CRE` · `Chainlink DON` · `Chainlink ACE` · `World ID` · `x402`

---

## 11. Design Principles

1. **Mesh is always present.** The wireframe mesh is part of the brand. It should be visible (subtly) behind all content, not confined to a hero section.
2. **Left text, right mesh.** Camera and layers are shifted right. Text lives on the left where the edge fade creates readable contrast.
3. **Semi-transparent layers.** Cards and content sections use alpha backgrounds + backdrop-filter blur, letting the mesh breathe through.
4. **Restraint in color.** The palette is essentially monochrome (near-black/white) with one accent color (Chainlink blue). Red and green appear only in semantic contexts (blocked/verified, code highlighting).
5. **Weight creates hierarchy.** We use extreme font weights (700-900) with tight tracking for headlines. Body copy stays at 400 weight.
6. **UPPERCASE for authority.** All headlines, labels, badges, and the wordmark are uppercase. Body copy and card descriptions are sentence case.

---

## 12. File Structure

```
whitewall/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Next.js root layout, metadata, fonts
│   │   ├── page.tsx         # Dynamic import wrapper (SSR disabled)
│   │   └── globals.css      # Tailwind import + scrollbar styles
│   └── components/
│       └── WhitewallLanding.tsx  # Full landing page (single file)
├── package.json             # next, react, react-dom, three
└── branding.md              # This file
```

### Dependencies
- `next` — Framework (v16, Turbopack)
- `react` / `react-dom` — UI
- `three` — Mesh background (raw WebGL, no R3F)

No other runtime dependencies. No framer-motion, no CSS-in-JS library, no animation library. All styling is inline React `style` objects.
