"use client";

import { useContext, useState, useCallback, useEffect, type Dispatch } from "react";
import { ThemeCtx, Btn } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { TryoutAction, TryoutState, TerminalEntry, GenerationResult } from "./types";
import { getPersistedStep, clearPersistedState } from "./types";

// Lazy-loaded IDKit
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

// Plaid Link component
function PlaidLinkButton({ token, onSuccess, onExit }: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}) {
  const { usePlaidLink } = require("react-plaid-link");
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken: string) => onSuccess(publicToken),
    onExit: () => onExit(),
  });
  useEffect(() => { if (ready) open(); }, [ready, open]);
  return null;
}

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
import {
  VALIDATION_REGISTRY_ADDRESS,
  validationRequestAbi,
  computeRequestHash,
} from "@/lib/contracts";

const WORLD_ID_APP = "app_staging_dae27f9b14a30e0e0917797aceac795a";
const WORLD_ID_ACTION_PREFIX = "verify-owner-";

/* ── Flow steps per phase ── */

type FlowStep =
  // Phase 1
  | "connect" | "register" | "approve" | "verify" | "bootstrapping" | "agent-ready"
  // Phase 2
  | "prompt" | "watching" | "image-done"
  // Phase 3
  | "kyc" | "credit" | "video-prompt" | "video-watching" | "done";

const PHASE1_STEPS = [
  { key: "connect" as const, label: "Connect" },
  { key: "register" as const, label: "Register" },
  { key: "approve" as const, label: "Approve" },
  { key: "verify" as const, label: "Verify" },
];

const PHASE2_STEPS = [
  { key: "prompt" as const, label: "Prompt" },
  { key: "watching" as const, label: "Agent" },
  { key: "image-done" as const, label: "Done" },
];

const PHASE3_STEPS = [
  { key: "kyc" as const, label: "KYC" },
  { key: "credit" as const, label: "Credit" },
  { key: "video-prompt" as const, label: "Video" },
  { key: "done" as const, label: "Done" },
];

function stepPhase(step: FlowStep): 1 | 2 | 3 {
  if (["connect", "register", "approve", "verify", "bootstrapping", "agent-ready"].includes(step)) return 1;
  if (["prompt", "watching", "image-done"].includes(step)) return 2;
  return 3;
}

