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

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const WORLD_ID_VALIDATOR = "0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124" as const;
const FAUCET_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)
const FAUCET_COOLDOWN = 86_400; // 1 day in seconds

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const verifyAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isHumanVerified(uint256 agentId) view returns (bool)",
]);

function faucetKey(address: string) {
  return `faucet:${address.toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const { address, agentId } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    if (!agentId) {
      return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
    }

    const pk = process.env.FAUCET_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 503 });
    }

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

    // On-chain verification: must be human-verified + caller must be owner
    const [owner, humanVerified] = await Promise.all([
      publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: verifyAbi,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
      }),
      publicClient.readContract({
        address: WORLD_ID_VALIDATOR,
        abi: verifyAbi,
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

    // Rate limit: 1 per address per day
    const redis = getRedis();
    const existing = await redis.get(faucetKey(address));
    if (existing) {
      return NextResponse.json({ error: "Already funded today", skipped: true }, { status: 200 });
    }

    // Check if user already has USDC
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    if (balance >= FAUCET_AMOUNT) {
      // Already has enough, mark as funded and skip
      await redis.set(faucetKey(address), "funded", { ex: FAUCET_COOLDOWN });
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
      args: [address as `0x${string}`, FAUCET_AMOUNT],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Mark as funded
    await redis.set(faucetKey(address), hash, { ex: FAUCET_COOLDOWN });

    return NextResponse.json({
      success: true,
      txHash: hash,
      amount: formatUnits(FAUCET_AMOUNT, 6),
      status: receipt.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Faucet transfer failed";
    console.error("Faucet error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
