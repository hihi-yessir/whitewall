import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  isAddress,
  formatUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getRedis } from "@/lib/redis";
import { addresses, tieredPolicyAbi, identityRegistryAbi, worldIdValidatorAbi } from "@whitewall-os/sdk";
import { USDC_ADDRESS } from "@/lib/contracts";
const addr = addresses.baseSepolia;
const FAUCET_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)
const FAUCET_COOLDOWN = 86_400; // 1 day in seconds

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

// Cache policy config (addresses don't change)
let policyConfig: { identityRegistry: string; worldIdValidator: string } | null = null;

function getPublicClient(rpcUrl?: string) {
  return createPublicClient({ chain: baseSepolia, transport: http(rpcUrl || "https://sepolia.base.org") });
}

async function getPolicyConfig(rpcUrl?: string) {
  if (policyConfig) return policyConfig;
  const client = getPublicClient(rpcUrl);
  const policyAddr = addr.tieredPolicy as `0x${string}`;
  const [identityRegistry, worldIdValidator] = await Promise.all([
    client.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getIdentityRegistry" }),
    client.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getWorldIdValidator" }),
  ]);
  policyConfig = { identityRegistry: identityRegistry as string, worldIdValidator: worldIdValidator as string };
  return policyConfig;
}

function faucetKey(address: string) {
  return `faucet:${address.toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { address, agentId, agentWallet } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    if (!agentId) {
      return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
    }
    // If agentWallet is provided, fund that address instead (owner still verified via `address`)
    const targetAddress = agentWallet && isAddress(agentWallet) ? agentWallet : address;

    const pk = process.env.FAUCET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 503 });
    }

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const publicClient = getPublicClient(rpcUrl);
    const config = await getPolicyConfig(rpcUrl);

    // On-chain verification: must be human-verified + caller must be owner
    const [owner, humanVerified] = await Promise.all([
      publicClient.readContract({
        address: config.identityRegistry as `0x${string}`,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
      }),
      publicClient.readContract({
        address: config.worldIdValidator as `0x${string}`,
        abi: worldIdValidatorAbi,
        functionName: "isHumanVerified",
        args: [BigInt(agentId)],
      }),
    ]);

    if (!humanVerified) {
      return NextResponse.json({ error: "Agent is not human-verified" }, { status: 403 });
    }
    if ((owner as string).toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Address is not the agent owner" }, { status: 403 });
    }

    // Rate limit: 1 per target address per day
    const redis = getRedis();
    const existing = await redis.get(faucetKey(targetAddress));
    if (existing) {
      return NextResponse.json({ error: "Already funded today", skipped: true }, { status: 200 });
    }

    // Check if target already has USDC
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [targetAddress as `0x${string}`],
    });

    if (balance >= FAUCET_AMOUNT) {
      // Already has enough, mark as funded and skip
      await redis.set(faucetKey(targetAddress), "funded", { ex: FAUCET_COOLDOWN });
      return NextResponse.json({
        skipped: true,
        balance: formatUnits(balance, 6),
        message: "Already has USDC",
      });
    }

    // Send USDC
    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [targetAddress as `0x${string}`, FAUCET_AMOUNT],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Mark as funded
    await redis.set(faucetKey(targetAddress), hash, { ex: FAUCET_COOLDOWN });

    return NextResponse.json({
      success: true,
      txHash: hash,
      amount: formatUnits(FAUCET_AMOUNT, 6),
      balance: formatUnits(balance + FAUCET_AMOUNT, 6),
      status: receipt.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Faucet transfer failed";
    console.error("Faucet error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
