import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const GATEWAY_URL = "https://x402-auth-gateway.onrender.com";
const RPC_URL = "https://sepolia.base.org";

// Test with both keys
const keys = {
  "faucet (365 USDC)": "0x1abf48b5ce66d085c571283f1330ca098ee3cec4f08cde51821b60151e6f4d71",
  "agent-1356 (1 USDC)": "0x04b93f7486cc86ce1e91cea2bf20fc96a265e3bb2a1015a2467e509ef79db9ed",
};

for (const [label, key] of Object.entries(keys)) {
  console.log(`\n=== Testing with ${label} ===`);
  const account = privateKeyToAccount(key);
  console.log(`Address: ${account.address}`);

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  try {
    const res = await fetchWithPayment(`${GATEWAY_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test cat", agentId: "1356", type: "image" }),
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(data).slice(0, 200));
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}
