# Whitewall Frontend Backlog

## Open

_No open items._

---

## Completed

- [x] Rotate `FAUCET_PRIVATE_KEY` on Vercel dashboard
- [x] Set `BASE_SEPOLIA_RPC_URL` on Vercel (private RPC)
- [x] Feed DB reset: admin endpoint + admin badge in FeedNav (deployer wallet gated, dropdown panel)
- [x] Demo diagram: TEE enclave badge on Gate 4 / Credit (dashed amber border + TEE label)
- [x] Live activity: horizontal timeline on feed page (registrations, verifications, KYC, credit)
- [x] Full mobile pass across all pages (layout, spacing, touch targets, scrolling)
- [x] Dead code cleanup (blob.ts, genapi.ts, /api/generate, /api/generate-video, MeshBG dead code, THREE import)
- [x] Footer links fixed (href="#" → real destinations)
- [x] LicensePlate: "REGIST" label, placeholder image, video playback fix, TEE Verified badge
- [x] TryoutFlow: localStorage persistence, Start Over icon, tier indicator fix, KYC/Credit polling, spinner animation, bootstrapping UX
- [x] TryoutFlow credit done: TEE attestation detail (score, dataHash)
- [x] Terminal: tx hashes are clickable BaseScan links
- [x] Feed: "Live Registry" header with pulsing dot
- [x] Feed: tier badges (T1-T4 color-coded), TEE micro-badge for T4, BaseScan tx links in detail
- [x] Feed: enhanced stats (TEE verified count, approval rate)
- [x] Per-page SEO metadata (all 4 pages)
- [x] Theme flicker fixed
- [x] SGX → TEE rename across codebase (hover tooltip: "Uses SGX quotes for efficiency")
- [x] FAUCET_PRIVATE_KEY updated in .env.local
- [x] Next.js 16 build fix: split `ssr: false` dynamic imports into client wrappers (all 4 pages)
- [x] Remove AI-looking emojis across codebase (replaced with clean typographic symbols)
- [x] Landing page: 3 entry-point CTAs (Live Demo, Get Your License, Agent Feed) replacing Memorandum
- [x] Cross-page navigation links (demo ↔ tryout ↔ feed)
