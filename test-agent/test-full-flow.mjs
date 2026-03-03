import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
// No EventSource needed — we'll use fetch for SSE

// Config — use the faucet/owner wallet for testing
const AGENT_PRIVATE_KEY = "0x1abf48b5ce66d085c571283f1330ca098ee3cec4f08cde51821b60151e6f4d71";
const GATEWAY_URL = "https://x402-auth-gateway.onrender.com";
const AGENT_ID = "1312";
const RPC_URL = "https://base-sepolia.infura.io/v3/89fba834e71e4807934559d71e9fec78";

async function main() {
  console.log("\n========================================");
  console.log("   Auth-OS Gateway Full Flow Test");
  console.log("========================================\n");

  // 1. x402 client setup
  console.log("[1/4] x402 client setup...");
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const signer = privateKeyToAccount(AGENT_PRIVATE_KEY);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer, publicClient });

  console.log(`   Agent Address: ${signer.address}`);
  console.log(`   Gateway URL: ${GATEWAY_URL}`);
  console.log(`   Agent ID: ${AGENT_ID}`);

  // 2. Request with payment
  console.log("\n[2/4] AI generation request (x402 payment)...");
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const requestBody = {
    agentId: AGENT_ID,
    type: "image",
    prompt: "a flying whale in sunset, digital art, vibrant colors",
  };

  console.log(`   Type: ${requestBody.type}`);
  console.log(`   Prompt: "${requestBody.prompt}"`);

  let jobId, txHash;

  try {
    const response = await fetchWithPayment(`${GATEWAY_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (response.status === 202) {
      jobId = result.jobId;
      txHash = result.txHash;
      console.log(`\n   Payment success!`);
      console.log(`   Job ID: ${jobId}`);
      console.log(`   Tx Hash: ${txHash}`);
      console.log(`   BaseScan: https://sepolia.basescan.org/tx/${txHash}`);
    } else {
      console.error(`   FAIL [${response.status}]:`, result);
      return;
    }
  } catch (error) {
    console.error("   Payment flow failed:", error.message);
    return;
  }

  // 3. SSE streaming
  console.log("\n[3/4] SSE streaming...");
  console.log(`   URL: ${GATEWAY_URL}/api/jobs/${jobId}/stream`);
  console.log("\n   --- Real-time progress ---");

  // SSE via fetch
  const sseRes = await fetch(`${GATEWAY_URL}/api/jobs/${jobId}/stream`);
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const data = JSON.parse(raw);
        const icons = { queued: "...", processing: ">>>", completed: "OK", failed: "XX" };
        console.log(`   [${icons[data.status] || "??"}] Status: ${data.status} (type: ${data.type})`);

        if (data.status === "completed") {
          console.log("\n[4/4] Generation complete!");
          if (data.artifact_url) console.log(`   Artifact URL: ${data.artifact_url}`);
          reader.releaseLock();
          break;
        }
        if (data.status === "failed") {
          console.log(`\n   Generation failed: ${data.error || "Unknown"}`);
          reader.releaseLock();
          break;
        }
      } catch {
        console.log(`   Raw: ${raw}`);
      }
    }
  }

  console.log("\n========================================");
  console.log("   Full Flow Test Complete!");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
