import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import {
  addresses,
  tieredPolicyAbi,
  identityRegistryAbi,
  worldIdValidatorAbi,
  stripeKYCValidatorAbi,
  plaidCreditValidatorAbi,
} from "@whitewall-os/sdk";
import { getRedis } from "@/lib/redis";

const client = createPublicClient({ chain: baseSepolia, transport: http() });
const addr = addresses.baseSepolia;

// Cache policy config (addresses don't change)
let policyConfig: { identityRegistry: string; worldIdValidator: string } | null = null;

async function getPolicyConfig() {
  if (policyConfig) return policyConfig;
  const policyAddr = addr.tieredPolicy as `0x${string}`;
  const [identityRegistry, worldIdValidator] = await Promise.all([
    client.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getIdentityRegistry" }),
    client.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getWorldIdValidator" }),
  ]);
  policyConfig = { identityRegistry: identityRegistry as string, worldIdValidator: worldIdValidator as string };
  return policyConfig;
}

/**
 * GET /api/bonding/status?agentId=123
 *
 * Reads on-chain validator state + Redis validation request state.
 */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const id = BigInt(agentId);

  try {
    const config = await getPolicyConfig();

    // Read on-chain state in parallel
    const [owner, isHumanVerified, isKYCVerified, kycData, creditScore, hasCreditScore, creditData] =
      await Promise.allSettled([
        client.readContract({
          address: config.identityRegistry as `0x${string}`,
          abi: identityRegistryAbi,
          functionName: "ownerOf",
          args: [id],
        }),
        client.readContract({
          address: config.worldIdValidator as `0x${string}`,
          abi: worldIdValidatorAbi,
          functionName: "isHumanVerified",
          args: [id],
        }),
        client.readContract({
          address: addr.stripeKYCValidator as `0x${string}`,
          abi: stripeKYCValidatorAbi,
          functionName: "isKYCVerified",
          args: [id],
        }),
        client.readContract({
          address: addr.stripeKYCValidator as `0x${string}`,
          abi: stripeKYCValidatorAbi,
          functionName: "getKYCData",
          args: [id],
        }),
        client.readContract({
          address: addr.plaidCreditValidator as `0x${string}`,
          abi: plaidCreditValidatorAbi,
          functionName: "getCreditScore",
          args: [id],
        }),
        client.readContract({
          address: addr.plaidCreditValidator as `0x${string}`,
          abi: plaidCreditValidatorAbi,
          functionName: "hasCreditScore",
          args: [id],
        }),
        client.readContract({
          address: addr.plaidCreditValidator as `0x${string}`,
          abi: plaidCreditValidatorAbi,
          functionName: "getCreditData",
          args: [id],
        }),
      ]);

    // Read Redis validation request state
    const redis = getRedis();
    const [kycRequest, creditRequest] = await Promise.all([
      redis.hgetall(`bonding:kyc:${agentId}`),
      redis.hgetall(`bonding:credit:${agentId}`),
    ]);

    // Compute effective tier
    const registered = owner.status === "fulfilled" && owner.value !== "0x0000000000000000000000000000000000000000";
    const humanOk = isHumanVerified.status === "fulfilled" && isHumanVerified.value === true;
    const kycOk = isKYCVerified.status === "fulfilled" && isKYCVerified.value === true;
    const creditOk = hasCreditScore.status === "fulfilled" && hasCreditScore.value === true;
    const score = creditScore.status === "fulfilled" ? Number(creditScore.value) : 0;

    let effectiveTier = 0;
    if (registered) effectiveTier = 1;
    if (registered && humanOk) effectiveTier = 2;
    if (registered && humanOk && kycOk) effectiveTier = 3;
    if (registered && humanOk && kycOk && creditOk && score >= 60) effectiveTier = 4;

    return NextResponse.json({
      agentId,
      onChain: {
        registered,
        owner: owner.status === "fulfilled" ? owner.value : null,
        humanVerified: humanOk,
        kycVerified: kycOk,
        kycData: kycData.status === "fulfilled" ? {
          verified: (kycData.value as [boolean, string, bigint])[0],
          sessionHash: (kycData.value as [boolean, string, bigint])[1],
          verifiedAt: Number((kycData.value as [boolean, string, bigint])[2]),
        } : null,
        creditScore: score,
        hasCreditScore: creditOk,
        creditData: creditData.status === "fulfilled" ? {
          score: Number((creditData.value as [number, string, bigint, boolean])[0]),
          dataHash: (creditData.value as [number, string, bigint, boolean])[1],
          verifiedAt: Number((creditData.value as [number, string, bigint, boolean])[2]),
          hasScore: (creditData.value as [number, string, bigint, boolean])[3],
        } : null,
        effectiveTier,
      },
      validationRequests: {
        kyc: kycRequest || null,
        credit: creditRequest ? { ...creditRequest, accessToken: undefined } : null,
      },
    });
  } catch (e) {
    console.error("Bonding status error:", e);
    return NextResponse.json({ error: "Failed to read on-chain status" }, { status: 500 });
  }
}
