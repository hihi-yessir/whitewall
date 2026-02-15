# Demo Page Changes — What Was Modified

> Written for the frontend agent working on `WhitewallLanding.tsx` and the broader whitewall app.
> These changes add a `/demo` route without breaking the existing landing page.

---

## Summary

A `/demo` page was added for the Chainlink hackathon presentation. It tells the story:
"AI agents pay $0.50 via x402 to generate deepfakes. Nobody knows who ordered it. Whitewall fixes this."

The demo has 4 acts (3 simulated scenarios + 1 live on-chain "Try It" flow) with an animated pipeline visualizer and live terminal.

---

## Files Modified (existing)

### `WhitewallLanding.tsx`
- **Imports changed:** Theme system (`themes`, `ThemeCtx`, `ThemeToggle`, `Btn`, `NavLink`, `CodeViewer`) now imported from `./shared/theme` instead of being defined inline.
- **Hooks extracted:** `useIsMobile` and `useReveal` now imported from `./shared/hooks`.
- **MeshBG extracted:** The Three.js mesh background component now imported from `./shared/MeshBG`. The original ~250-line function body is still in the file as `_MeshBG_REFERENCE_DEAD_CODE()` (dead code, not called). Feel free to delete it.
- **No visual changes.** The landing page renders identically.

### `tsconfig.json`
- `target` changed from `"ES2017"` to `"ES2020"` — required for BigInt literal syntax (`2000000n`) used by viem/blockchain code.

### `next.config.ts`
- Added `transpilePackages: ["@worldcoin/idkit"]` — needed for the World ID widget to compile under Turbopack.

### `package.json`
- Added dependencies: `viem` (blockchain client) and `@worldcoin/idkit` (World ID verification widget).

---

## Files Created (new)

### Shared modules (extracted from WhitewallLanding.tsx)

| File | What it exports | Notes |
|------|----------------|-------|
| `src/components/shared/theme.tsx` | `themes`, `ThemeCtx`, `ThemeToggle`, `Btn`, `NavLink`, `CodeViewer`, types (`ThemeMode`, `Theme`, `ThemeContextValue`) | Btn gained `onClick`, `disabled`, `style` props. Everything else identical to what was in WhitewallLanding. |
| `src/components/shared/hooks.ts` | `useIsMobile`, `useReveal` | Identical to WhitewallLanding originals. |
| `src/components/shared/MeshBG.tsx` | `MeshBG` | Identical Three.js mesh background, just in its own file. Used by both landing page and demo page. |

### Demo components

| File | Purpose |
|------|---------|
| `src/components/demo/types.ts` | All TypeScript types + `useReducer` state management (`DemoState`, `PipelineStepState`, `TerminalEntry`, `demoReducer`, `initialDemoState`) |
| `src/components/demo/DemoPage.tsx` | Root orchestrator. Manages state, SSE lifecycle, keyboard shortcuts, layout. Renders MeshBG + edge fade + nav + control panel + pipeline + terminal. |
| `src/components/demo/DemoNav.tsx` | Top navigation bar: back arrow + Whitewall logo, 4 act tabs, theme toggle. Sticky, frosted glass, matches landing page nav style. |
| `src/components/demo/ControlPanel.tsx` | Left sidebar (desktop) or horizontal scroll (mobile). 3 scenario buttons + "Try It Yourself" button. |
| `src/components/demo/PipelineViz.tsx` | Horizontal row of 11 pipeline step nodes connected by SVG lines. Nodes animate through idle → active (pulse) → pass (green) / fail (red). |
| `src/components/demo/PipelineStep.tsx` | Single pipeline node. Shows status icon, label, detail text, timing. Blue glow animation when active. |
| `src/components/demo/LiveTerminal.tsx` | Bottom panel: scrolling log with color-coded entries ([x402], [CRE], [GATE 1], etc). Auto-scrolls to bottom. |
| `src/components/demo/TryItFlow.tsx` | Act 4 wizard: Connect Wallet → Register Agent → Approve Validator → Verify with World ID → Request Access. Uses raw viem + window.ethereum (no wagmi). Lazy-loaded via `next/dynamic` to avoid blocking Acts 1-3 compile. |
| `src/components/demo/ResultCard.tsx` | AccessGranted (green border, checkmark) or AccessDenied (red border, X) result display with accountable human address and tier. |

### SDK (copied from `/sdk/src/`)

| File | Notes |
|------|-------|
| `src/lib/whitewall-os/client.ts` | WhitewallOS class — `connect()`, `getAgentStatus()`, `isRegistered()`, `isHumanVerified()`, etc. Imports changed from `.js` to no extension. |
| `src/lib/whitewall-os/abis.ts` | Contract ABIs. Added `worldIdValidatorAbi` (for `verifyAndSetHumanTag`) and `identityRegistryAbi` entries for `register()` and `approve()` — needed by TryItFlow. |
| `src/lib/whitewall-os/addresses.ts` | Chain addresses (Base Sepolia). Identical to SDK. |
| `src/lib/whitewall-os/types.ts` | `AgentStatus`, `AccessGrantedEvent`, `ValidationSummary`. Identical to SDK. |

### Routes

| File | Purpose |
|------|---------|
| `src/app/demo/page.tsx` | Page wrapper: `dynamic(() => import("@/components/demo/DemoPage"), { ssr: false })` |
| `src/app/api/simulate/route.ts` | SSE endpoint. Accepts `?scenario=anon-bot|registered-bot|verified-agent` and `&mode=present`. Streams pipeline step updates with timing delays. **This is the mock layer** — will be replaced with real CRE triggers when ready. |

---

## Architecture Notes

### State flow
```
User clicks scenario button
  → DemoPage.runScenario()
  → fetch("/api/simulate?scenario=X") (SSE stream)
  → Parse events: step / terminal / result / skipAfter
  → dispatch() to useReducer → re-renders pipeline + terminal
```

### Z-index layers (same as landing page)
- 0: MeshBG (fixed canvas)
- 1: Edge fade overlay (fixed, pointer-events: none)
- 2: All content (relative)
- 20: Nav (sticky)

### What's simulated vs real
- **Simulated (Acts 1-3):** Pipeline timing, gate pass/fail outcomes, terminal messages. All from `/api/simulate/route.ts`.
- **Real on-chain (Act 4 "Try It"):** Wallet connection, agent registration (`IdentityRegistry.register()`), validator approval, World ID verification (`verifyAndSetHumanTag()`). These are actual Base Sepolia transactions.
- **When CRE is ready:** Replace the SSE endpoint internals with real CRE HTTP triggers. Frontend stays the same.

### Presentation mode
Add `?mode=present` to URL:
- Arrow keys navigate between acts
- Space bar re-runs current scenario
- Timing delays are 1.8x longer for dramatic effect
- Auto-runs scenario when switching acts

---

## Branding Compliance

All demo components follow `branding.md`:
- Same color tokens from shared theme
- Card border-radius: 14px
- Section labels: 12px, weight 700, letterSpacing 2, uppercase, blue
- Nav: frosted glass (`{bg}B0` + blur 12px), sticky, z-20
- Logo: 4px × 22px bars with opacity `logoDots`
- Cards: `{card}CC` + backdrop blur 8px
- Mesh background + edge fade: always present
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- Font: Inter, monospace for code/terminal
