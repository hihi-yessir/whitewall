"use client";

import { useContext, useState, useCallback, type Dispatch } from "react";
import { ThemeCtx, Btn } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { DemoAction, TerminalEntry, GenerationResult } from "./types";

// Lazy-loaded IDKit to reduce bundle
let IDKitWidget: any = null;
let VerificationLevel: any = null;
let idkitLoaded = false;

async function loadIDKit() {
  if (idkitLoaded) return;
  const mod = await import("@worldcoin/idkit");
  IDKitWidget = mod.IDKitWidget;
  VerificationLevel = mod.VerificationLevel;
  idkitLoaded = true;
}

// Viem imports (tree-shaken)
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  decodeAbiParameters,
  parseEventLogs,
} from "viem";
import { baseSepolia } from "viem/chains";
import { identityRegistryAbi, worldIdValidatorAbi, addresses } from "@whitewall-os/sdk";

const WORLD_ID_APP = "app_staging_dae27f9b14a30e0e0917797aceac795a";
const WORLD_ID_ACTION_PREFIX = "verify-owner-";
const WORLD_ID_VALIDATOR_ADDR = "0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124";

type FlowStep = "connect" | "register" | "approve" | "verify" | "request" | "generate" | "done";

export function TryItFlow({ dispatch, wallet, agent, prompt, isGenerating, generation }: {
  dispatch: Dispatch<DemoAction>;
  wallet: { connected: boolean; address?: string };
  agent: { id?: bigint; isRegistered: boolean; isApproved: boolean; isHumanVerified: boolean };
  prompt: string;
  isGenerating: boolean;
  generation?: GenerationResult;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [step, setStep] = useState<FlowStep>("connect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idkitReady, setIdkitReady] = useState(false);
  const [showIDKit, setShowIDKit] = useState(false);

  // Re-derive identity registry address (read from SDK policy config would be ideal,
  // but for demo we use the known Base Sepolia address)
  const [identityRegistry, setIdentityRegistry] = useState<string | null>(null);
  const [worldIdValidator, setWorldIdValidator] = useState<string | null>(null);

  const addLog = useCallback((tag: string, message: string, status: TerminalEntry['status']) => {
    dispatch({ type: "ADD_TERMINAL", entry: { tag, message, status, timestamp: Date.now() } });
  }, [dispatch]);

  const connectWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!(window as any).ethereum) throw new Error("No wallet detected. Install MetaMask.");
      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });

      // Switch to Base Sepolia
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a34" }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x14a34",
              chainName: "Base Sepolia",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.base.org"],
              blockExplorerUrls: ["https://sepolia.basescan.org"],
            }],
          });
        }
      }

      dispatch({ type: "SET_WALLET", wallet: { connected: true, address: account } });
      addLog("WALLET", `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`, "pass");

      // Load policy config
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
      const { humanVerifiedPolicyAbi } = await import("@whitewall-os/sdk");
      const policyAddr = addresses.baseSepolia.humanVerifiedPolicy;

      const idReg = await publicClient.readContract({ address: policyAddr, abi: humanVerifiedPolicyAbi, functionName: "getIdentityRegistry" });
      setIdentityRegistry(idReg as string);
      setWorldIdValidator(WORLD_ID_VALIDATOR_ADDR);
      addLog("SDK", `Policy loaded: registry=${(idReg as string).slice(0, 10)}...`, "pass");

      setStep("register");
    } catch (err: any) {
      setError(err.message || "Connection failed");
      addLog("WALLET", err.message || "Connection failed", "fail");
    } finally {
      setLoading(false);
    }
  }, [dispatch, addLog]);

  const registerAgent = useCallback(async () => {
    if (!wallet.address || !identityRegistry) return;
    setLoading(true);
    setError(null);
    try {
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom((window as any).ethereum),
      });
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

      addLog("TX", "Sending register() transaction...", "info");
      const hash = await walletClient.writeContract({
        address: identityRegistry as `0x${string}`,
        abi: identityRegistryAbi,
        functionName: "register",
        args: ["ipfs://demo-agent"],
      });

      addLog("TX", `Waiting for confirmation: ${hash.slice(0, 10)}...`, "info");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse Transfer event to get agentId
      const transferLogs = parseEventLogs({
        abi: identityRegistryAbi,
        logs: receipt.logs,
        eventName: "Transfer",
      });

      if (transferLogs.length > 0) {
        const agentId = (transferLogs[0] as any).args.tokenId as bigint;
        dispatch({ type: "SET_AGENT", agent: { id: agentId, isRegistered: true } });
        addLog("REGISTER", `Agent #${agentId.toString()} registered successfully`, "pass");
        setStep("approve");
      } else {
        throw new Error("Transfer event not found in receipt");
      }
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "Registration failed";
      setError(msg);
      addLog("REGISTER", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [wallet, identityRegistry, dispatch, addLog]);

  const approveValidator = useCallback(async () => {
    if (!wallet.address || !identityRegistry || !worldIdValidator || !agent.id) return;
    setLoading(true);
    setError(null);
    try {
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom((window as any).ethereum),
      });
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

      addLog("TX", `Approving WorldIDValidator for agent #${agent.id.toString()}...`, "info");
      const hash = await walletClient.writeContract({
        address: identityRegistry as `0x${string}`,
        abi: identityRegistryAbi,
        functionName: "approve",
        args: [worldIdValidator as `0x${string}`, agent.id],
      });

      addLog("TX", `Waiting for confirmation: ${hash.slice(0, 10)}...`, "info");
      await publicClient.waitForTransactionReceipt({ hash });

      dispatch({ type: "SET_AGENT", agent: { isApproved: true } });
      addLog("APPROVE", "WorldIDValidator approved for this agent", "pass");

      // Pre-load IDKit
      await loadIDKit();
      setIdkitReady(true);
      setStep("verify");
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "Approval failed";
      setError(msg);
      addLog("APPROVE", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [wallet, identityRegistry, worldIdValidator, agent.id, dispatch, addLog]);

  const handleWorldIDVerify = useCallback(async (result: any) => {
    if (!wallet.address || !worldIdValidator || !agent.id) return;
    setLoading(true);
    setError(null);
    try {
      const walletClient = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom((window as any).ethereum),
      });
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

      const unpackedProof = decodeAbiParameters(
        [{ type: "uint256[8]" }],
        result.proof as `0x${string}`
      )[0];
      const root = BigInt(result.merkle_root);
      const nullifierHash = BigInt(result.nullifier_hash);

      addLog("WORLD ID", "Sending verifyAndSetHumanTag() transaction...", "info");
      const hash = await walletClient.writeContract({
        address: worldIdValidator as `0x${string}`,
        abi: worldIdValidatorAbi,
        functionName: "verifyAndSetHumanTag",
        args: [agent.id, root, nullifierHash, unpackedProof],
        gas: 2000000n,
      });

      addLog("TX", `Waiting for confirmation: ${hash.slice(0, 10)}...`, "info");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        dispatch({ type: "SET_AGENT", agent: { isHumanVerified: true } });
        addLog("WORLD ID", "Human verification tag set on-chain!", "pass");
        setStep("request");
      } else {
        throw new Error("Transaction reverted");
      }
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "Verification failed";
      setError(msg);
      addLog("WORLD ID", msg, "fail");
    } finally {
      setLoading(false);
      setShowIDKit(false);
    }
  }, [wallet, worldIdValidator, agent.id, dispatch, addLog]);

  const requestAccess = useCallback(async () => {
    // Trigger the verified-agent simulation with real agent data
    dispatch({ type: "SET_SCENARIO", scenario: "try-it" });
    dispatch({ type: "SET_RUNNING", isRunning: true });

    addLog("DEMO", `Running pipeline simulation for agent #${agent.id?.toString() || "?"}...`, "info");

    try {
      const resp = await fetch(`/api/simulate?scenario=verified-agent`);
      const reader = resp.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "done") {
            dispatch({ type: "SET_RUNNING", isRunning: false });
            setStep("generate");
            return;
          }
          if (data.type === "step") {
            dispatch({ type: "UPDATE_STEP", stepId: data.stepId, status: data.status, detail: data.detail, timing: data.timing });
          }
          if (data.type === "terminal") {
            dispatch({ type: "ADD_TERMINAL", entry: { tag: data.tag, message: data.message, status: data.termStatus, timestamp: Date.now() } });
          }
          if (data.type === "result") {
            dispatch({ type: "SET_RESULT", result: data.result });
          }
          if (data.skipAfter) {
            dispatch({ type: "SKIP_REMAINING", afterStepId: data.skipAfter });
          }
        }
      }
    } catch (err: any) {
      addLog("ERROR", err.message || "Simulation failed", "fail");
    }
    dispatch({ type: "SET_RUNNING", isRunning: false });
  }, [agent.id, dispatch, addLog]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !wallet.address || !agent.id) return;
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_GENERATING", isGenerating: true });
    dispatch({ type: "SET_RUNNING", isRunning: true });

    addLog("GENERATE", `Requesting image: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`, "info");

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          agentId: agent.id.toString(),
          ownerAddress: wallet.address,
        }),
      });

      const reader = resp.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "done") {
            dispatch({ type: "SET_RUNNING", isRunning: false });
            dispatch({ type: "SET_GENERATING", isGenerating: false });
            setStep("done");
            return;
          }
          if (data.type === "step") {
            dispatch({ type: "UPDATE_STEP", stepId: data.stepId, status: data.status, detail: data.detail, timing: data.timing });
          }
          if (data.type === "terminal") {
            dispatch({ type: "ADD_TERMINAL", entry: { tag: data.tag, message: data.message, status: data.termStatus, timestamp: Date.now() } });
          }
          if (data.type === "result") {
            if (data.status === "granted" && data.imageUrl) {
              dispatch({
                type: "SET_GENERATION",
                generation: {
                  id: data.id,
                  imageUrl: data.imageUrl,
                  prompt: data.prompt,
                  agentId: data.agentId,
                  ownerAddress: data.ownerAddress,
                  timestamp: data.timestamp,
                },
              });
              dispatch({ type: "SET_RESULT", result: { granted: true, accountableHuman: data.ownerAddress, tier: 2 } });
            } else {
              dispatch({ type: "SET_RESULT", result: { granted: false, reason: data.reason || "Generation failed" } });
            }
          }
        }
      }
    } catch (err: any) {
      addLog("ERROR", err.message || "Generation failed", "fail");
      dispatch({ type: "SET_RESULT", result: { granted: false, reason: err.message || "Generation failed" } });
    }
    dispatch({ type: "SET_RUNNING", isRunning: false });
    dispatch({ type: "SET_GENERATING", isGenerating: false });
    setStep("done");
  }, [prompt, wallet.address, agent.id, dispatch, addLog]);

  const flowSteps: { key: FlowStep; label: string; num: number }[] = [
    { key: "connect", label: "Connect", num: 1 },
    { key: "register", label: "Register", num: 2 },
    { key: "approve", label: "Approve", num: 3 },
    { key: "verify", label: "Verify", num: 4 },
    { key: "request", label: "Pipeline", num: 5 },
    { key: "generate", label: "Generate", num: 6 },
  ];

  const currentIdx = flowSteps.findIndex(f => f.key === step);

  return (
    <div style={{
      padding: mobile ? "16px" : "24px 20px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: t.blue, textTransform: "uppercase" }}>
        Try It Yourself
      </span>

      {/* Progress steps */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {flowSteps.map((fs, i) => (
          <div key={fs.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 12, fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i < currentIdx ? t.green : i === currentIdx ? t.blue : `${t.cardBorder}60`,
              color: i <= currentIdx ? "#fff" : t.inkMuted,
              transition: "all .3s",
            }}>
              {i < currentIdx ? "\u2713" : fs.num}
            </div>
            {i < flowSteps.length - 1 && (
              <div style={{
                width: mobile ? 8 : 16, height: 2,
                background: i < currentIdx ? t.green : t.cardBorder,
                transition: "background .3s",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Current step action */}
      <div style={{
        padding: "16px", borderRadius: 10,
        border: `1.5px solid ${t.cardBorder}`,
        background: `${t.card}CC`,
      }}>
        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 12,
            background: `${t.red}15`, border: `1px solid ${t.red}30`,
            fontSize: 12, color: t.red,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{
              background: "none", border: "none", color: t.red, cursor: "pointer",
              fontSize: 14, fontWeight: 700, padding: "0 4px", opacity: 0.7,
            }}>{"\u00D7"}</button>
          </div>
        )}

        {step === "connect" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Connect Your Wallet</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Connect a wallet with Base Sepolia ETH to register an agent.
            </div>
            <Btn primary small onClick={connectWallet} disabled={loading}>
              {loading ? "Connecting..." : "Connect Wallet"}
            </Btn>
          </div>
        )}

        {step === "register" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Register Agent</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Mint an ERC-8004 identity NFT for your agent.
            </div>
            <Btn primary small onClick={registerAgent} disabled={loading}>
              {loading ? "Registering..." : "Register Agent"}
            </Btn>
          </div>
        )}

        {step === "approve" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Approve WorldID Validator</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Approve the WorldIDValidator to set the human verification tag on agent #{agent.id?.toString()}.
            </div>
            <Btn primary small onClick={approveValidator} disabled={loading}>
              {loading ? "Approving..." : "Approve Validator"}
            </Btn>
          </div>
        )}

        {step === "verify" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Verify with World ID</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Prove you are a unique human using World ID zero-knowledge proof.
            </div>
            {idkitReady && IDKitWidget ? (
              <>
                <IDKitWidget
                  app_id={WORLD_ID_APP}
                  action={`${WORLD_ID_ACTION_PREFIX}${agent.id?.toString() || "0"}`}
                  handleVerify={handleWorldIDVerify}
                  verification_level={VerificationLevel.Device}
                  signal={wallet.address || "0x0"}
                >
                  {({ open }: { open: () => void }) => (
                    <Btn primary small onClick={() => { setShowIDKit(true); open(); }} disabled={loading}>
                      {loading ? "Verifying..." : "Open World ID"}
                    </Btn>
                  )}
                </IDKitWidget>
              </>
            ) : (
              <Btn primary small onClick={async () => { await loadIDKit(); setIdkitReady(true); }} disabled={loading}>
                {loading ? "Loading..." : "Load World ID Widget"}
              </Btn>
            )}
          </div>
        )}

        {step === "request" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Request Access</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Your agent #{agent.id?.toString()} is fully verified. Run it through the pipeline.
            </div>
            <Btn primary small onClick={requestAccess} disabled={loading}>
              {loading ? "Running..." : "Run Pipeline"}
            </Btn>
          </div>
        )}

        {step === "generate" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: t.green }}>Pipeline Passed</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
              Agent #{agent.id?.toString()} cleared all gates. Now generate an image — it will be permanently tagged with a license plate.
            </div>
            <input
              type="text"
              value={prompt}
              onChange={(e) => dispatch({ type: "SET_PROMPT", prompt: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !isGenerating) handleGenerate(); }}
              placeholder="Describe an image..."
              disabled={isGenerating}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                border: `1.5px solid ${t.cardBorder}`, background: `${t.bg}CC`, color: t.ink,
                outline: "none", fontFamily: "inherit", marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <Btn primary small onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? "Generating..." : "Generate Image"}
            </Btn>
          </div>
        )}

        {step === "done" && (
          <div>
            {generation ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.green }}>Image Generated</div>
                <div style={{
                  borderRadius: 8, overflow: "hidden", marginBottom: 12,
                  border: `1.5px solid ${t.cardBorder}`,
                }}>
                  <img
                    src={generation.imageUrl}
                    alt={generation.prompt}
                    style={{ width: "100%", display: "block" }}
                  />
                </div>
                {/* License plate receipt */}
                <div style={{
                  padding: "10px 12px", borderRadius: 8, fontSize: 11,
                  fontFamily: "'SF Mono','Fira Code',monospace",
                  background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}40`,
                  color: t.inkMuted, lineHeight: 1.7, marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, color: t.blue, marginBottom: 4, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>License Plate</div>
                  <div>id: <span style={{ color: t.ink }}>{generation.id.slice(0, 8)}...</span></div>
                  <div>agent: <span style={{ color: t.blue }}>#{generation.agentId}</span></div>
                  <div>owner: <span style={{ color: t.ink }}>{generation.ownerAddress.slice(0, 6)}...{generation.ownerAddress.slice(-4)}</span></div>
                  <div>prompt: <span style={{ color: t.ink }}>{generation.prompt.slice(0, 50)}{generation.prompt.length > 50 ? "..." : ""}</span></div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn small href="/feed" style={{ fontSize: 12 }}>View on Feed</Btn>
                  <Btn small onClick={() => {
                    dispatch({ type: "SET_GENERATION", generation: undefined });
                    dispatch({ type: "SET_PROMPT", prompt: "" });
                    dispatch({ type: "RESET_PIPELINE" });
                    setStep("generate");
                  }} style={{ fontSize: 12 }}>
                    Generate Another
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: t.green }}>Pipeline Complete</div>
                <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5, marginBottom: 16 }}>
                  Agent #{agent.id?.toString()} passed all gates. Check the pipeline visualization above.
                </div>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <Btn small onClick={() => {
                setStep("connect");
                setError(null);
                setIdentityRegistry(null);
                setWorldIdValidator(null);
                setIdkitReady(false);
                dispatch({ type: "RESET_PIPELINE" });
                dispatch({ type: "SET_WALLET", wallet: { connected: false } });
                dispatch({ type: "SET_AGENT", agent: { id: undefined, isRegistered: false, isApproved: false, isHumanVerified: false } });
              }} style={{ fontSize: 12 }}>
                Start Over
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Agent status summary */}
      {wallet.connected && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: `${t.card}80`, border: `1px solid ${t.cardBorder}40`,
          fontSize: 11, fontFamily: "monospace", color: t.inkMuted,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div>wallet: <span style={{ color: t.ink }}>{wallet.address?.slice(0, 10)}...</span></div>
          {agent.id !== undefined && <div>agentId: <span style={{ color: t.blue }}>#{agent.id.toString()}</span></div>}
          <div>registered: <span style={{ color: agent.isRegistered ? t.green : t.red }}>{agent.isRegistered ? "yes" : "no"}</span></div>
          <div>approved: <span style={{ color: agent.isApproved ? t.green : t.red }}>{agent.isApproved ? "yes" : "no"}</span></div>
          <div>humanVerified: <span style={{ color: agent.isHumanVerified ? t.green : t.red }}>{agent.isHumanVerified ? "yes" : "no"}</span></div>
        </div>
      )}
    </div>
  );
}
