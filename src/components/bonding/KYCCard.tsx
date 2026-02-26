"use client";

import { useState, useContext, useCallback } from "react";
import { ThemeCtx, Btn } from "../shared/theme";

type KYCStatus = "idle" | "creating" | "verifying" | "submitting" | "done" | "error";

const steps = ["Create", "Verify", "Submit", "Done"];

export function KYCCard({ agentId, onValidated }: { agentId: string | null; onValidated: () => void }) {
  const { t } = useContext(ThemeCtx);
  const [status, setStatus] = useState<KYCStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [requestHash, setRequestHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepIndex =
    status === "idle" ? 0 : status === "creating" ? 0 : status === "verifying" ? 1 :
    status === "submitting" ? 2 : status === "done" ? 3 : 0;

  const startKYC = useCallback(async () => {
    setStatus("creating");
    setError(null);

    try {
      // 1. Create Stripe Identity session
      const res = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error); setStatus("error"); return; }

      setSessionId(data.sessionId);
      setStatus("verifying");

      // 2. Open Stripe Identity modal
      const { loadStripe } = await import("@stripe/stripe-js");
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pk) { setError("Stripe publishable key not configured"); setStatus("error"); return; }

      const stripe = await loadStripe(pk);
      if (!stripe) { setError("Failed to load Stripe"); setStatus("error"); return; }

      const { error: stripeError } = await stripe.verifyIdentity(data.clientSecret);

      if (stripeError) {
        console.warn("Stripe Identity:", stripeError.message);
      }

      // 3. Check session status
      const check = await fetch(`/api/kyc?sessionId=${data.sessionId}`);
      const result = await check.json();

      if (result.status !== "verified") {
        setError(`Stripe status: ${result.status}`);
        setStatus("error");
        return;
      }

      // 4. Submit validation request if agentId is set
      if (agentId) {
        setStatus("submitting");
        const validateRes = await fetch("/api/bonding/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "kyc", agentId, sessionId: data.sessionId }),
        });
        const validateData = await validateRes.json();

        if (!validateRes.ok) {
          setError(validateData.error);
          setStatus("error");
          return;
        }

        setRequestHash(validateData.requestHash);
        onValidated();
      }

      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }, [agentId, onValidated]);

  const reset = () => {
    setStatus("idle"); setError(null); setSessionId(null); setRequestHash(null);
  };

  return (
    <div style={{
      borderRadius: 16, padding: 24,
      border: `1.5px solid ${status === "done" ? t.green : t.cardBorder}`,
      background: `${t.card}CC`, backdropFilter: "blur(8px)",
      transition: "border-color .3s",
    }}>
      {/* Title */}
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>KYC</h2>
      <p style={{ color: t.inkMuted, fontSize: 13, margin: "0 0 20px" }}>Stripe Identity</p>

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
      <p style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.6, margin: "0 0 20px" }}>
        Verify identity using photo ID.{" "}
        <span style={{ color: t.blue }}>Test mode:</span> auto-verifies with test documents.
      </p>

      {/* Action */}
      {status === "idle" && <Btn primary onClick={startKYC}>Start KYC</Btn>}
      {status === "creating" && <Btn primary disabled>Creating session...</Btn>}
      {status === "verifying" && <Btn primary disabled>Verifying...</Btn>}
      {status === "submitting" && <Btn primary disabled>Submitting to CRE...</Btn>}
      {status === "done" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn primary disabled style={{ background: t.green, borderColor: "transparent" }}>Verified</Btn>
          <button onClick={reset} style={{ background: "none", border: "none", color: t.inkMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
        </div>
      )}
      {status === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn primary onClick={startKYC}>Retry</Btn>
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
          {status === "done" ? "verified" : status === "error" ? error || "error" : status}
        </span>
      </div>

      {sessionId && (
        <div style={{ marginTop: 6, fontSize: 11, fontFamily: "monospace", color: t.inkMuted }}>
          sessionId: <span style={{ color: t.ink }}>{sessionId.slice(0, 24)}...</span>
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
            next: <span style={{ color: t.green }}>CRE → StripeKYCValidator.onReport()</span>
          </div>
        </div>
      )}
    </div>
  );
}
