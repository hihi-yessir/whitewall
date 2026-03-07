<div align="center">

<img src="assets/banner.svg" alt="whitewall" width="100%" />


# whitewall

**The wall that lets you through.**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![SDK](https://img.shields.io/npm/v/@whitewall-os/sdk?style=for-the-badge&label=SDK)](https://www.npmjs.com/package/@whitewall-os/sdk)

> Part of [**Whitewall OS**](https://github.com/hihi-yessir/Verified-Agent-Hub) — on-chain identity and access control for AI agents.

</div>

---

Demo app for the Whitewall OS verification flow. Walk through agent registration, World ID bonding, Stripe KYC, Plaid credit scoring, and tier-gated resource access — all wired to live contracts on Base Sepolia.

---

## User Flow

```mermaid
graph TD
    subgraph Register["1. Register"]
        style Register fill:#1a1a2e,stroke:#6C63FF,color:#fff
        R[Mint ERC-8004 agent NFT]
    end

    subgraph Bond["2. Bond"]
        style Bond fill:#1a1a2e,stroke:#00FF41,color:#fff
        W[World ID ZK proof]
        W --> T2[Tier 2 unlocked]
    end

    subgraph KYC["3. KYC"]
        style KYC fill:#1a1a2e,stroke:#FF9F1C,color:#fff
        S[Stripe Identity session]
        S --> CRE1[CRE Workflow → on-chain]
        CRE1 --> T3[Tier 3 unlocked]
    end

    subgraph Credit["4. Credit"]
        style Credit fill:#1a1a2e,stroke:#E63946,color:#fff
        P[Plaid Link → balance data]
        P --> CRE2[CRE Workflow → SGX TEE → on-chain]
        CRE2 --> T4[Tier 4 unlocked]
    end

    subgraph Access["5. Access"]
        style Access fill:#0d1b2a,stroke:#375BD2,color:#fff
        REQ[Request resource via x402]
        REQ --> ACE[ACE pipeline evaluates tier]
        ACE --> RES[Resource granted or denied]
    end

    R --> W
    T2 --> S
    T3 --> P
    T4 --> REQ
```

---

## Pages

| Route | What it does |
|:------|:-------------|
| `/` | Landing — architecture visualization |
| `/tryout` | Full verification flow (register → bond → KYC → credit) |
| `/demo` | Architecture demo view |
| `/feed` | Live contract state viewer |

---

## SDK Usage

The app uses [`@whitewall-os/sdk`](https://www.npmjs.com/package/@whitewall-os/sdk) to read on-chain state:

```typescript
import { WhitewallOS } from "@whitewall-os/sdk";

const wos = new WhitewallOS({ publicClient, chain: "baseSepolia" });

// Check agent verification status
const status = await wos.getFullStatus(agentId);
// → { isRegistered, isHumanVerified, isKYCVerified, creditScore, tier }
```

---

## Setup

```bash
# Install
npm install

# Dev server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

Create `.env.local`:
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_WORLD_APP_ID=...
NEXT_PUBLIC_WORLD_ACTION=...
```

---

## Project Structure

```
whitewall/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing
│   │   ├── tryout/            # Verification flow
│   │   ├── demo/              # Architecture viz
│   │   ├── feed/              # Live state viewer
│   │   └── api/               # API routes
│   ├── components/            # React components
│   └── lib/                   # SDK integration, utils
├── public/                    # Static assets
├── docs/                      # Additional docs
└── test-agent/                # Test agent scripts
```

---

## Related Repos

| Repository | Role |
|:-----------|:-----|
| [**Verified-Agent-Hub**](https://github.com/hihi-yessir/Verified-Agent-Hub) | Smart contracts, ACE policies, validators, SDK |
| [**whitewall-cre**](https://github.com/hihi-yessir/whitewall-cre) | CRE workflows (access, KYC, credit) |
| [**x402-auth-gateway**](https://github.com/hihi-yessir/x402-auth-gateway) | Payment-gated proxy |
