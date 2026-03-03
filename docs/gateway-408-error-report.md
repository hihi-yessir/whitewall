# x402-auth-gateway 408 오류 보고서

> 작성일: 2026-03-03
> 게이트웨이: `https://x402-auth-gateway.onrender.com`
> 네트워크: Base Sepolia (chain ID: 84532)

---

## 증상

`POST /api/generate` 요청 시 **408 "Timeout waiting for blockchain event"** 오류가 반복적으로 발생.
프론트엔드(`/tryout`)에서 호출하든, 독립 테스트 스크립트(`test-agent/test-full-flow.mjs`)로 직접 호출하든 동일하게 실패.

```
[2/4] AI generation request (x402 payment)...
   FAIL [408]: { error: 'Timeout waiting for blockchain event' }
```

---

## 결제 흐름 (정상 시나리오)

```
Client                          Gateway                         Base Sepolia
  │                                │                                │
  ├─ POST /api/generate ──────────►│                                │
  │◄── 402 + Payment-Required ────┤                                │
  │                                │                                │
  │  (x402 SDK: EIP-3009 서명)     │                                │
  │                                │                                │
  ├─ POST /api/generate ──────────►│                                │
  │  (X-PAYMENT header 포함)       │                                │
  │                                ├─ transferWithAuthorization ───►│
  │                                │◄── tx receipt ────────────────┤
  │                                │                                │
  │◄── 202 { jobId, txHash } ────┤                                │
```

현재 **3번째 단계에서 타임아웃** 발생: 게이트웨이가 서명된 EIP-3009 `transferWithAuthorization`을 받아서 on-chain에 제출하지만, 블록체인 이벤트(tx receipt)를 기다리다가 타임아웃.

---

## 클라이언트 측 확인 완료 사항

### 1. USDC 잔액 — 충분함

| 지갑 | 주소 | USDC 잔액 | ETH 잔액 |
|------|------|-----------|----------|
| Faucet (= 테스트 지갑) | `0x4fed0A5B65eac383D36E65733786386709B86be8` | ~365 USDC | ~2 ETH |
| Agent 지갑 (예시) | `0x8aA0...5149` | 1.00 USDC | 0 ETH |

- USDC 컨트랙트: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- 게이트웨이 결제 요구 금액: **0.50 USDC** (500000 단위, 6 decimals)
- Agent 지갑 잔액 1.00 USDC > 0.50 USDC → **잔액 부족 아님**

### 2. x402 SDK 정상 동작

게이트웨이의 402 응답 `Payment-Required` 헤더를 정상 파싱:

```json
{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x0d10F69243B8A2FE4299FA4cC115c3023F4011CF",
    "amount": "500000",
    "maxTimeoutSeconds": 3600,
    "extra": { "name": "USDC", "version": "2" }
  }],
  "x402Version": 2
}
```

- `@x402/fetch` SDK가 402 수신 → EIP-3009 서명 → `X-PAYMENT` 헤더 포함하여 재요청까지 정상 수행
- 이전에 동일한 설정으로 성공한 이력 있음 (2026-03-02, 테스트 스크립트로 이미지 생성 완료)

### 3. 독립 테스트 스크립트로 재현

```bash
cd test-agent && node test-full-flow.mjs
```

이 스크립트는 프론트엔드/Next.js를 거치지 않고 직접 게이트웨이를 호출함.
동일한 408 오류 발생 → **클라이언트 측 코드 문제가 아님을 확인**

### 4. 이전 성공/실패 패턴

| 시점 | 결과 | 비고 |
|------|------|------|
| 03-02 1차 시도 | 408 Timeout | Render 콜드스타트 추정 |
| 03-02 2차 시도 | **202 성공** | 이미지 생성 완료, artifact URL 수신 |
| 03-03 전체 | 408 반복 실패 | 연속 2회 이상 시도, 모두 실패 |

---

## 게이트웨이 측 추정 원인

### 가설 1: 게이트웨이 지갑 ETH 부족 (가능성 높음)

게이트웨이가 `transferWithAuthorization`을 on-chain에 제출하려면 **가스비(ETH)**가 필요함.
게이트웨이 수신 주소 (`payTo`): `0x0d10F69243B8A2FE4299FA4cC115c3023F4011CF`

**확인 필요**: 이 주소(또는 게이트웨이가 tx를 제출하는 데 사용하는 별도 relayer 지갑)의 Base Sepolia ETH 잔액.

```bash
cast balance 0x0d10F69243B8A2FE4299FA4cC115c3023F4011CF --rpc-url https://sepolia.base.org --ether
```

### 가설 2: RPC 노드 문제

게이트웨이가 사용하는 Base Sepolia RPC가 다운되었거나 응답 지연.
- `transferWithAuthorization` tx 제출 자체가 실패하거나
- tx receipt 폴링이 타임아웃

**확인 필요**: 게이트웨이 `.env`의 RPC URL 및 해당 노드 상태

### 가설 3: Render 프리티어 리소스 제한

Render 프리티어 서비스는 비활성 시 슬립 상태로 전환.
콜드스타트 시 요청 처리 시간이 길어져 블록체인 이벤트 대기 타임아웃에 걸릴 수 있음.
다만 03-02에는 2차 시도에서 성공했으므로, 현재는 다른 원인이 복합적으로 작용하는 것으로 보임.

### 가설 4: EIP-3009 nonce/authorization 충돌

이전 실패한 authorization이 on-chain에 남아있어 동일 nonce로 재시도 시 revert될 가능성.
가능성 낮음 — x402 SDK는 매 요청마다 새 nonce를 생성하는 것으로 알려져 있음.

---

## 게이트웨이 확인 요청 사항

1. **게이트웨이 서버 로그 확인** — `POST /api/generate` 요청 처리 중 어디서 멈추는지
   - EIP-3009 서명 검증 성공 여부
   - `transferWithAuthorization` tx 제출 시도 여부 및 tx hash
   - tx receipt 대기 중 타임아웃 발생 지점

2. **게이트웨이/relayer 지갑 ETH 잔액 확인** (Base Sepolia)

3. **게이트웨이 RPC URL 상태 확인**
   - 현재 사용 중인 RPC endpoint
   - 해당 endpoint로 `eth_blockNumber` 호출 정상 여부

4. **최근 성공한 tx hash 확인** — 03-02 성공 건의 BaseScan 기록을 통해 정상 동작 시와 현재의 차이점 비교

---

## 서버 사이드 로그 (2026-03-03)

```
[agent-wallet] agentId=1353 owner=0x4fed0A5B65eac383D36E65733786386709B86be8 humanVerified=true
POST /api/agent-wallet 200 in 4.3s    ← 지갑 생성 + USDC 펀딩 성공

[agent-generate] Agent 0x3267CC7d7Dd89b5945Bae8e62B0707bC6a8Fd7E2 USDC balance: 1.00
POST /api/agent-generate 200 in 94s   ← 94초 대기 후 게이트웨이 408 수신
```

- 클라이언트 → 서버: 정상
- 서버 → 게이트웨이: x402 서명 전송 정상
- 게이트웨이 → 블록체인: **여기서 실패** (94초 대기 후 타임아웃)

---

## 재현 환경

```
Gateway URL: https://x402-auth-gateway.onrender.com
Network: Base Sepolia (84532)
USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
x402 SDK: @x402/fetch + @x402/evm + @x402/core
Test script: test-agent/test-full-flow.mjs
```