export function TryoutFlow({
  dispatch,
  state,
}: {
  dispatch: Dispatch<TryoutAction>;
  state: TryoutState;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [step, setStepRaw] = useState<FlowStep>(() => {
    const persisted = getPersistedStep();
    // Map removed steps to their replacements
    const mapped = persisted === "tier-polling" ? "credit" : persisted;
    if (mapped && state.agent.id) return mapped as FlowStep;
    return "connect";
  });
  const setStep = useCallback((s: FlowStep) => {
    setStepRaw(s);
    (window as any).__wwTryoutStep = s;
  }, []);
  // Sync initial step to window for persistence
  useEffect(() => { (window as any).__wwTryoutStep = step; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idkitReady, setIdkitReady] = useState(false);

  const [identityRegistry, setIdentityRegistry] = useState<string | null>(null);
  const [worldIdValidator, setWorldIdValidator] = useState<string | null>(null);

  // KYC/Credit local state
  const [kycSessionId, setKycSessionId] = useState<string | null>(null);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);

  // Agent wallet balance
  const [agentBalance, setAgentBalance] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);

  const { wallet, agent, prompt, isGenerating, generation, videoGeneration, tierData } = state;

  const addLog = useCallback((tag: string, message: string, status: TerminalEntry["status"]) => {
    dispatch({ type: "ADD_TERMINAL", entry: { tag, message, status, timestamp: Date.now() } });
  }, [dispatch]);

  // Check agent wallet USDC balance
  const checkAgentBalance = useCallback(async () => {
    if (!agent.agentWallet) return;
    try {
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
      const bal = await publicClient.readContract({
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
        abi: [{ type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }] as const,
        functionName: "balanceOf",
        args: [agent.agentWallet as `0x${string}`],
      });
      setAgentBalance((Number(bal) / 1e6).toFixed(2));
    } catch {
      // silent
    }
  }, [agent.agentWallet]);

  // Fund agent wallet via faucet
  const fundAgentWallet = useCallback(async () => {
    if (!agent.agentWallet || !agent.id || !wallet.address) return;
    setIsFunding(true);
    setError(null);
    addLog("FAUCET", "Requesting USDC top-up for agent wallet...", "info");
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: wallet.address,
          agentId: agent.id.toString(),
          agentWallet: agent.agentWallet,
        }),
      });
      const data = await res.json();
      if (data.skipped && data.balance) {
        setAgentBalance(parseFloat(data.balance).toFixed(2));
        addLog("FAUCET", `Agent already has ${data.balance} USDC`, "pass");
      } else if (data.success) {
        addLog("FAUCET", `${data.amount} USDC funded (tx: ${data.txHash?.slice(0, 10)}...)`, "pass");
        await checkAgentBalance();
      } else if (data.error) {
        addLog("FAUCET", data.error, "warn");
        setError(data.error);
      }
    } catch (err: any) {
      addLog("FAUCET", err.message || "Funding failed", "fail");
      setError(err.message || "Funding failed");
    } finally {
      setIsFunding(false);
    }
  }, [agent.agentWallet, agent.id, wallet.address, addLog, checkAgentBalance]);

  // Auto-check balance when entering prompt, video-prompt, or agent-ready steps
  useEffect(() => {
    if ((step === "prompt" || step === "video-prompt" || step === "agent-ready") && agent.agentWallet) {
      checkAgentBalance();
    }
  }, [step, agent.agentWallet, checkAgentBalance]);

  /* ═══════════════════════════════════════════════════════
     Phase 1: Owner Setup (same as TryItFlow)
     ═══════════════════════════════════════════════════════ */

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
        dispatch({ type: "SET_TIER_DATA", tierData: { registered: true, effectiveTier: 1, txHashes: { ...tierData.txHashes, register: hash } } });
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
  }, [wallet, identityRegistry, dispatch, addLog, tierData.txHashes]);

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
      dispatch({ type: "SET_TIER_DATA", tierData: { txHashes: { ...tierData.txHashes, approve: hash } } });
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
  }, [wallet, identityRegistry, worldIdValidator, agent.id, dispatch, addLog, tierData.txHashes]);

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
        dispatch({ type: "SET_TIER_DATA", tierData: { humanVerified: true, effectiveTier: 2, txHashes: { ...tierData.txHashes, worldId: hash } } });
        addLog("WORLD ID", "Human verification tag set on-chain!", "pass");

        // Auto: Create agent wallet + fund with USDC
        setStep("bootstrapping");
        addLog("AGENT", "Creating autonomous agent wallet...", "info");
        try {
          let walletResp: Response | null = null;
          let walletData: any = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            if (attempt > 0) {
              addLog("AGENT", `Waiting for on-chain sync (attempt ${attempt + 1}/4)...`, "info");
              await new Promise((r) => setTimeout(r, 3000));
            }
            walletResp = await fetch("/api/agent-wallet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: agent.id.toString(), ownerAddress: wallet.address }),
            });
            walletData = await walletResp.json();
            if (walletResp.ok || walletResp.status !== 403) break;
          }
          if (walletResp?.ok && walletData) {
            dispatch({ type: "SET_AGENT", agent: { agentWallet: walletData.address, agentFunded: walletData.funded } });
            addLog("AGENT", `Agent wallet created: ${walletData.address.slice(0, 10)}...`, "pass");
            if (walletData.funded) {
              addLog("FAUCET", `${walletData.amount} USDC funded to agent wallet (tx: ${walletData.txHash?.slice(0, 10)}...)`, "pass");
            } else {
              addLog("FAUCET", "USDC funding unavailable \u2014 agent wallet created without balance", "warn");
            }
          } else {
            addLog("AGENT", `Wallet creation failed: ${walletData?.error || "Unknown error"}`, "warn");
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
  }, [wallet, worldIdValidator, agent.id, dispatch, addLog, tierData.txHashes]);

  /* ═══════════════════════════════════════════════════════
     Phase 2: Image generation
     ═══════════════════════════════════════════════════════ */

  const handleSendToAgent = useCallback(async (genType: "image" | "video" = "image") => {
    if (!prompt.trim() || !wallet.address || !agent.id) return;
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_GENERATING", isGenerating: true });
    dispatch({ type: "SET_RUNNING", isRunning: true });
    setStep(genType === "video" ? "video-watching" : "watching");

    try {
      const resp = await fetch("/api/agent-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          agentId: agent.id.toString(),
          ownerAddress: wallet.address,
          type: genType,
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
            setStep(genType === "video" ? "done" : "image-done");
            return;
          }
          if (data.type === "step") {
            dispatch({ type: "UPDATE_STEP", stepId: data.stepId, status: data.status, detail: data.detail, timing: data.timing });
          }
          if (data.type === "terminal") {
            dispatch({ type: "ADD_TERMINAL", entry: { tag: data.tag, message: data.message, status: data.termStatus, timestamp: Date.now() } });
          }
          if (data.type === "result") {
            if (data.status === "granted" && (data.imageUrl || data.videoUrl)) {
              const gen: GenerationResult = {
                id: data.id,
                imageUrl: data.imageUrl || data.videoUrl,
                prompt: data.prompt,
                agentId: data.agentId,
                ownerAddress: data.ownerAddress,
                timestamp: data.timestamp,
              };
              if (genType === "video") {
                dispatch({ type: "SET_VIDEO_GENERATION", generation: gen });
              } else {
                dispatch({ type: "SET_GENERATION", generation: gen });
              }
              dispatch({ type: "SET_RESULT", result: { granted: true, accountableHuman: data.ownerAddress, tier: data.tier ?? tierData.effectiveTier } });
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
    setStep(genType === "video" ? "done" : "image-done");
    // Refresh balance after generation (USDC was spent)
    checkAgentBalance();
  }, [prompt, wallet.address, agent.id, dispatch, addLog, checkAgentBalance]);

  /* ═══════════════════════════════════════════════════════
     Phase 3: KYC + Credit + Video
     ═══════════════════════════════════════════════════════ */

  const startKYC = useCallback(async () => {
    if (!agent.id || !wallet.address) return;
    setLoading(true);
    setError(null);
    dispatch({ type: "SET_KYC_STATUS", status: "creating" });

    try {
      // Create Stripe Identity session
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); dispatch({ type: "SET_KYC_STATUS", status: "error" }); setLoading(false); return; }

      setKycSessionId(data.sessionId);
      addLog("KYC", `Stripe session created: ${data.sessionId.slice(0, 16)}...`, "info");

      // Open Stripe Identity modal
      const { loadStripe } = await import("@stripe/stripe-js");
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pk) { setError("Stripe publishable key not configured"); dispatch({ type: "SET_KYC_STATUS", status: "error" }); setLoading(false); return; }

      addLog("KYC", "Loading Stripe...", "info");
      const stripe = await loadStripe(pk);
      if (!stripe) { setError("Failed to load Stripe"); dispatch({ type: "SET_KYC_STATUS", status: "error" }); setLoading(false); return; }

      addLog("KYC", "Opening Stripe Identity modal...", "info");
      dispatch({ type: "SET_KYC_STATUS", status: "verifying" });

      const result = await stripe.verifyIdentity(data.clientSecret);
      addLog("KYC", `Stripe modal closed (error: ${result.error?.message || "none"})`, result.error ? "warn" : "pass");
      if (result.error) {
        console.warn("Stripe Identity:", result.error.message);
      }

      // On-chain validationRequest
      dispatch({ type: "SET_KYC_STATUS", status: "submitting" });
      addLog("KYC", "Submitting on-chain validation request...", "info");

      const requestURI = `stripe:${data.sessionId}`;
      const reqHash = computeRequestHash(requestURI);

      const walletClientInst = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom((window as any).ethereum),
      });
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

      const hash = await walletClientInst.writeContract({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationRequestAbi,
        functionName: "validationRequest",
        args: [
          addresses.baseSepolia.stripeKYCValidator as `0x${string}`,
          agent.id,
          requestURI,
          reqHash,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      dispatch({ type: "SET_TIER_DATA", tierData: { txHashes: { ...tierData.txHashes, kyc: hash } } });
      dispatch({ type: "SET_KYC_STATUS", status: "done" });
      addLog("KYC", `Validation request tx: ${hash.slice(0, 10)}... — waiting for CRE`, "pass");
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "KYC failed";
      setError(msg);
      dispatch({ type: "SET_KYC_STATUS", status: "error" });
      addLog("KYC", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [agent.id, wallet.address, dispatch, addLog, tierData.txHashes]);

  const startCredit = useCallback(async () => {
    if (!agent.id || !wallet.address) return;
    setLoading(true);
    setError(null);
    dispatch({ type: "SET_CREDIT_STATUS", status: "creating" });

    try {
      const res = await fetch("/api/plaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-link" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); dispatch({ type: "SET_CREDIT_STATUS", status: "error" }); setLoading(false); return; }

      setPlaidLinkToken(data.linkToken);
      dispatch({ type: "SET_CREDIT_STATUS", status: "linking" });
      addLog("CREDIT", "Plaid Link token created, opening modal...", "info");
    } catch (err: any) {
      const msg = err.message || "Credit link failed";
      setError(msg);
      dispatch({ type: "SET_CREDIT_STATUS", status: "error" });
      addLog("CREDIT", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [agent.id, wallet.address, dispatch, addLog]);

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    if (!agent.id || !wallet.address) return;
    setLoading(true);
    dispatch({ type: "SET_CREDIT_STATUS", status: "submitting" });
    addLog("CREDIT", "Bank connected, submitting on-chain validation request...", "info");

    try {
      const requestURI = `plaid:${publicToken}`;
      const reqHash = computeRequestHash(requestURI);

      const walletClientInst = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: baseSepolia,
        transport: custom((window as any).ethereum),
      });
      const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

      const hash = await walletClientInst.writeContract({
        address: VALIDATION_REGISTRY_ADDRESS,
        abi: validationRequestAbi,
        functionName: "validationRequest",
        args: [
          addresses.baseSepolia.plaidCreditValidator as `0x${string}`,
          agent.id,
          requestURI,
          reqHash,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      dispatch({ type: "SET_TIER_DATA", tierData: { txHashes: { ...tierData.txHashes, credit: hash } } });
      dispatch({ type: "SET_CREDIT_STATUS", status: "done" });
      addLog("CREDIT", `Validation request tx: ${hash.slice(0, 10)}... — waiting for CRE`, "pass");
    } catch (err: any) {
      const msg = err.shortMessage || err.message || "Credit validation failed";
      setError(msg);
      dispatch({ type: "SET_CREDIT_STATUS", status: "error" });
      addLog("CREDIT", msg, "fail");
    } finally {
      setLoading(false);
    }
  }, [agent.id, wallet.address, dispatch, addLog, tierData.txHashes]);

  const handlePlaidExit = useCallback(() => {
    if (state.creditStatus === "linking") {
      dispatch({ type: "SET_CREDIT_STATUS", status: "idle" });
      setPlaidLinkToken(null);
    }
  }, [state.creditStatus, dispatch]);

  // Tier polling — runs during KYC done, credit done, and late-phase steps
  const shouldPoll = agent.id && (
    (step === "kyc" && state.kycStatus === "done") ||
    (step === "credit" && state.creditStatus === "done") ||
    step === "video-prompt" ||
    step === "video-watching" ||
    step === "done"
  );

  useEffect(() => {
    if (!shouldPoll || !agent.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/bonding/status?agentId=${agent.id!.toString()}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;

        const chain = data.onChain;
        dispatch({
          type: "SET_TIER_DATA",
          tierData: {
            registered: chain.registered,
            humanVerified: chain.humanVerified,
            kycVerified: chain.kycVerified,
            hasCreditScore: chain.hasCreditScore,
            creditScore: chain.creditScore,
            effectiveTier: chain.effectiveTier,
            kycData: chain.kycData,
            creditData: chain.creditData,
            creditTxHash: chain.creditTxHash,
          },
        });

        if (step === "credit" && state.creditStatus === "done" && chain.effectiveTier >= 3 && !cancelled) {
          addLog("TIER", `Tier ${chain.effectiveTier} achieved!`, "pass");
          setStep("video-prompt");
        }
      } catch {
        // silent retry
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [shouldPoll, step, agent.id, state.creditStatus, dispatch, addLog, setStep]);

  /* ═══════════════════════════════════════════════════════
     Phase transitions
     ═══════════════════════════════════════════════════════ */

  const enterPhase2 = useCallback(() => {
    dispatch({ type: "SET_PHASE", phase: 2 });
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "CLEAR_TERMINAL" });
    setStep("prompt");
  }, [dispatch]);

  const enterPhase3 = useCallback(() => {
    dispatch({ type: "SET_PHASE", phase: 3 });
    dispatch({ type: "CLEAR_TERMINAL" });
    setStep("kyc");
  }, [dispatch]);

  const handleStartOver = useCallback(() => {
    clearPersistedState();
    setStep("connect");
    setError(null);
    setIdentityRegistry(null);
    setWorldIdValidator(null);
    setIdkitReady(false);
    setKycSessionId(null);
    setPlaidLinkToken(null);
    dispatch({ type: "RESET_ALL" });
  }, [dispatch, setStep]);

  /* ═══════════════════════════════════════════════════════
     Render helpers
     ═══════════════════════════════════════════════════════ */

  const currentPhase = stepPhase(step);

  const renderProgressBar = (steps: { key: string; label: string }[], currentKey: string, completed: boolean, label: string, phaseNum: number) => {
    const rawIdx = steps.findIndex((s) => s.key === currentKey);
    // If current step isn't in this phase's steps (e.g. "agent-ready" not in PHASE1_STEPS),
    // treat all steps as done if we're in this phase, otherwise show none active
    const idx = rawIdx === -1 ? (currentPhase === phaseNum ? steps.length : -1) : rawIdx;
    return (
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
          color: completed ? t.green : currentPhase === phaseNum ? t.blue : t.inkMuted,
        }}>
          {completed ? `\u2713 Phase ${phaseNum}: ${label}` : `Phase ${phaseNum}: ${label}`}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
          {steps.map((fs, i) => (
            <div key={fs.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: completed || i < idx ? t.green : i === idx && currentPhase === phaseNum ? t.blue : `${t.cardBorder}60`,
                color: completed || i <= idx ? "#fff" : t.inkMuted,
                transition: "all .3s",
              }}>
                {completed || i < idx ? "\u2713" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: mobile ? 6 : 12, height: 2,
                  background: completed || i < idx ? t.green : t.cardBorder,
                  transition: "background .3s",
                }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: mobile ? "16px" : "24px 20px",
      display: "flex", flexDirection: "column", gap: 12,
      position: "relative",
    }}>
      {/* Start Over icon */}
      {wallet.connected && step !== "connect" && (
        <button
          onClick={handleStartOver}
          title="Start Over"
          style={{
            position: "absolute", top: mobile ? 12 : 20, right: mobile ? 12 : 16,
            width: 28, height: 28, borderRadius: 6,
            border: `1px solid ${t.cardBorder}40`, background: `${t.card}80`,
            color: t.inkMuted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, lineHeight: 1,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${t.red}15`; e.currentTarget.style.color = t.red; e.currentTarget.style.borderColor = `${t.red}40`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${t.card}80`; e.currentTarget.style.color = t.inkMuted; e.currentTarget.style.borderColor = `${t.cardBorder}40`; }}
        >
          {"\u21BA"}
        </button>
      )}

      {/* Plaid Link auto-opener */}
      {state.creditStatus === "linking" && plaidLinkToken && (
        <PlaidLinkButton token={plaidLinkToken} onSuccess={handlePlaidSuccess} onExit={handlePlaidExit} />
      )}

      {/* ── Phase Progress Headers ── */}
      {renderProgressBar(PHASE1_STEPS, step, currentPhase > 1, "Setup", 1)}
      {currentPhase >= 2 && renderProgressBar(PHASE2_STEPS, step, currentPhase > 2, "T2 Access", 2)}
      {currentPhase >= 3 && renderProgressBar(PHASE3_STEPS, step, step === "done", "T3\u2013T4 Verify", 3)}

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

        {/* ═══ Phase 1: Connect ═══ */}
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

        {/* ═══ Phase 1: Register ═══ */}
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

        {/* ═══ Phase 1: Approve ═══ */}
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

        {/* ═══ Phase 1: Verify ═══ */}
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

        {/* ═══ Phase 1 Complete → Agent Ready ═══ */}
        {step === "bootstrapping" && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              color: t.blue, marginBottom: 10,
            }}>
              Setting Up Agent
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Bootstrapping Agent #{agent.id?.toString()}
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: 8,
              fontSize: 12, color: t.inkMuted, lineHeight: 1.5,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: t.green }}>{"\u2713"}</span>
                <span>World ID verified</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {agent.agentWallet ? (
                  <span style={{ color: t.green }}>{"\u2713"}</span>
                ) : (
                  <span style={{
                    display: "inline-block", width: 12, height: 12,
                    border: `2px solid ${t.blue}30`, borderTopColor: t.blue,
                    borderRadius: "50%", animation: "wwSpin 1s linear infinite",
                  }} />
                )}
                <span>{agent.agentWallet ? "Agent wallet created" : "Creating agent wallet..."}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {agent.agentFunded ? (
                  <span style={{ color: t.green }}>{"\u2713"}</span>
                ) : agent.agentWallet ? (
                  <span style={{
                    display: "inline-block", width: 12, height: 12,
                    border: `2px solid ${t.blue}30`, borderTopColor: t.blue,
                    borderRadius: "50%", animation: "wwSpin 1s linear infinite",
                  }} />
                ) : (
                  <span style={{ color: `${t.cardBorder}60` }}>{"\u2022"}</span>
                )}
                <span style={{ color: agent.agentWallet ? t.inkMuted : `${t.cardBorder}60` }}>
                  {agent.agentFunded ? "Funded with 1 USDC" : agent.agentWallet ? "Funding with USDC..." : "Fund agent wallet"}
                </span>
              </div>
            </div>
          </div>
        )}

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
                {agentBalance !== null ? `${agentBalance} USDC` : agent.agentFunded ? "1.00 USDC" : "0 USDC"}
              </span></div>
            </div>
            <Btn primary small onClick={enterPhase2}>
              Get Your Plate {"\u2192"}
            </Btn>
          </div>
        )}

        {/* ═══ Phase 2: Prompt ═══ */}
        {step === "prompt" && (() => {
          const bal = agentBalance !== null ? parseFloat(agentBalance) : null;
          const insufficient = bal !== null && bal < 0.01;
          return (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Send Task to Agent</div>
              <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
                Your agent will autonomously pay via x402 and generate an image.
                No MetaMask popups {"\u2014"} the agent signs with its own key.
              </div>

              {/* Agent balance indicator */}
              {agent.agentWallet && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                  background: insufficient ? `${t.red}08` : `${t.codeBg}CC`,
                  border: `1px solid ${insufficient ? `${t.red}30` : `${t.cardBorder}30`}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
                      color: insufficient ? t.red : t.inkMuted, marginBottom: 2,
                    }}>
                      Agent Balance
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 700,
                      fontFamily: "'SF Mono','Fira Code',monospace",
                      color: insufficient ? t.red : bal !== null && bal > 0 ? t.green : t.inkMuted,
                    }}>
                      {bal !== null ? `${agentBalance} USDC` : "Checking..."}
                    </div>
                  </div>
                  {insufficient && (
                    <button
                      onClick={fundAgentWallet}
                      disabled={isFunding}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${t.blue}`, background: `${t.blue}15`, color: t.blue,
                        cursor: isFunding ? "not-allowed" : "pointer", opacity: isFunding ? 0.6 : 1,
                        transition: "all .2s",
                      }}
                    >
                      {isFunding ? "Funding..." : "Top Up"}
                    </button>
                  )}
                </div>
              )}

              <input
                type="text"
                value={prompt}
                onChange={(e) => dispatch({ type: "SET_PROMPT", prompt: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !isGenerating && !insufficient) handleSendToAgent("image"); }}
                placeholder="Describe an image..."
                disabled={isGenerating || insufficient}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                  border: `1.5px solid ${insufficient ? `${t.red}40` : t.cardBorder}`,
                  background: `${t.bg}CC`, color: t.ink,
                  outline: "none", fontFamily: "inherit", marginBottom: 12,
                  boxSizing: "border-box",
                  opacity: insufficient ? 0.5 : 1,
                }}
              />
              <Btn primary small onClick={() => handleSendToAgent("image")} disabled={isGenerating || !prompt.trim() || insufficient}>
                {insufficient ? "Fund agent to continue" : "Send to Agent"}
              </Btn>
            </div>
          );
        })()}

        {/* ═══ Phase 2: Watching ═══ */}
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
              Agent #{agent.id?.toString()} is paying via x402 and generating autonomously.
            </div>
          </div>
        )}

        {/* ═══ Phase 2: Image Done ═══ */}
        {step === "image-done" && (
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, background: t.green,
              }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: t.green }}>
                {generation ? "Image Generated" : "Pipeline Complete"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5, marginBottom: 14 }}>
              {generation
                ? <>Agent #{agent.id?.toString()} paid via x402 and generated successfully. See the result on your license plate.</>
                : <>Agent #{agent.id?.toString()} completed its task.</>
              }
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn primary small onClick={enterPhase3}>
                Build Trust {"\u2192"}
              </Btn>
              <Btn small href="/feed" style={{ fontSize: 12 }}>View on Feed</Btn>
            </div>
          </div>
        )}

        {/* ═══ Phase 3: KYC ═══ */}
        {step === "kyc" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>KYC Verification</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
              Verify identity using Stripe Identity (photo ID).{" "}
              <span style={{ color: t.blue }}>Test mode:</span> auto-verifies with test documents.
            </div>
            {state.kycStatus === "idle" && (
              <Btn primary small onClick={startKYC} disabled={loading}>
                {loading ? "Starting..." : "Start KYC"}
              </Btn>
            )}
            {state.kycStatus === "creating" && <Btn primary small disabled>Creating session...</Btn>}
            {state.kycStatus === "verifying" && <Btn primary small disabled>Verifying...</Btn>}
            {state.kycStatus === "submitting" && <Btn primary small disabled>Confirm in wallet...</Btn>}
            {state.kycStatus === "done" && (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12, fontWeight: 700, marginBottom: 4,
                  color: tierData.kycVerified ? t.green : t.blue,
                }}>
                  {tierData.kycVerified ? (
                    <>{"\u2713"} KYC verified on-chain</>
                  ) : (
                    <>
                      <span style={{
                        display: "inline-block", width: 12, height: 12,
                        border: `2px solid ${t.blue}30`, borderTopColor: t.blue,
                        borderRadius: "50%", animation: "wwSpin 1s linear infinite",
                      }} />
                      ValidateRequest sent — awaiting validator
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: t.inkMuted, marginBottom: 10, lineHeight: 1.4 }}>
                  {tierData.kycVerified
                    ? "KYC result written to ValidationRegistry."
                    : "WorldIDValidator is processing the async validation request..."
                  }
                </div>
                <Btn primary small onClick={() => setStep("credit")} disabled={!tierData.kycVerified}>
                  {tierData.kycVerified ? "Next: Credit Score" : "Waiting for on-chain confirmation..."}
                </Btn>
              </div>
            )}
            {state.kycStatus === "error" && (
              <Btn primary small onClick={startKYC}>Retry KYC</Btn>
            )}
          </div>
        )}

        {/* ═══ Phase 3: Credit ═══ */}
        {step === "credit" && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Credit Score</div>
            <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 8, lineHeight: 1.5 }}>
              Connect a bank account via Plaid to compute a credit score.
            </div>
            <div style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 12,
              background: `${t.cardBorder}30`, fontSize: 11, fontFamily: "monospace",
            }}>
              <div>Test creds: <span style={{ color: t.ink }}>user_good</span> / <span style={{ color: t.ink }}>pass_good</span></div>
              <div>MFA: <span style={{ color: t.ink }}>1234</span></div>
            </div>
            {state.creditStatus === "idle" && (
              <Btn primary small onClick={startCredit} disabled={loading}>
                {loading ? "Starting..." : "Connect Bank"}
              </Btn>
            )}
            {state.creditStatus === "creating" && <Btn primary small disabled>Creating link...</Btn>}
            {state.creditStatus === "linking" && <Btn primary small disabled>Plaid Link open...</Btn>}
            {state.creditStatus === "submitting" && <Btn primary small disabled>Confirm in wallet...</Btn>}
            {state.creditStatus === "done" && (() => {
              const validators = [
                { label: "KYC Validator", done: tierData.kycVerified, desc: "Stripe Identity" },
                { label: "Credit Validator", done: tierData.hasCreditScore, desc: "Plaid via TEE" },
              ];
              const tierReady = tierData.effectiveTier >= 3;
              return (
                <div>
                  {/* Credit status line */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, fontWeight: 700, marginBottom: 4,
                    color: tierData.hasCreditScore ? t.green : t.blue,
                  }}>
                    {tierData.hasCreditScore ? (
                      <>{"\u2713"} Credit score written on-chain</>
                    ) : (
                      <>
                        <span style={{
                          display: "inline-block", width: 12, height: 12,
                          border: `2px solid ${t.blue}30`, borderTopColor: t.blue,
                          borderRadius: "50%", animation: "wwSpin 1s linear infinite",
                        }} />
                        ValidateRequest sent — awaiting validator
                      </>
                    )}
                  </div>
                  {tierData.hasCreditScore && (
                    <div style={{ fontSize: 11, color: t.inkMuted, marginBottom: 10, lineHeight: 1.4 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span>Score <strong style={{ color: t.blue }}>{tierData.creditData?.score ?? tierData.creditScore}</strong> verified via TEE</span>
                        {tierData.creditData?.dataHash && (
                          <span style={{
                            fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace",
                            opacity: 0.7,
                          }}>
                            dataHash: {tierData.creditData.dataHash.slice(0, 14)}...
                          </span>
                        )}
                        {tierData.creditTxHash && (
                          <a
                            href={`https://sepolia.basescan.org/tx/${tierData.creditTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View TEE-attested credit score transaction with SGX quotes"
                            style={{
                              fontSize: 9, fontFamily: "'SF Mono','Fira Code',monospace",
                              color: t.blue, textDecoration: "none",
                            }}
                          >
                            TEE tx: {tierData.creditTxHash.slice(0, 10)}...{tierData.creditTxHash.slice(-6)}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline validator checklist */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {validators.map((v) => (
                      <div key={v.label} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px", borderRadius: 8,
                        background: v.done ? `${t.green}08` : `${t.codeBg}CC`,
                        border: `1px solid ${v.done ? `${t.green}20` : `${t.cardBorder}30`}`,
                        transition: "all .4s",
                      }}>
                        {v.done ? (
                          <span style={{ color: t.green, fontWeight: 800, fontSize: 13 }}>{"\u2713"}</span>
                        ) : (
                          <span style={{
                            display: "inline-block", width: 13, height: 13,
                            border: `2px solid ${t.blue}30`, borderTopColor: t.blue,
                            borderRadius: "50%", animation: "wwSpin 1s linear infinite",
                            flexShrink: 0,
                          }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: v.done ? t.green : t.ink }}>
                            {v.label}
                            {v.done && <span style={{ fontWeight: 400, color: t.inkMuted, marginLeft: 6 }}>{"\u2014"} confirmed</span>}
                          </div>
                          {!v.done && (
                            <div style={{ fontSize: 10, color: t.inkMuted }}>{v.desc} — pending...</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tier + CTA */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, marginBottom: 12,
                    background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}30`,
                  }}>
                    <span style={{
                      fontSize: 18, fontWeight: 900,
                      fontFamily: "'SF Mono','Fira Code',monospace",
                      color: tierReady ? t.green : t.blue,
                    }}>
                      T{tierData.effectiveTier}
                    </span>
                    <div style={{ flex: 1, fontSize: 11, color: t.inkMuted }}>
                      {tierReady
                        ? <span style={{ color: t.green, fontWeight: 700 }}>Tier upgrade complete</span>
                        : <>Target: <span style={{ fontWeight: 700, color: t.ink }}>T3+</span> to unlock video</>
                      }
                    </div>
                  </div>
                  <Btn primary small disabled={!tierReady} onClick={() => {
                    addLog("TIER", `Tier ${tierData.effectiveTier} achieved!`, "pass");
                    setStep("video-prompt");
                  }}>
                    {tierReady ? "Generate Video" : "Waiting for validators..."}
                  </Btn>
                </div>
              );
            })()}
            {state.creditStatus === "error" && (
              <Btn primary small onClick={startCredit}>Retry</Btn>
            )}
          </div>
        )}

        {/* tier-polling removed — folded into credit done state */}

        {/* ═══ Phase 3: Video Prompt ═══ */}
        {step === "video-prompt" && (() => {
          const bal = agentBalance !== null ? parseFloat(agentBalance) : null;
          const insufficient = bal !== null && bal < 0.01;
          return (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
                color: t.green, marginBottom: 10,
              }}>
                Tier {tierData.effectiveTier} Achieved
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Generate a Video</div>
              <div style={{ fontSize: 12, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
                With T3+ clearance, your agent can now generate videos.
              </div>

              {/* Agent balance indicator */}
              {agent.agentWallet && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                  background: insufficient ? `${t.red}08` : `${t.codeBg}CC`,
                  border: `1px solid ${insufficient ? `${t.red}30` : `${t.cardBorder}30`}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
                      color: insufficient ? t.red : t.inkMuted, marginBottom: 2,
                    }}>
                      Agent Balance
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 700,
                      fontFamily: "'SF Mono','Fira Code',monospace",
                      color: insufficient ? t.red : bal !== null && bal > 0 ? t.green : t.inkMuted,
                    }}>
                      {bal !== null ? `${agentBalance} USDC` : "Checking..."}
                    </div>
                  </div>
                  {insufficient && (
                    <button
                      onClick={fundAgentWallet}
                      disabled={isFunding}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1.5px solid ${t.blue}`, background: `${t.blue}15`, color: t.blue,
                        cursor: isFunding ? "not-allowed" : "pointer", opacity: isFunding ? 0.6 : 1,
                        transition: "all .2s",
                      }}
                    >
                      {isFunding ? "Funding..." : "Top Up"}
                    </button>
                  )}
                </div>
              )}

              <input
                type="text"
                value={prompt}
                onChange={(e) => dispatch({ type: "SET_PROMPT", prompt: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !isGenerating && !insufficient) handleSendToAgent("video"); }}
                placeholder="Describe a video..."
                disabled={isGenerating || insufficient}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                  border: `1.5px solid ${insufficient ? `${t.red}40` : t.cardBorder}`,
                  background: `${t.bg}CC`, color: t.ink,
                  outline: "none", fontFamily: "inherit", marginBottom: 12,
                  boxSizing: "border-box",
                  opacity: insufficient ? 0.5 : 1,
                }}
              />
              <Btn primary small onClick={() => handleSendToAgent("video")} disabled={isGenerating || !prompt.trim() || insufficient}>
                {insufficient ? "Fund agent to continue" : "Generate Video"}
              </Btn>
            </div>
          );
        })()}

        {/* ═══ Phase 3: Video Watching ═══ */}
        {step === "video-watching" && (
          <div>
            <div style={{
              fontSize: 14, fontWeight: 700, marginBottom: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: 4,
                background: t.blue, animation: "demoPulse 1.5s ease-in-out infinite",
              }} />
              Generating Video
            </div>
            <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5 }}>
              Agent #{agent.id?.toString()} is generating a video with T{tierData.effectiveTier} clearance.
            </div>
          </div>
        )}

        {/* ═══ Phase 3: Done ═══ */}
        {step === "done" && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              color: t.green, marginBottom: 10,
            }}>
              Complete
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              All Phases Complete
            </div>

            <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.5, marginBottom: 14 }}>
              {videoGeneration
                ? <>T{tierData.effectiveTier} video generated. Check your license plate for the full result.</>
                : <>All verifications complete. Your agent is fully operational.</>
              }
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn small href="/feed" style={{ fontSize: 12 }}>View on Feed</Btn>
              <Btn small onClick={handleStartOver} style={{ fontSize: 12 }}>Start Over</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Agent status summary (Phase 1 only) */}
      {wallet.connected && currentPhase === 1 && step !== "agent-ready" && step !== "bootstrapping" && (
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
