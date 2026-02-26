# Bonding Architecture: Stripe KYC + Plaid Credit → On-Chain

## Overview

Bonding은 에이전트의 신원(KYC)과 신용(Credit Score)을 검증하여 온체인에 기록하는 프로세스입니다.
핵심 원칙: **민감한 데이터(API 키, access_token)는 TEE 안에서만 존재**하고, 체인에는 `verified=true` 또는 `score=95` 같은 결과만 기록됩니다.

---

## Components

| Component | 역할 | 위치 |
|-----------|------|------|
| **Frontend** (`/bonding`) | Stripe/Plaid 모달 UI, 지갑 연결 | 브라우저 |
| **API Routes** (`/api/kyc`, `/api/plaid`, `/api/bonding/*`) | 토큰 교환, 검증 요청 생성 | Vercel (demo) / TEE (prod) |
| **Redis Queue** (`cre:queue:kyc`, `cre:queue:credit`) | CRE가 처리할 검증 요청 대기열 | Upstash Redis |
| **CRE (Confidential Runtime)** | 검증 수행 + 온체인 기록 | TEE Enclave |
| **On-Chain Validators** | `StripeKYCValidator`, `PlaidCreditValidator` | Base Sepolia |
| **TieredPolicy** | 모든 validator를 읽어 tier 0-4 결정 | Base Sepolia |

---

## Token Flow: 누가 뭘 보는가

| Token | Frontend | Server (TEE) | On-Chain |
|-------|----------|-------------|----------|
| Stripe `clientSecret` | O (브라우저 모달용) | O (생성) | X |
| Stripe `sessionId` | O (표시용) | O (검증용) | X |
| `STRIPE_SECRET_KEY` | **X (절대 안감)** | O (Stripe API 호출) | X |
| `verified=true` | O (결과 표시) | O (판단) | **O** `kycVerified[agentId]` |
| Plaid `public_token` | O (일회용) | O (교환용, 1회) | X |
| Plaid `access_token` | **X (절대 안감)** | O (TEE 안에서만) | X |
| `PLAID_SECRET` | **X (절대 안감)** | O (Plaid API 호출) | X |
| `score=95` | O (결과 표시) | O (판단) | **O** `creditScores[agentId]` |

**Confidential HTTP**: API 키와 access_token은 TEE enclave 안에 머문다.
체인에 도달하는 것은 오직 검증 결과(boolean/score)뿐이다.

---

## Full Flow: KYC + Credit (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as Frontend /bonding
    participant API as API Routes (TEE)
    participant R as Redis Queue
    participant CRE as CRE Worker (TEE)
    participant SC as On-Chain Validators

    Note over U,SC: === KYC Flow (Stripe Identity) ===

    U->>FE: Click "Start KYC"
    FE->>API: POST /api/kyc
    API->>API: Stripe API: create session<br/>(uses STRIPE_SECRET_KEY)
    API-->>FE: { sessionId, clientSecret }
    FE->>U: Open Stripe Identity Modal
    U->>FE: Complete verification (test: auto)
    FE->>API: GET /api/kyc?sessionId=vs_...
    API-->>FE: { status: "verified" }

    FE->>API: POST /api/bonding/validate<br/>{ type: "kyc", agentId, sessionId }
    API->>API: Re-verify with Stripe API
    API->>API: sessionHash = keccak256(sessionId)<br/>requestHash = keccak256(KYC + agentId + sessionHash)
    API->>R: Push to cre:queue:kyc
    API-->>FE: { requestHash, status: "pending_cre" }

    R->>CRE: Pop validation request
    CRE->>CRE: Verify session with Stripe API
    CRE->>SC: StripeKYCValidator.onReport()<br/>(agentId, verified=true, requestHash, sessionHash)
    SC->>SC: kycVerified[agentId] = true
    SC->>SC: ValidationRegistry.validationResponse()

    Note over U,SC: === Credit Flow (Plaid) ===

    U->>FE: Click "Connect Bank"
    FE->>API: POST /api/plaid { action: "create-link" }
    API->>API: Plaid API: link/token/create<br/>(uses PLAID_SECRET)
    API-->>FE: { linkToken }
    FE->>U: Open Plaid Link Modal
    U->>FE: user_good / pass_good / MFA 1234
    FE->>FE: onSuccess(publicToken)

    FE->>API: POST /api/bonding/validate<br/>{ type: "credit", agentId, publicToken }
    API->>API: Exchange publicToken → access_token<br/>(access_token stays in TEE!)
    API->>API: dataHash = keccak256(itemId)<br/>requestHash = keccak256(CREDIT + agentId + dataHash)
    API->>R: Push to cre:queue:credit<br/>(includes access_token)
    API-->>FE: { requestHash, itemId, status: "pending_cre" }

    R->>CRE: Pop validation request
    CRE->>CRE: Plaid /asset_report/create<br/>(uses access_token)
    CRE->>CRE: Compute credit score (0-100)
    CRE->>SC: PlaidCreditValidator.onReport()<br/>(agentId, score=95, requestHash, dataHash)
    SC->>SC: creditScores[agentId] = 95
    SC->>SC: ValidationRegistry.validationResponse()
