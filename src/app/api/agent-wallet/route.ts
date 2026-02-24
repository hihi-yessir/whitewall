import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { storeAgentKey } from "@/lib/agent-keys";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const WORLD_ID_VALIDATOR = "0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124" as const;
const FAUCET_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

const verifyAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isHumanVerified(uint256 agentId) view returns (bool)",
]);

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export async function POST(req: NextRequest) {
  try {
    const { agentId, ownerAddress } = await req.json();

    if (!agentId || !ownerAddress) {
      return NextResponse.json({ error: "Missing agentId or ownerAddress" }, { status: 400 });
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
    if ((owner as string).toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Not the agent owner" }, { status: 403 });
    }

    // Generate agent keypair
    const agentPrivateKey = generatePrivateKey();
    const agentAccount = privateKeyToAccount(agentPrivateKey);

    // Store key server-side (in production: secure enclave or KMS)
    storeAgentKey(agentId.toString(), agentPrivateKey);

    // Fund agent wallet with USDC
    let txHash: string | undefined;
    let funded = false;

    try {
      const faucetAccount = privateKeyToAccount(pk as `0x${string}`);
      const walletClient = createWalletClient({
        account: faucetAccount,
        chain: baseSepolia,
        transport: http(rpcUrl),
      });

      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [agentAccount.address, FAUCET_AMOUNT],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      txHash = hash;
      funded = true;
    } catch (err) {
      // Funding failed but wallet was still created
      console.error("Agent wallet funding failed:", err);
    }

    return NextResponse.json({
      address: agentAccount.address,
      funded,
      txHash,
      amount: funded ? formatUnits(FAUCET_AMOUNT, 6) : "0",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create agent wallet";
    console.error("Agent wallet error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
