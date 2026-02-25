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

type FlowStep =
  // Phase 1 — Owner Setup
  | "connect" | "register" | "approve" | "verify" | "agent-ready"
  // Phase 2 — Watch Your Agent
  | "prompt" | "watching" | "done";

const PHASE1_STEPS = [
  { key: "connect" as const, label: "Connect" },
  { key: "register" as const, label: "Register" },
  { key: "approve" as const, label: "Approve" },
  { key: "verify" as const, label: "Verify" },
];

const PHASE2_STEPS = [
  { key: "prompt" as const, label: "Prompt" },
  { key: "watching" as const, label: "Agent" },
  { key: "done" as const, label: "Done" },
];

function isPhase2(step: FlowStep) {
  return step === "agent-ready" || step === "prompt" || step === "watching" || step === "done";
}

export function TryItFlow({ dispatch, wallet, agent, prompt, isGenerating, generation }: {
  dispatch: Dispatch<DemoAction>;
  wallet: { connected: boolean; address?: string };
  agent: { id?: bigint; isRegistered: boolean; isApproved: boolean; isHumanVerified: boolean; agentWallet?: string; agentFunded?: boolean };
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

  const [identityRegistry, setIdentityRegistry] = useState<string | null>(null);
  const [worldIdValidator, setWorldIdValidator] = useState<string | null>(null);

  const addLog = useCallback((tag: string, message: string, status: TerminalEntry['status']) => {
    dispatch({ type: "ADD_TERMINAL", entry: { tag, message, status, timestamp: Date.now() } });
  }, [dispatch]);

  // ── Phase 1: Connect Wallet ──
  const connectWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!(window as any).ethereum) throw new Error("No wallet detected. Install MetaMask.");
      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });

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
      const { tieredPolicyAbi } = await import("@whitewall-os/sdk");
      const policyAddr = addresses.baseSepolia.tieredPolicy;

      const [idReg, validator] = await Promise.all([
        publicClient.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getIdentityRegistry" }),
        publicClient.readContract({ address: policyAddr, abi: tieredPolicyAbi, functionName: "getWorldIdValidator" }),
      ]);
      setIdentityRegistry(idReg as string);
      setWorldIdValidator(validator as string);
      addLog("SDK", `Policy loaded: registry=${(idReg as string).slice(0, 10)}...`, "pass");

      setStep("register");
    } catch (err: any) {
      setError(err.message || "Connection failed");
      addLog("WALLET", err.message || "Connection failed", "fail");
    } finally {
      setLoading(false);
    }
  }, [dispatch, addLog]);

  // ── Phase 1: Register Agent ──
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

      const transferLogs = parseEventLogs({
        abi: identityRegistryAbi,
        logs: receipt.logs,
        eventName: "Transfer",
      });

      if (transferLogs.length > 0) {
        const agentId = (transferLogs[0] as any).args.tokenId as bigint;
        dispatch({ type: "SET_AGENT", agent: { id: agentId, isRegistered: true } });
        addLog("REGISTER", `Agent #${agentId.toString()} registered (ERC-8004 NFT minted)`, "pass");
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

  // ── Phase 1: Approve Validator ──
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

  // ── Phase 1: World ID Verify + Auto Agent Wallet ──
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

        // Auto: Create agent wallet + fund with USDC
        addLog("AGENT", "Creating autonomous agent wallet...", "info");
        try {
          const walletResp = await fetch("/api/agent-wallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: agent.id.toString(), ownerAddress: wallet.address }),
          });
          const walletData = await walletResp.json();
          if (walletResp.ok) {
            dispatch({ type: "SET_AGENT", agent: { agentWallet: walletData.address, agentFunded: walletData.funded } });
            addLog("AGENT", `Agent wallet created: ${walletData.address.slice(0, 10)}...`, "pass");
            if (walletData.funded) {
              addLog("FAUCET", `${walletData.amount} USDC funded to agent wallet (tx: ${walletData.txHash?.slice(0, 10)}...)`, "pass");
            } else {
              addLog("FAUCET", "USDC funding unavailable \u2014 agent wallet created without balance", "warn");
            }
          } else {
            addLog("AGENT", `Wallet creation failed: ${walletData.error}`, "warn");
          }
        } catch {
          addLog("AGENT", "Wallet creation unavailable \u2014 continuing without autonomous wallet", "warn");
        }

        setStep("agent-ready");
      } else {
        throw new Error("Transaction reverted");
      }
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "Verification failed";
      setError(msg);
      addLog("WORLD ID", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [wallet, worldIdValidator, agent.id, dispatch, addLog]);

  // ── Phase 2: Send prompt to agent ──
  const handleSendToAgent = useCallback(async () => {
    if (!prompt.trim() || !wallet.address || !agent.id) return;
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_GENERATING", isGenerating: true });
    dispatch({ type: "SET_RUNNING", isRunning: true });
    setStep("watching");

    try {
      const resp = await fetch("/api/agent-generate", {
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

  // ── Reset ──
  const handleStartOver = useCallback(() => {
    setStep("connect");
    setError(null);
    setIdentityRegistry(null);
    setWorldIdValidator(null);
    setIdkitReady(false);
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_WALLET", wallet: { connected: false } });
    dispatch({ type: "SET_AGENT", agent: { id: undefined, isRegistered: false, isApproved: false, isHumanVerified: false, agentWallet: undefined, agentFunded: undefined } });
  }, [dispatch]);

  // Determine phase
  const phase2Active = isPhase2(step);
  const phase1Idx = PHASE1_STEPS.findIndex(s => s.key === step);
  const phase2Idx = PHASE2_STEPS.findIndex(s => s.key === step);

  return (
    <div style={{
      padding: mobile ? "16px" : "24px 20px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* ── Phase 1 Header + Progress ── */}
      <div>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
          color: phase2Active ? t.green : t.blue,
        }}>
          {phase2Active ? "\u2713 Phase 1: Owner Setup" : "Phase 1: Owner Setup"}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
          {PHASE1_STEPS.map((fs, i) => (
            <div key={fs.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: phase2Active || i < phase1Idx ? t.green : i === phase1Idx ? t.blue : `${t.cardBorder}60`,
                color: phase2Active || i <= phase1Idx ? "#fff" : t.inkMuted,
                transition: "all .3s",
              }}>
                {phase2Active || i < phase1Idx ? "\u2713" : i + 1}
              </div>
              {i < PHASE1_STEPS.length - 1 && (
                <div style={{
                  width: mobile ? 6 : 12, height: 2,
                  background: phase2Active || i < phase1Idx ? t.green : t.cardBorder,
                  transition: "background .3s",
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Phase 2 Header + Progress ── */}
      {phase2Active && (
        <div>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
            color: step === "done" ? t.green : t.blue,
          }}>
            {step === "done" ? "\u2713 Phase 2: Your Agent" : "Phase 2: Your Agent"}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
            {PHASE2_STEPS.map((fs, i) => (
              <div key={fs.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 10, fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < phase2Idx ? t.green : i === phase2Idx ? t.blue : `${t.cardBorder}60`,
                  color: i <= phase2Idx ? "#fff" : t.inkMuted,
                  transition: "all .3s",
                }}>
                  {i < phase2Idx ? "\u2713" : i + 1}
                </div>
                {i < PHASE2_STEPS.length - 1 && (
                  <div style={{
                    width: mobile ? 6 : 12, height: 2,
                    background: i < phase2Idx ? t.green : t.cardBorder,
                    transition: "background .3s",
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Current Step Card ── */}
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

        {/* Phase 1: Connect */}
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

        {/* Phase 1: Register */}
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

        {/* Phase 1: Approve */}
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

        {/* Phase 1: Verify */}
        {step === "verify" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Verify with World ID</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Prove you are a unique human. After verification, an agent wallet will be created and funded automatically.
            </div>
            {idkitReady && IDKitWidget ? (
              <IDKitWidget
                app_id={WORLD_ID_APP}
                action={`${WORLD_ID_ACTION_PREFIX}${agent.id?.toString() || "0"}`}
                handleVerify={handleWorldIDVerify}
                verification_level={VerificationLevel.Device}
                signal={wallet.address || "0x0"}
              >
                {({ open }: { open: () => void }) => (
                  <Btn primary small onClick={open} disabled={loading}>
                    {loading ? "Verifying..." : "Open World ID"}
                  </Btn>
                )}
              </IDKitWidget>
            ) : (
              <Btn primary small onClick={async () => { await loadIDKit(); setIdkitReady(true); }} disabled={loading}>
                {loading ? "Loading..." : "Load World ID Widget"}
              </Btn>
            )}
          </div>
        )}

        {/* Phase 1 Complete → Agent Ready */}
        {step === "agent-ready" && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              color: t.green, marginBottom: 10,
            }}>
              Agent Ready
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
              Agent #{agent.id?.toString()} is set up
            </div>
            <div style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 11,
              fontFamily: "'SF Mono','Fira Code',monospace",
              background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}40`,
              color: t.inkMuted, lineHeight: 1.8, marginBottom: 14,
            }}>
              <div>owner: <span style={{ color: t.ink }}>{wallet.address?.slice(0, 10)}...</span></div>
              <div>agentId: <span style={{ color: t.blue }}>#{agent.id?.toString()}</span></div>
              <div>humanVerified: <span style={{ color: t.green }}>true</span></div>
              {agent.agentWallet && (
                <div>agentWallet: <span style={{ color: t.ink }}>{agent.agentWallet.slice(0, 10)}...</span></div>
              )}
              <div>balance: <span style={{ color: agent.agentFunded ? t.green : t.red }}>
                {agent.agentFunded ? "1.00 USDC" : "0 USDC"}
              </span></div>
            </div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Your agent has its own wallet and can pay for resources autonomously via x402.
              Enter a prompt and watch it operate.
            </div>
            <Btn primary small onClick={() => {
              dispatch({ type: "RESET_PIPELINE" });
              dispatch({ type: "CLEAR_TERMINAL" });
              setStep("prompt");
            }}>
              Enter Phase 2
            </Btn>
          </div>
        )}

        {/* Phase 2: Prompt */}
        {step === "prompt" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Send Task to Agent</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
              Your agent will autonomously pay via x402 and generate an image.
              No MetaMask popups {"\u2014"} the agent signs with its own key.
            </div>
            <input
              type="text"
              value={prompt}
              onChange={(e) => dispatch({ type: "SET_PROMPT", prompt: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !isGenerating) handleSendToAgent(); }}
              placeholder="Describe an image..."
              disabled={isGenerating}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                border: `1.5px solid ${t.cardBorder}`, background: `${t.bg}CC`, color: t.ink,
                outline: "none", fontFamily: "inherit", marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <Btn primary small onClick={handleSendToAgent} disabled={isGenerating || !prompt.trim()}>
              Send to Agent
            </Btn>
          </div>
        )}

        {/* Phase 2: Watching */}
        {step === "watching" && (
          <div>
            <div style={{
              fontSize: 14, fontWeight: 700, marginBottom: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: 4,
                background: t.blue, animation: "demoPulse 1.5s ease-in-out infinite",
              }} />
              Agent Operating
            </div>
            <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5 }}>
              Agent #{agent.id?.toString()} is paying via x402 and generating autonomously. Watch the pipeline and terminal.
            </div>
          </div>
        )}

        {/* Phase 2: Done */}
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
                  <div>payment: <span style={{ color: t.green }}>$0.10 USDC (x402)</span></div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn small href="/feed" style={{ fontSize: 12 }}>View on Feed</Btn>
                  <Btn small onClick={() => {
                    dispatch({ type: "SET_GENERATION", generation: undefined });
                    dispatch({ type: "SET_PROMPT", prompt: "" });
                    dispatch({ type: "RESET_PIPELINE" });
                    dispatch({ type: "CLEAR_TERMINAL" });
                    setStep("prompt");
                  }} style={{ fontSize: 12 }}>
                    Send Another
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: t.green }}>Pipeline Complete</div>
                <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5, marginBottom: 16 }}>
                  Agent #{agent.id?.toString()} completed its task. Check the pipeline above.
                </div>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <Btn small onClick={handleStartOver} style={{ fontSize: 12 }}>
                Start Over
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Agent status summary */}
      {wallet.connected && !phase2Active && (
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