```

---

## Component Architecture

```mermaid
graph TB
    subgraph Browser["Frontend (Browser)"]
        B_WALLET[MetaMask Wallet]
        B_STRIPE[Stripe Identity Modal]
        B_PLAID[Plaid Link Modal]
        B_STATUS[On-Chain Status Panel]
    end

    subgraph TEE["TEE Enclave"]
        subgraph API["API Routes"]
            API_KYC["/api/kyc"]
            API_PLAID["/api/plaid"]
            API_VALIDATE["/api/bonding/validate"]
            API_STATUS["/api/bonding/status"]
        end
        KEYS["STRIPE_SECRET_KEY<br/>PLAID_SECRET<br/>access_token (per user)<br/>FORWARDER_KEY"]
        subgraph CRE["CRE Worker"]
            CRE_KYC["KYC Verifier"]
            CRE_CREDIT["Credit Scorer"]
        end
    end

    REDIS[(Redis Queue)]

    subgraph Chain["On-Chain (Base Sepolia)"]
        IR[IdentityRegistry]
        WID[WorldIDValidator]
        SVAL[StripeKYCValidator]
        PVAL[PlaidCreditValidator]
        TP[TieredPolicy]
        VR[ValidationRegistry]
    end

    B_STRIPE -->|clientSecret| API_KYC
    B_PLAID -->|publicToken| API_PLAID
    API_VALIDATE -->|validation request| REDIS
    REDIS --> CRE_KYC
    REDIS --> CRE_CREDIT
    CRE_KYC -->|"onReport(verified=true)"| SVAL
    CRE_CREDIT -->|"onReport(score=95)"| PVAL
    SVAL --> VR
    PVAL --> VR
    API_STATUS -->|read| Chain
    B_STATUS -->|poll| API_STATUS
    TP -.->|reads| IR
    TP -.->|reads| WID
    TP -.->|reads| SVAL
    TP -.->|reads| PVAL
    API_KYC --> KEYS
    API_PLAID --> KEYS
```

---

## TieredPolicy: 온체인 검증 계층

```mermaid
graph LR
    T0["T0: Unregistered"] --> T1["T1: Registered<br/>IdentityRegistry.ownerOf() != 0x0"]
    T1 --> T2["T2: Human Verified<br/>WorldIDValidator.isHumanVerified()"]
    T2 --> T3["T3: KYC Verified<br/>StripeKYCValidator.isKYCVerified()"]
    T3 --> T4["T4: Credit Scored<br/>PlaidCreditValidator.getCreditScore() >= 60"]

    style T0 fill:#5c1a1a,stroke:#ef4444,color:#fff
    style T1 fill:#5c3d1a,stroke:#f59e0b,color:#fff
    style T2 fill:#1e3a5f,stroke:#4a9eed,color:#fff
    style T3 fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style T4 fill:#1a4d2e,stroke:#22c55e,color:#fff
```

각 tier에서 접근 가능한 리소스가 달라집니다. Tier가 높을수록 더 비싼/민감한 리소스를 사용할 수 있습니다.

---

## Security Model

```mermaid
graph TB
    subgraph TEE_BOX["TEE Enclave (Confidential HTTP)"]
        direction TB
        S1["STRIPE_SECRET_KEY"]
        S2["PLAID_SECRET"]
        S3["access_token (per customer)"]
        S4["FORWARDER_KEY"]
        API_BOX["API Routes<br/>/api/kyc, /api/plaid, /api/bonding"]
        CRE_BOX["CRE Worker<br/>Verify + Write On-Chain"]
        API_BOX --> CRE_BOX
    end

    BROWSER["Browser /bonding<br/>(no secrets)"]
    CHAIN["On-Chain<br/>verified=true | score=95"]

    BROWSER -->|"public_token (1-time)<br/>clientSecret (session)"| TEE_BOX
    TEE_BOX -->|"boolean / score only"| CHAIN

    style TEE_BOX fill:#2d1b69,stroke:#8b5cf6,color:#fff
    style BROWSER fill:#1e3a5f,stroke:#4a9eed,color:#fff
    style CHAIN fill:#1a4d2e,stroke:#22c55e,color:#fff
```

브라우저에는 민감한 키가 절대 존재하지 않습니다.
`public_token`은 일회용이며, 교환 후 무효화됩니다.
체인에는 `verified=true` 또는 `score=95`만 기록됩니다.

---

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| TieredPolicy | `0x63b4d2e051180c3c0313eb71a9bdda8554432e23` |
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| WorldIDValidator | `0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124` |
| StripeKYCValidator | `0x12b456dcc0e669eeb1d96806c8ef87b713d39cc8` |
| PlaidCreditValidator | `0x9a0ed706f1714961bf607404521a58decddc2636` |
| WhitewallConsumer | `0xb5845901c590f06ffa480c31b96aca7eff4dfb3e` |

---

## /bonding UX Demo

현재 구현된 UX 데모는 sandbox 모드에서 실제 Stripe/Plaid API를 호출합니다:

1. **지갑 연결**: MetaMask → Base Sepolia
2. **Agent ID 입력**: IdentityRegistry에서 등록된 에이전트 ID
3. **KYC 카드**: Stripe Identity 모달 → 검증 → validation request 생성 → Redis 큐
4. **Credit 카드**: Plaid Link 모달 → 은행 연결 → token 교환 → validation request 생성 → Redis 큐
5. **On-Chain Status**: 실시간으로 validator 상태를 읽어 tier 표시

### Test Credentials

| Service | Credentials |
|---------|------------|
| Stripe Identity | Test mode: 자동 검증 (테스트 문서 사용) |
| Plaid Link | `user_good` / `pass_good`, MFA: `1234` |
