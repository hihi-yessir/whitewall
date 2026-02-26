"use client";

import { useState, useCallback, useEffect } from "react";
import { themes, ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { MeshBG } from "../shared/MeshBG";
import { KYCCard } from "./KYCCard";
import { CreditCard } from "./CreditCard";
import { ChainStatus } from "./ChainStatus";
import type { ThemeMode } from "../shared/theme";

export default function BondingPage() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  const t = themes[mode];
  const mobile = useIsMobile();

  // Wallet state
  const [wallet, setWallet] = useState<{ connected: boolean; address?: string }>({ connected: false });
  const [agentId, setAgentId] = useState<string>("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Refresh trigger for chain status
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const connectWallet = useCallback(async () => {
    setWalletLoading(true);
    setWalletError(null);
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

      setWallet({ connected: true, address: account });
    } catch (err: any) {
      setWalletError(err.message || "Connection failed");
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const handleChange = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWallet({ connected: false });
      } else {
        setWallet({ connected: true, address: accounts[0] });
      }
    };
    (window as any).ethereum.on("accountsChanged", handleChange);
    return () => (window as any).ethereum?.removeListener?.("accountsChanged", handleChange);
  }, []);

  const hasAgentId = agentId.trim() !== "" && !isNaN(Number(agentId));

  return (
    <ThemeCtx.Provider value={{ mode, toggle, t }}>
      <MeshBG />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        background: `radial-gradient(ellipse at center, transparent 40%, ${t.bg})` }} />

      <div style={{
        position: "relative", zIndex: 2, minHeight: "100vh",
        background: t.bg, color: t.ink,
        transition: "background .4s, color .4s",
        fontFamily: "'Inter',system-ui,-apple-system,sans-serif",
      }}>
        {/* Navbar */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: mobile ? "12px 16px" : "14px 32px",
          background: `${t.card}CC`, backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${t.cardBorder}40`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" style={{ fontWeight: 800, fontSize: 18, color: t.ink, textDecoration: "none" }}>
              whitewall
            </a>
            <span style={{ color: t.inkMuted, fontSize: 13 }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: t.inkMuted }}>bonding</span>
          </div>
          <ThemeToggle />
        </nav>

        {/* Content */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: mobile ? "24px 16px" : "48px 32px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: mobile ? 28 : 36, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              Bonding
            </h1>
            <p style={{ color: t.inkMuted, fontSize: 15, marginTop: 8, margin: "8px 0 0" }}>
              Verify identity &amp; credit for your agent
            </p>
          </div>

          {/* Wallet + Agent ID section */}
          <div style={{
            padding: "20px 24px", borderRadius: 12, marginBottom: 20,
            border: `1.5px solid ${wallet.connected ? t.green + "60" : t.cardBorder}`,
            background: `${t.card}CC`, backdropFilter: "blur(8px)",
            transition: "border-color .3s",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Wallet</div>
                {wallet.connected ? (
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: t.green }}>
                    {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                    <span style={{ color: t.inkMuted, marginLeft: 8 }}>Base Sepolia</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: t.inkMuted }}>Not connected</div>
                )}
              </div>
              {!wallet.connected && (
                <button
                  onClick={connectWallet}
                  disabled={walletLoading}
                  style={{
                    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: `2px solid transparent`, background: t.blue, color: "#fff",
                    cursor: walletLoading ? "not-allowed" : "pointer", opacity: walletLoading ? 0.5 : 1,
                    transition: "all .2s",
                  }}
                >
                  {walletLoading ? "Connecting..." : "Connect Wallet"}
                </button>
              )}
            </div>

            {walletError && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.red }}>{walletError}</div>
            )}

            {/* Agent ID input */}
            {wallet.connected && (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Agent ID</label>
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 42"
                  style={{
                    width: 120, padding: "6px 12px", borderRadius: 8, fontSize: 13,
                    border: `1.5px solid ${t.cardBorder}`, background: `${t.bg}CC`, color: t.ink,
                    outline: "none", fontFamily: "monospace",
                  }}
                />
                <span style={{ fontSize: 11, color: t.inkMuted }}>
                  From IdentityRegistry (register via /demo)
                </span>
              </div>
            )}
          </div>

          {/* Cards grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}>
            <KYCCard
              agentId={hasAgentId ? agentId : null}
              onValidated={triggerRefresh}
            />
            <CreditCard
              agentId={hasAgentId ? agentId : null}
              onValidated={triggerRefresh}
            />
          </div>

          {/* On-chain status */}
          {hasAgentId && (
            <ChainStatus agentId={agentId} refreshKey={refreshKey} />
          )}

          {/* Confidential HTTP callout */}
          <div style={{
            padding: "16px 20px", borderRadius: 12, marginTop: 20,
            border: `1.5px solid ${t.cardBorder}`,
            background: `${t.card}CC`, backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.blue, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Confidential HTTP
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: t.inkMuted, lineHeight: 1.6 }}>
              API keys stay in the TEE enclave. Only <code style={{ color: t.green, fontFamily: "monospace", fontSize: 12 }}>verified=true</code> or{" "}
              <code style={{ color: t.green, fontFamily: "monospace", fontSize: 12 }}>score=95</code> reaches chain.
            </p>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
