"use client";

import { useState, useContext, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { ThemeCtx, Btn } from "../shared/theme";

type CreditStatus = "idle" | "creating" | "linking" | "submitting" | "done" | "error";

const steps = ["Token", "Link", "Submit", "Done"];

function PlaidLinkButton({ token, onSuccess, onExit }: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: () => onExit(),
  });

  useEffect(() => { if (ready) open(); }, [ready, open]);

  return null;
}

export function CreditCard({ agentId, onValidated }: { agentId: string | null; onValidated: () => void }) {
  const { t } = useContext(ThemeCtx);
  const [status, setStatus] = useState<CreditStatus>("idle");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [requestHash, setRequestHash] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepIndex =
    status === "idle" ? 0 : status === "creating" ? 0 : status === "linking" ? 1 :
    status === "submitting" ? 2 : status === "done" ? 3 : 0;

  const startLink = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      const res = await fetch("/api/plaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-link" }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error); setStatus("error"); return; }

      setLinkToken(data.linkToken);
      setStatus("linking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }, []);

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    setStatus("submitting");

    try {
      // Submit validation request (handles both token exchange + CRE queue)
      if (agentId) {
        const res = await fetch("/api/bonding/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "credit", agentId, publicToken }),
        });
        const data = await res.json();

        if (!res.ok) { setError(data.error); setStatus("error"); return; }

        setRequestHash(data.requestHash);
        setItemId(data.itemId);
        onValidated();
      } else {
        // No agentId — just exchange token to show it works
        const res = await fetch("/api/plaid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exchange", publicToken }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setStatus("error"); return; }
        setItemId(data.itemId);
      }

      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }, [agentId, onValidated]);

  const handlePlaidExit = useCallback(() => {
    if (status === "linking") {
      setStatus("idle");
      setLinkToken(null);
    }
  }, [status]);

  const reset = () => {
    setStatus("idle"); setError(null); setLinkToken(null); setRequestHash(null); setItemId(null);
  };

  return (
    <div style={{
      borderRadius: 16, padding: 24,
      border: `1.5px solid ${status === "done" ? t.green : t.cardBorder}`,
      background: `${t.card}CC`, backdropFilter: "blur(8px)",
      transition: "border-color .3s",
    }}>
      {/* Plaid Link auto-opener */}
      {status === "linking" && linkToken && (
        <PlaidLinkButton token={linkToken} onSuccess={handlePlaidSuccess} onExit={handlePlaidExit} />
      )}

      {/* Title */}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Credit Score</h2>
      <p style={{ color: t.inkMuted, fontSize: 13, margin: "0 0 20px" }}>Plaid Bank Connection</p>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
        {steps.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 12, fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i <= stepIndex && status !== "idle" ? (status === "done" ? t.green : t.blue) : `${t.cardBorder}80`,
              color: i <= stepIndex && status !== "idle" ? "#fff" : t.inkMuted,
              transition: "all .3s",
            }}>
              {status === "done" && i <= stepIndex ? "\u2713" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < stepIndex && status !== "idle" ? (status === "done" ? t.green : t.blue) : `${t.cardBorder}60`, borderRadius: 1, transition: "background .3s" }} />
            )}
          </div>
        ))}
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.6, marginBottom: 20 }}>
        <p style={{ margin: "0 0 8px" }}>Connect a bank account via Plaid.</p>
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: `${t.cardBorder}30`, fontSize: 12, fontFamily: "monospace",
        }}>
          <div>Test creds: <span style={{ color: t.ink }}>user_good</span> / <span style={{ color: t.ink }}>pass_good</span></div>
          <div>MFA: <span style={{ color: t.ink }}>1234</span></div>
        </div>
      </div>

      {/* Action */}
      {status === "idle" && <Btn primary onClick={startLink}>Connect Bank</Btn>}
      {status === "creating" && <Btn primary disabled>Creating link...</Btn>}
      {status === "linking" && <Btn primary disabled>Plaid Link open...</Btn>}
      {status === "submitting" && <Btn primary disabled>Submitting to CRE...</Btn>}
      {status === "done" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn primary disabled style={{ background: t.green, borderColor: "transparent" }}>Bank Connected</Btn>
          <button onClick={reset} style={{ background: "none", border: "none", color: t.inkMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
        </div>
      )}
      {status === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn primary onClick={startLink}>Retry</Btn>
          <button onClick={reset} style={{ background: "none", border: "none", color: t.inkMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
        </div>
      )}

      {/* Status + request hash */}
      <div style={{ marginTop: 16, fontSize: 12, fontFamily: "monospace" }}>
        <span style={{ color: t.inkMuted }}>Status: </span>
        <span style={{
          color: status === "done" ? t.green : status === "error" ? t.red : t.inkMuted,
          fontWeight: status === "done" || status === "error" ? 600 : 400,
        }}>
          {status === "done" ? "connected" : status === "error" ? error || "error" : status}
        </span>
      </div>

      {itemId && (
        <div style={{ marginTop: 6, fontSize: 11, fontFamily: "monospace", color: t.inkMuted }}>
          itemId: <span style={{ color: t.ink }}>{itemId.slice(0, 24)}...</span>
        </div>
      )}

      {requestHash && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 6,
          background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}40`,
          fontSize: 11, fontFamily: "monospace",
        }}>
          <div style={{ color: t.blue, fontWeight: 700, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
            VALIDATION REQUEST
          </div>
          <div style={{ color: t.inkMuted }}>
            hash: <span style={{ color: t.ink }}>{requestHash.slice(0, 18)}...</span>
          </div>
          <div style={{ color: t.inkMuted, marginTop: 2 }}>
            next: <span style={{ color: t.green }}>CRE → PlaidCreditValidator.onReport()</span>
          </div>
        </div>
      )}
    </div>
  );
}
