# Whitewall Repo Separation — Spec for Worker Agent

> This document explains why and how to decouple `whitewall/` from the `auth-os` monorepo.

---

## Background

**Whitewall** is the public-facing brand site and demo for Whitewall OS. It's a Next.js app that lives at `auth-os/whitewall/` during development, but is deployed independently:

- **Repo:** `hihi-yessir/whitewall` (GitHub, under `peachandaisy` account)
- **Deploy:** Vercel (`phenixnetjl-5223` account), pointed at the standalone repo
- **Domain:** https://whitewall-ten.vercel.app

The `auth-os/` monorepo is a separate codebase owned by a different team. Whitewall should not live inside it long-term.

---

## Problem

Right now, whitewall has a **copied** version of the TypeScript SDK inside `src/lib/whitewall-os/`:

```
whitewall/src/lib/whitewall-os/
├── client.ts      # Copied from sdk/src/client.ts (class renamed to WhitewallOS)
├── abis.ts        # Copied from sdk/src/abis.ts (with extra ABIs for demo)
├── addresses.ts   # Copied from sdk/src/addresses.ts
└── types.ts       # Copied from sdk/src/types.ts
```

This creates sync issues:
- SDK changes in `auth-os/sdk/` don't propagate to whitewall
- Whitewall has extra ABIs (for `register()`, `approve()`, `verifyAndSetHumanTag()`) that the SDK doesn't export
- Two sources of truth for the same code

---

## Solution: Publish `@whitewall-os/sdk` to npm

### What the worker needs to do (auth-os side)

**1. Publish the TypeScript SDK as an npm package**

The SDK at `auth-os/sdk/` should be published as `@whitewall-os/sdk` to npm. It already has a clean structure:

```
sdk/
├── src/
│   ├── index.ts       # Exports WhitewallOS class + types
│   ├── client.ts      # WhitewallOS class
│   ├── types.ts       # AgentStatus, ValidationSummary, etc.
│   ├── addresses.ts   # Chain addresses
│   └── abis.ts        # Contract ABIs
├── package.json
└── tsconfig.json
```

Requirements for the published package:
- Export everything whitewall currently imports: `WhitewallOS`, `AgentStatus`, `ValidationSummary`, `AccessGrantedEvent`, chain addresses, ABIs
- **Also export the raw ABIs** — whitewall's demo flow (`TryItFlow.tsx`) needs `identityRegistryAbi`, `worldIdValidatorAbi`, and `humanVerifiedPolicyAbi` directly for write transactions (`register()`, `approve()`, `verifyAndSetHumanTag()`)
- The current SDK only exports read methods via the `WhitewallOS` class. The ABIs for write operations need to be exported too, or whitewall will still need local copies.

**2. Remove `whitewall/` from auth-os**

Once whitewall is fully standalone and consuming the SDK via npm, delete the `whitewall/` directory from the auth-os repo. It shouldn't exist in both places.

---

### What the whitewall team will do (our side)

Once `@whitewall-os/sdk` is published:

1. `npm install @whitewall-os/sdk` in the whitewall repo
2. Replace all `src/lib/whitewall-os/` imports with `@whitewall-os/sdk`
3. Delete `src/lib/whitewall-os/` entirely
4. Verify build and deploy

---

## ABI Export Checklist

These are the ABIs whitewall currently uses (from `src/lib/whitewall-os/abis.ts`):

| ABI | Used by | For |
|-----|---------|-----|
| `identityRegistryAbi` | TryItFlow.tsx | `register()`, `approve()`, `ownerOf()` |
| `worldIdValidatorAbi` | TryItFlow.tsx | `verifyAndSetHumanTag()` |
| `humanVerifiedPolicyAbi` | client.ts | `requiredTier()`, `identityRegistry()`, etc. |
| `validationRegistryAbi` | client.ts | `getSummary()` |
| `whitewallConsumerAbi` | (event watching) | `AccessGranted`, `AccessDenied` events |

All of these should be exported from `@whitewall-os/sdk` so whitewall doesn't need local copies.

---

## Timeline

This is not urgent — whitewall works fine with the local copies for now. But this should be done before:
- Any SDK contract address changes
- Any ABI changes from contract upgrades
- Bringing on more frontend contributors

---

## Current State (as of Feb 15 2026)

### What exists

| Location | State |
|----------|-------|
| **`hihi-yessir/whitewall`** (GitHub) | Exists. Has 1 commit on `main`: `2e0c7e8 init: whitewall landing page` — landing page only, no demo. |
| **`whitewall-os/whitewall/`** (local) | Has all latest code (landing page + full demo flow + branding updates) but **no `.git`** — the previous `.git` was lost during the repo rename from `auth-os` to `whitewall-os`. |
| **Vercel** (`phenixnetjl-5223`) | Deployed from `hihi-yessir/whitewall` — currently showing old landing page only. |

### What the `.git` was

The whitewall subfolder previously had its own `.git` directory pointing at `hihi-yessir/whitewall` as `origin`. This allowed it to be developed inside the monorepo but pushed independently. That `.git` is now gone.

### What needs to happen

1. **Clone** `hihi-yessir/whitewall` somewhere clean (e.g. `~/github/whitewall/`)
2. **Copy** all files from `whitewall-os/whitewall/` into the clone (overwriting the old landing page)
3. **Exclude**: `node_modules/`, `.next/`, `whitewall_sample/`
4. **Create a branch** (e.g. `feat/demo-flow`)
5. **Commit** with author `peachandaisy <peachandaisy@users.noreply.github.com>` — no other authors
6. **Push** and create a PR against `main`
7. After merge, point Vercel to rebuild

### Files changed since last push

**Modified (from initial landing page):**
- `branding.md` — new tagline, descriptor, WHITEWALL OS naming
- `next.config.ts` — added `transpilePackages: ["@worldcoin/idkit"]`
- `package.json` / `package-lock.json` — added `viem`, `@worldcoin/idkit`
- `src/app/layout.tsx` — updated metadata title/description
- `src/components/WhitewallLanding.tsx` — new hero tagline, pipeline text, footer, shared imports
- `tsconfig.json` — target ES2020, exclude whitewall_sample

**New files (demo flow):**
- `src/app/demo/page.tsx` — demo route
- `src/app/api/simulate/route.ts` — SSE endpoint for scenario simulation
- `src/components/demo/*` — DemoPage, DemoNav, ControlPanel, TryItFlow, PipelineViz, PipelineStep, LiveTerminal, ResultCard, types
- `src/components/shared/*` — theme.tsx, hooks.ts, MeshBG.tsx (extracted from landing page)
- `src/lib/whitewall-os/*` — client.ts, abis.ts, addresses.ts, types.ts (SDK copy)
- `eslint.config.mjs`, `postcss.config.mjs`

**Docs (can include or exclude from FE repo):**
- `DEMO_CHANGES.md` — changelog for the demo work
- `REPO_SEPARATION.md` — this file

---

## Identity Note

**Important:** The `hihi-yessir/whitewall` repo and all its commits must be under the `peachandaisy` GitHub account only. No other contributors or commit authors should appear in the repo history.
