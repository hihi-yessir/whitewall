# x402 Full Flow — Owner + Agent + Gateway + Facilitator

---

## Phase 1 — Owner Setup

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner (Browser)
    participant S as FE Server (Next.js)
    participant B as Blockchain (Base Sepolia)

    Note over O, B: 1. 지갑 연결 + 에이전트 등록

    O->>B: Connect Wallet + Switch to Base Sepolia
    O->>B: register() — ERC-8004 NFT mint
    Note over B: agentId #1042 발급

    Note over O, B: 2. World ID 인간 인증

    O->>B: approve(WorldIDValidator, #1042)
    O->>B: verifyAndSetHumanTag(#1042, proof)
    Note over B: HUMAN_VERIFIED 태그 설정

    Note over O, S: 3. 에이전트 지갑 생성 + USDC 충전 (자동, 백그라운드)

    S->>S: Generate agent keypair → 0xAgent
    O->>B: setAgentWallet(#1042, 0xAgent) — owner EIP-712 서명

    rect rgb(255, 245, 235)
        Note over S, B: Faucet — 온체인 검증 후 USDC 전송
        S->>B: isHumanVerified(#1042) → true?
        S->>B: ownerOf(#1042) == 0xOwner?
        Note over S: 둘 다 통과해야 USDC 전송 (봇 방지)
        S->>B: USDC.transfer(0xAgent, 1 USDC)
    end

    Note over O: "에이전트 준비 완료. 지갑에 1 USDC 충전됨"
```

---

## Phase 2a — Image Generation (Tier 2, World ID만 필요)

정산과 에셋 수신을 분리. 정산 시 prompt를 같이 보내서 생성을 미리 시작하고, job_id로 에셋을 받음.

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner (Browser)
    participant S as FE Server (Next.js)
    participant A as AI Agent (0xAgent)
    participant G as Gateway (예슬)
    participant F as Facilitator (Coinbase)
    participant B as Blockchain (Base Sepolia)

    O->>S: 프롬프트 입력: "a cat in space"
    Note over S: 서버가 에이전트 역할 수행 (agent key 보유)

    rect rgb(240, 248, 255)
        Note over A, G: 1. 초기 요청 — 결제 조건 확인
        A->>G: POST /api/generate { prompt, agentId, type: "image" }
        G-->>A: 402 Payment Required + PaymentRequirements ($0.10)
    end

    rect rgb(245, 240, 255)
        Note over A: 2. EIP-3009 서명 생성
        Note right of A: "0xAgent → 0xGateway<br/>0.10 USDC 허용"<br/>(온체인 tx 아님, 서명만)
    end

    rect rgb(240, 248, 255)
        Note over A, G: 3. 결제 정보 포함 재요청 (prompt 포함)
        A->>G: POST /api/generate { prompt, agentId, type: "image" } + X-PAYMENT
    end

    rect rgb(255, 245, 235)
        Note over G, F: 4. 결제 유효성 검증
        G->>F: POST /verify (Signature + Requirements)
        F-->>G: { "isValid": true }
    end

    rect rgb(235, 255, 235)
        Note over G, B: 5. 온체인 게이트 체크
        G->>B: Gate 1: ownerOf(#1042) → registered?
        G->>B: Gate 2: isHumanVerified(#1042) → human?
        Note over G: Gate 1+2 통과 → tier=2 (이미지 허용)
        Note over G: Gate 3/4 (KYC/Credit) 실패해도 이미지는 OK
    end

    rect rgb(255, 248, 235)
        Note over G, B: 6. 온체인 정산 (Settle)
        G->>F: POST /settle (정산 요청)
        F->>B: transferWithAuthorization 호출
        B-->>B: 0.10 USDC 전송 (Agent → Gateway)
        F-->>G: { txHash: "0xabc..." }
    end

    rect rgb(235, 255, 235)
        Note over G: 7. 정산 확인 → 생성 시작 (prompt는 이미 받았으므로 즉시)
        G->>G: AI Image Generation (SDXL) — prompt: "a cat in space"
        Note over G: job_id 발급
    end

    G-->>A: { job_id: "j_abc123", txHash: "0xabc...", status: "processing" }
    A-->>S: 정산 완료 + job_id 수신

    rect rgb(240, 248, 255)
        Note over S, G: 8. FE가 job_id로 SSE 연결
        S->>G: GET /api/jobs/j_abc123/stream (SSE)
        G-->>S: data: { progress: 30 }
        G-->>S: data: { progress: 70 }
        G-->>S: data: { status: "done", imageUrl: "https://..." }
    end

    S-->>O: 터미널에 전 과정 실시간 표시
    S-->>O: 이미지 + License Plate + 결제 영수증
```

---

## Phase 2b — Video Generation (Tier 3, World ID + KYC + Credit 필요)

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner (Browser)
    participant S as FE Server (Next.js)
    participant A as AI Agent (0xAgent)
    participant G as Gateway (예슬)
    participant F as Facilitator (Coinbase)
    participant B as Blockchain (Base Sepolia)

    Note over O: 에이전트는 Phase 1 완료 + KYC/Credit 본딩 완료 상태

    O->>S: 프롬프트 입력: "a flying whale in sunset"
    Note over S: 서버가 에이전트 역할 수행 (agent key 보유)

    rect rgb(240, 248, 255)
        Note over A, G: 1. 초기 요청 — 결제 조건 확인
        A->>G: POST /api/generate { prompt, agentId, type: "video" }
        G-->>A: 402 Payment Required + PaymentRequirements ($0.50)
    end

    rect rgb(245, 240, 255)
        Note over A: 2. EIP-3009 서명 생성
        Note right of A: "0xAgent → 0xGateway<br/>0.50 USDC 허용"<br/>(온체인 tx 아님, 서명만)
    end

    rect rgb(240, 248, 255)
        Note over A, G: 3. 결제 정보 포함 재요청 (prompt 포함)
        A->>G: POST /api/generate { prompt, agentId, type: "video" } + X-PAYMENT
    end

    rect rgb(255, 245, 235)
        Note over G, F: 4. 결제 유효성 검증
        G->>F: POST /verify (Signature + Requirements)
        F-->>G: { "isValid": true }
    end

    rect rgb(235, 255, 235)
        Note over G, B: 5. 온체인 게이트 체크 (전부 통과 필요)
        G->>B: Gate 1: ownerOf(#1042) → registered?
        G->>B: Gate 2: isHumanVerified(#1042) → human?
        G->>B: Gate 3: isKYCVerified(#1042) → KYC?
        G->>B: Gate 4: getCreditScore(#1042) >= 50?
        Note over G: Gate 1~4 전부 통과 → tier=3 (영상 허용)
    end

    rect rgb(255, 248, 235)
        Note over G, B: 6. 온체인 정산 (Settle)
        G->>F: POST /settle (정산 요청)
        F->>B: transferWithAuthorization 호출
        B-->>B: 0.50 USDC 전송 (Agent → Gateway)
        F-->>G: { txHash: "0xabc..." }
    end

    rect rgb(235, 255, 235)
        Note over G: 7. 정산 확인 → 생성 시작
        G->>G: AI Video Generation (LTX-Video) — prompt: "a flying whale in sunset"
        Note over G: job_id 발급
    end

    G-->>A: { job_id: "j_def456", txHash: "0xabc...", status: "processing" }
    A-->>S: 정산 완료 + job_id 수신

    rect rgb(240, 248, 255)
        Note over S, G: 8. FE가 job_id로 SSE 연결
        S->>G: GET /api/jobs/j_def456/stream (SSE)
        G-->>S: data: { progress: 10 }
        G-->>S: data: { progress: 50 }
        G-->>S: data: { progress: 90 }
        G-->>S: data: { status: "done", videoUrl: "https://..." }
    end

    S-->>O: 터미널에 전 과정 실시간 표시
    S-->>O: 영상 + License Plate + 결제 영수증
```

---

## 통신 구조 요약

```mermaid
flowchart LR
    subgraph FE ["FE (재욱)"]
        O["Owner<br/>Browser"]
        S["FE Server<br/>Next.js"]
    end

    subgraph GW ["Gateway (예슬)"]
        G["Gateway"]
        JOB["Job Store"]
    end

    subgraph EXT ["외부"]
        F["Facilitator<br/>Coinbase"]
        B["Blockchain<br/>Base Sepolia"]
        AI["AI Engine<br/>SDXL / LTX"]
    end

    O -->|"프롬프트 입력"| S
    S -->|"① POST (no payment)"| G
    G -->|"② 402 + Requirements"| S
    S -->|"③ POST + X-PAYMENT"| G
    G -->|"④ /verify"| F
    G -->|"⑤ 게이트 체크"| B
    G -->|"⑥ /settle"| F
    F -->|"⑦ USDC tx"| B
    G -->|"⑧ 생성 요청"| AI
    AI -->|"결과"| JOB
    G -->|"{ job_id, txHash }"| S
    S -->|"⑨ GET /jobs/{id}/stream"| G
    G -->|"SSE 스트림"| S
    S -->|"터미널 + 에셋"| O

    style FE fill:#f0f8ff,stroke:#4a9eff
    style GW fill:#f0fff0,stroke:#4a9e4a
    style EXT fill:#fff8f0,stroke:#e9a060
```

---

## Gateway API 엔드포인트 (예슬)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/generate` | 생성 요청. X-PAYMENT 없으면 402 반환. 있으면 verify → 게이트 → settle → job 생성 |
| GET | `/api/jobs/{job_id}/stream` | SSE 스트림. job_id로 인증 — 유효한 job_id 없으면 404 |

### POST /api/generate — 요청

```json
{
  "prompt": "a cat in space",
  "agentId": "1042",
  "type": "image"
}
```

### POST /api/generate — 402 응답 (결제 없을 때)

```
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xGateway...",
    "maxAmountRequired": "100000",
    "maxTimeoutSeconds": 3600,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

### POST /api/generate — 성공 응답 (정산 + job 발급)

```
HTTP/1.1 200 OK

{
  "job_id": "j_abc123",
  "txHash": "0xabc...",
  "status": "processing",
  "type": "image",
  "tier": 2
}
```

### GET /api/jobs/{job_id}/stream — SSE 이벤트

```
data: {"type":"progress","progress":30}

data: {"type":"progress","progress":70}

data: {"type":"done","imageUrl":"https://...","prompt":"a cat in space","agentId":"1042"}
```

---

## Faucet 보안 플로우

```mermaid
flowchart TD
    REQ["POST /api/faucet<br/>{ address, agentId }"] --> V1

    V1{"isHumanVerified(agentId)?"}
    V1 -->|false| DENY1["403: Agent is not human-verified"]
    V1 -->|true| V2

    V2{"ownerOf(agentId) == address?"}
    V2 -->|false| DENY2["403: Not the agent owner"]
    V2 -->|true| V3

    V3{"Redis: 오늘 이미 받았나?"}
    V3 -->|yes| SKIP1["200: Already funded today"]
    V3 -->|no| V4

    V4{"USDC 잔액 >= 1?"}
    V4 -->|yes| SKIP2["200: Already has USDC"]
    V4 -->|no| SEND

    SEND["USDC.transfer(address, 1 USDC)"]
    SEND --> OK["200: { txHash, amount }"]

    style DENY1 fill:#600,stroke:#f00,color:#fff
    style DENY2 fill:#600,stroke:#f00,color:#fff
    style SEND fill:#0f3460,stroke:#53a8b6,color:#fff
    style OK fill:#1a5,stroke:#0a0,color:#fff
```

---

## Tier별 게이트 요구사항

| 리소스 | 가격 | 필요한 게이트 | 실패 시 |
|--------|------|--------------|---------|
| Image (SDXL) | $0.10 USDC | Gate 1 (Identity) + Gate 2 (Human) | settle 안 함, 서명 만료 |
| Video (LTX-Video) | $0.50 USDC | Gate 1~4 전부 (Identity + Human + KYC + Credit) | settle 안 함, 서명 만료 |

---

## X-PAYMENT Header 구조 (Agent → Gateway)

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "authorization": {
      "from": "0xAgent...",
      "to": "0xGateway...",
      "value": "100000",
      "validAfter": "...",
      "validBefore": "...",
      "nonce": "0x..."
    },
    "signature": "0x..."
  }
}
```

---

## 컨트랙트 주소 (Base Sepolia)

| 컨트랙트 | 주소 |
|----------|------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| WorldIDValidator | `0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124` |
| StripeKYCValidator | `0x4e66fe730ae5476e79e70769c379663df4c61a8b` |
| PlaidCreditValidator | `0xceb46c0f2704d2191570bd81b622200097af9ade` |
| WhitewallConsumer | `0xec3114ea6bb29f77b63cd1223533870b663120bb` |
| KeystoneForwarder | `0x82300bd7c3958625581cc2F77bC6464dcEcDF3e5` |
