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
import { addresses, tieredPolicyAbi, identityRegistryAbi, worldIdValidatorAbi } from "@whitewall-os/sdk";
import { USDC_ADDRESS } from "@/lib/contracts";
const addr = addresses.baseSepolia;
const FAUCET_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)

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

    console.log(`[agent-wallet] agentId=${agentId} owner=${owner} humanVerified=${humanVerified} callerOwner=${ownerAddress}`);

    if (!humanVerified) {
      return NextResponse.json({ error: "Agent is not human-verified" }, { status: 403 });
    }
    if ((owner as string).toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: `Not the agent owner (on-chain: ${owner}, caller: ${ownerAddress})` }, { status: 403 });
    }

    // Generate agent keypair
    const agentPrivateKey = generatePrivateKey();
    const agentAccount = privateKeyToAccount(agentPrivateKey);

    // Store key server-side (in production: secure enclave or KMS)
    await storeAgentKey(agentId.toString(), agentPrivateKey);

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
