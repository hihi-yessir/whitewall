"use client";

import { useState, useEffect, useContext } from "react";
import { ThemeCtx, ThemeToggle, Btn, NavLink, CodeViewer } from "./shared/theme";
import { useIsMobile, useReveal } from "./shared/hooks";


// ── Problem Section ──

function ProblemSection() {
  const { t } = useContext(ThemeCtx);
  const [ref, vis] = useReveal();
  const mobile = useIsMobile();
  const cards = [
    { num: "01", title: "No Identity",
      desc: "AI agents transact via x402, but the payment protocol has no identity layer. An agent can pay $0.50 and remain completely anonymous.",
      icon: "01" },
    { num: "02", title: "Sybil Floods",
      desc: "One person deploys 1,000 agents. Each pays independently. No way to detect they share an operator \u2014 or to hold anyone accountable.",
      icon: "02" },
    { num: "03", title: "No Trust Layer",
      desc: "Service providers have no on-chain mechanism to verify who is behind an agent before fulfilling a request. Deepfakes, spam, abuse \u2014 all anonymous.",
      icon: "03" },
  ];
  return (
    <section id="problem" ref={ref as React.RefObject<HTMLElement>}
      style={{ padding: mobile ? "80px 20px" : "120px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "all .8s cubic-bezier(.16,1,.3,1)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: t.blue, textTransform: "uppercase" }}>The Problem</span>
        <h2 style={{ fontSize: mobile ? 32 : 48, fontWeight: 900, letterSpacing: -2, margin: "16px 0 0", lineHeight: 1.05, textTransform: "uppercase" }}>
          Agents act autonomously<span style={{ color: t.blue }}>.</span><br />
          Pay autonomously<span style={{ color: t.blue }}>.</span><br />
          Nobody is accountable<span style={{ color: t.blue }}>.</span>
        </h2>

        <p style={{ fontSize: mobile ? 15 : 17, color: t.inkMuted, margin: "20px 0 0", maxWidth: 500, lineHeight: 1.7 }}>
          With x402, any AI agent can autonomously pay for API services —
          content generation, data access, compute. But the protocol only knows{" "}
          <em>what</em> was paid. Not <em>who</em> paid. Not <em>why</em>.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 20, marginTop: 56 }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(32px)",
            transition: `all .7s ${0.2 + i * 0.12}s cubic-bezier(.16,1,.3,1)`,
            background: `${t.card}CC`, backdropFilter: "blur(8px)",
            border: `1.5px solid ${t.cardBorder}`, borderRadius: 14, padding: mobile ? 24 : 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 1 }}>{c.num}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: t.blue, opacity: 0.5 }}>{c.num}</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px", letterSpacing: -0.5 }}>{c.title}</h3>
            <p style={{ fontSize: 14, color: t.inkMuted, lineHeight: 1.65, margin: 0 }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pipeline Section ──

function PipelineSection() {
  const { t } = useContext(ThemeCtx);
  const [ref, vis] = useReveal();
  const mobile = useIsMobile();
  const steps = [
    { step: "G1", title: "Identity", desc: "EVMClient.read \u2192 IdentityRegistry. Is this agent registered with an ERC-8004 NFT?" },
    { step: "G2", title: "Verification", desc: "EVMClient.read \u2192 WorldIDValidator. Is the owner human-verified via World ID ZK proof?" },
    { step: "G3", title: "KYC (TEE)", desc: "Confidential HTTP \u2192 Stripe Identity inside TEE enclave. KYC credentials never leave the enclave." },
    { step: "G4", title: "Credit (TEE)", desc: "Confidential HTTP \u2192 Plaid inside TEE. Returns attested credit score, verified on-chain." },
    { step: "DON", title: "Consensus", desc: "3/5 DON nodes reach consensus on the verification report. Signed report submitted on-chain." },
    { step: "ACE", title: "Policy", desc: "runPolicy() \u2014 TieredPolicy enforces the final on-chain safety check. Approve or reject." },
  ];
  return (
    <section id="pipeline" ref={ref as React.RefObject<HTMLElement>}
      style={{ padding: mobile ? "80px 20px" : "120px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "all .8s cubic-bezier(.16,1,.3,1)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: t.blue, textTransform: "uppercase" }}>The Pipeline</span>
        <h2 style={{ fontSize: mobile ? 32 : 48, fontWeight: 900, letterSpacing: -2, margin: "16px 0 0", lineHeight: 1.05, textTransform: "uppercase" }}>
          4-Gate verification with<br />
          CRE&apos;s DON consensus<span style={{ color: t.blue }}>.</span><br />
          &amp; ACE enforcement<span style={{ color: t.blue }}>.</span>
        </h2>
        <p style={{ fontSize: mobile ? 15 : 17, color: t.inkMuted, margin: "20px 0 0", maxWidth: 520, lineHeight: 1.7 }}>
          Every request passes through CRE&apos;s 4-Gate pipeline — 2 on-chain reads + 2 TEE-attested confidential HTTP calls. DON nodes sign the report. ACE enforces on-chain.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: mobile ? 0 : 1, marginTop: 56 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(32px)",
            transition: `all .7s ${0.3 + i * 0.1}s cubic-bezier(.16,1,.3,1)`,
            padding: mobile ? "20px 0" : "28px 24px",
            borderLeft: !mobile && i % 3 !== 0 ? `1px solid ${t.cardBorder}` : "none",
            borderBottom: mobile || i < 3 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.blue, letterSpacing: 1.5, marginBottom: 14, opacity: 0.7 }}>{s.step}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.3 }}>{s.title}</h3>
            <p style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Integrate Section (SDK + MCP unified) ──

type IntegrateTier = "dapp" | "app" | "agent";
type AppLang = "typescript" | "go";

interface CodeBlock {
  file: string;
  lines: { text: string; color?: string }[];
}

const solidityCode: CodeBlock = {
  file: "MyDeFi.sol",
  lines: [
    { text: "// Protect your dApp with Whitewall OS", color: "muted" },
    { text: "contract MyDeFi is WhitewallOSGuard {", color: "keyword" },
    { text: "    constructor(address whitewallOS_)", color: "default" },
    { text: "        WhitewallOSGuard(whitewallOS_) {}", color: "default" },
    { text: "" },
    { text: "    function withdraw(uint256 amt)", color: "default" },
    { text: "        external", color: "keyword" },
    { text: "        requireHumanVerified(agentId)", color: "blue" },
    { text: "    {", color: "default" },
    { text: "        // Your logic here", color: "muted" },
    { text: "    }", color: "default" },
    { text: "}", color: "default" },
  ],
};

const appCode: Record<AppLang, CodeBlock> = {
  typescript: {
    file: "verify.ts",
    lines: [
      { text: 'import { WhitewallOS } from "@whitewall-os/sdk";', color: "keyword" },
      { text: "" },
      { text: "const wos = await WhitewallOS.connect({", color: "default" },
      { text: '    chain: "baseSepolia",', color: "string" },
      { text: "});", color: "default" },
      { text: "" },
      { text: "const status = await wos.getFullStatus(", color: "default" },
      { text: "    agentId", color: "blue" },
      { text: ");", color: "default" },
      { text: "" },
      { text: "if (status.effectiveTier >= 2) {", color: "keyword" },
      { text: "    // Agent is human-verified", color: "muted" },
      { text: "}", color: "default" },
    ],
  },
  go: {
    file: "verify.go",
    lines: [
      { text: 'import whitewallos "github.com/hihi-yessir/whitewall-os/sdk-go"', color: "keyword" },
      { text: "" },
      { text: "client, err := whitewallos.Connect(", color: "default" },
      { text: '    ctx, whitewallos.Config{Chain: whitewallos.BaseSepolia},', color: "string" },
      { text: ")", color: "default" },
      { text: "" },
      { text: "status, err := client.GetFullStatus(", color: "default" },
      { text: "    ctx, agentId,", color: "blue" },
      { text: ")", color: "default" },
      { text: "" },
      { text: "if status.EffectiveTier >= 2 {", color: "keyword" },
      { text: "    // Agent is human-verified", color: "muted" },
      { text: "}", color: "default" },
    ],
  },
};

const mcpConfig: CodeBlock = {
  file: "mcp-server.json",
  lines: [
    { text: "{", color: "default" },
    { text: '  "mcpServers": {', color: "blue" },
    { text: '    "whitewall-os": {', color: "blue" },
    { text: '      "command": "npx",', color: "string" },
    { text: '      "args": [', color: "default" },
    { text: '        "@whitewall-os/mcp-server",', color: "string" },
    { text: '        "--chain", "baseSepolia"', color: "string" },
    { text: "      ],", color: "default" },
    { text: '      "env": {', color: "default" },
    { text: '        "WHITEWALL_OS_AGENT_ID": "42"', color: "blue" },
    { text: "      }", color: "default" },
    { text: "    }", color: "default" },
    { text: "  }", color: "default" },
    { text: "}", color: "default" },
  ],
};

const solidityModifiers = [
  { name: "requireRegistered", desc: "Reverts if the agent has no ERC-8004 identity NFT.", sig: "(uint256 agentId)" },
  { name: "requireHumanVerified", desc: "Reverts if the agent lacks a human verification bond.", sig: "(uint256 agentId)" },
  { name: "requireTier", desc: "Reverts if the agent\u0027s verification tier is below the minimum.", sig: "(uint256 agentId, uint8 minTier)" },
];

const appMethods = [
  { name: "getFullStatus", desc: "Full status — registration, human verification, KYC, credit score, effective tier.", sig: "(agentId)" },
  { name: "isHumanVerified", desc: "Quick boolean — does this agent have an accountable human?", sig: "(agentId)" },
  { name: "getKYCData", desc: "Full KYC record — status, validator address, verification timestamp.", sig: "(agentId)" },
  { name: "getCreditData", desc: "Credit score, threshold, and TEE attestation status from PlaidCreditValidator.", sig: "(agentId)" },
  { name: "isTeeEnabled", desc: "Check if TEE verification is active — returns verifier address and config.", sig: "()" },
  { name: "getValidationSummary", desc: "Aggregated validation pipeline view — all validator results for an agent.", sig: "(agentId)" },
  { name: "onAccessDenied", desc: "Watch for real-time AccessDenied events with denial reasons.", sig: "(callback)" },
  { name: "onCreditScoreSet", desc: "Watch for CreditScoreSet events — TEE-attested score updates.", sig: "(callback)" },
];

const mcpTools = [
  { name: "whitewall_os_check_agent", desc: "Quick check — is this agent registered and human-verified?", sig: "(agentId)" },
  { name: "whitewall_os_get_status", desc: "Full report — registration, tier, owner, wallet, validations.", sig: "(agentId)" },
  { name: "whitewall_os_get_policy", desc: "TieredPolicy config + TEE status, registry addresses, validator list.", sig: "()" },
  { name: "whitewall_os_get_kyc_data", desc: "KYC verification record — status, validator, timestamp.", sig: "(agentId)" },
  { name: "whitewall_os_get_credit_data", desc: "Credit score with TEE attestation status and quote verification.", sig: "(agentId)" },
  { name: "whitewall_os_get_validations", desc: "Full validation pipeline — all validator requests and responses for an agent.", sig: "(agentId)" },
];

// CodeViewer imported from shared/theme

function FeatureCards({ items, label }: { items: { name: string; desc: string; sig: string }[]; label: string }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: t.inkMuted, textTransform: "uppercase" }}>
        {label}
      </span>
      {items.map((item, i) => (
        <div key={i} style={{
          background: `${t.card}CC`, backdropFilter: "blur(8px)",
          border: `1.5px solid ${t.cardBorder}`, borderRadius: 12,
          padding: mobile ? 16 : 20,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <code style={{
              fontFamily: "'SF Mono','Fira Code',monospace", fontSize: mobile ? 11 : 12,
              color: t.blue, fontWeight: 700,
            }}>{item.name}</code>
            <code style={{
              fontFamily: "'SF Mono','Fira Code',monospace", fontSize: mobile ? 9 : 10,
              color: t.inkMuted, opacity: 0.5,
            }}>{item.sig}</code>
          </div>
          <p style={{ fontSize: 13, color: t.inkMuted, lineHeight: 1.55, margin: "8px 0 0" }}>{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

function IntegrateSection() {
  const { t } = useContext(ThemeCtx);
  const [ref, vis] = useReveal();
  const [tier, setTier] = useState<IntegrateTier>("dapp");
  const [appLang, setAppLang] = useState<AppLang>("typescript");
  const mobile = useIsMobile();

  const colorMap: Record<string, string> = {
    muted: t.inkMuted, keyword: t.red, blue: t.blue, string: t.green, default: t.ink,
  };

  const tiers: { key: IntegrateTier; label: string; sub: string }[] = [
    { key: "dapp", label: "Solidity", sub: "dApp" },
    { key: "app", label: "TypeScript / Go", sub: "App" },
    { key: "agent", label: "MCP", sub: "Agent" },
  ];

  return (
    <section id="sdk" ref={ref as React.RefObject<HTMLElement>}
      style={{ padding: mobile ? "80px 20px" : "120px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "all .8s cubic-bezier(.16,1,.3,1)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: t.blue, textTransform: "uppercase" }}>Integrate</span>
        <h2 style={{ fontSize: mobile ? 32 : 48, fontWeight: 900, letterSpacing: -2, margin: "16px 0 0", lineHeight: 1.05, textTransform: "uppercase", maxWidth: 700 }}>
          3 lines of Solidity<span style={{ color: t.blue }}>.</span><br />
          1 line of TypeScript<span style={{ color: t.blue }}>.</span><br />
          0 lines of MCP<span style={{ color: t.blue }}>.</span>
        </h2>
        <p style={{ fontSize: mobile ? 15 : 17, color: t.inkMuted, margin: "20px 0 0", maxWidth: 520, lineHeight: 1.7 }}>
          Protect dApps with WhitewallOSGuard. Verify agents from your backend. Or give your AI agent identity awareness via MCP — zero code.
        </p>
      </div>

      {/* Tier selector */}
      <div style={{
        display: "flex", gap: mobile ? 0 : 4, marginTop: 48,
        opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(32px)",
        transition: "all .7s 0.25s cubic-bezier(.16,1,.3,1)",
      }}>
        {tiers.map((tt) => {
          const isActive = tier === tt.key;
          return (
            <button key={tt.key} onClick={() => setTier(tt.key)} style={{
              padding: mobile ? "12px 16px" : "14px 28px",
              border: "none", cursor: "pointer", transition: "all .2s",
              background: isActive ? `${t.card}CC` : "transparent",
              borderBottom: isActive ? `2px solid ${t.blue}` : `2px solid ${t.cardBorder}40`,
              color: isActive ? t.ink : t.inkMuted,
              fontSize: mobile ? 12 : 14, fontWeight: 700,
              flex: mobile ? 1 : "none",
            }}>
              <span style={{ opacity: 0.45, fontSize: mobile ? 9 : 11, display: "block", marginBottom: 2, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{tt.sub}</span>
              {tt.label}
            </button>
          );
        })}
      </div>

      {/* Tier content */}
      <div style={{
        marginTop: 24,
        opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(32px)",
        transition: "all .7s 0.35s cubic-bezier(.16,1,.3,1)",
      }}>
        {tier === "dapp" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
              <CodeViewer code={solidityCode} colorMap={colorMap} />
              <FeatureCards items={solidityModifiers} label="3 Modifiers" />
            </div>
            <a href="https://github.com/hihi-yessir/whitewall-os/tree/main/contracts" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: t.inkMuted, textDecoration: "none", fontWeight: 600 }}>
              View contracts on GitHub {"\u2197"}
            </a>
          </>
        )}

        {tier === "app" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
              <div style={{
                borderRadius: 12, overflow: "hidden",
                border: `1.5px solid ${t.cardBorder}`, background: `${t.codeBg}CC`, backdropFilter: "blur(8px)",
              }}>
                {/* Header with traffic lights + lang toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: `${t.codeHeader}CC`, borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: t.red, opacity: 0.8 }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: "#E8A317", opacity: 0.8 }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: t.green, opacity: 0.8 }} />
                  <span style={{ marginLeft: 8, fontSize: 12, color: t.inkMuted, fontFamily: "monospace" }}>{appCode[appLang].file}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 2, background: `${t.bg}80`, borderRadius: 5, padding: 2 }}>
                    {(["typescript", "go"] as AppLang[]).map((lang) => {
                      const isActive = appLang === lang;
                      return (
                        <button key={lang} onClick={() => setAppLang(lang)} style={{
                          padding: "6px 14px", border: "none", cursor: "pointer",
                          borderRadius: 4, fontSize: 11, fontWeight: 700, transition: "all .15s",
                          background: isActive ? t.blue : "transparent",
                          color: isActive ? "#fff" : t.inkMuted,
                          lineHeight: 1.3,
                        }}>
                          {lang === "typescript" ? "TS" : "Go"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Code */}
                <div style={{ padding: mobile ? "16px 12px" : "20px 24px", overflowX: "auto" }}>
                  <pre style={{ margin: 0, fontFamily: "'SF Mono','Fira Code',monospace", fontSize: mobile ? 12 : 13, lineHeight: 1.7 }}>
                    {appCode[appLang].lines.map((line, i) => (
                      <div key={`${appLang}-${i}`} style={{ color: colorMap[line.color || "default"], minHeight: "1.7em" }}>
                        {line.text || "\u00A0"}
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
              <FeatureCards items={appMethods} label="Key Methods" />
            </div>
            <a href={`https://github.com/hihi-yessir/whitewall-os/tree/main/${appLang === "go" ? "sdk-go" : "sdk"}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: t.inkMuted, textDecoration: "none", fontWeight: 600 }}>
              View {appLang === "go" ? "Go" : "TypeScript"} SDK on GitHub {"\u2197"}
            </a>
          </>
        )}

        {tier === "agent" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
              <CodeViewer code={mcpConfig} colorMap={colorMap} />
              <FeatureCards items={mcpTools} label="6 Tools" />
            </div>
            <a href="https://github.com/hihi-yessir/whitewall-os/tree/main/mcp" target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: t.inkMuted, textDecoration: "none", fontWeight: 600 }}>
              View MCP server on GitHub {"\u2197"}
            </a>
          </>
        )}
      </div>
    </section>
  );
}

// ── Footer ──

function Footer() {
  const { t } = useContext(ThemeCtx);
  const [ref, vis] = useReveal(0.3);
  const mobile = useIsMobile();
  return (
    <footer ref={ref as React.RefObject<HTMLElement>}
      style={{
        padding: mobile ? "60px 20px 40px" : "100px 48px 60px", textAlign: "center", maxWidth: 800, margin: "0 auto",
        opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "all .8s cubic-bezier(.16,1,.3,1)" }}>
      <h2 style={{ fontSize: mobile ? 32 : 44, fontWeight: 900, letterSpacing: -2, textTransform: "uppercase", lineHeight: 1.05 }}>
        A billion agents,<br />every one accountable<span style={{ color: t.blue }}>.</span>
      </h2>
      <p style={{ fontSize: mobile ? 14 : 16, color: t.inkMuted, margin: "20px 0 40px", lineHeight: 1.7 }}>
        3 lines of Solidity. 1 line of TypeScript. Ship verified agents today.
      </p>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn primary small={mobile} href="/demo">Live Demo</Btn>
        <Btn small={mobile} href="/tryout">Get Your License</Btn>
        <Btn small={mobile} href="/feed">Agent Feed</Btn>
      </div>

      {/* Powered by */}
      <div style={{ marginTop: 60, paddingTop: 30, borderTop: `1px solid ${t.cardBorder}`, display: "flex", justifyContent: "center", alignItems: "center", gap: mobile ? 16 : 36, flexWrap: "wrap" }}>
        <span style={{ fontSize: mobile ? 10 : 12, color: t.inkMuted, whiteSpace: "nowrap", fontWeight: 500 }}>Powered by:</span>
        {["Chainlink CRE", "Chainlink DON", "Chainlink ACE", "World ID", "x402", "TEE"].map((n) => (
          <span key={n} style={{ fontSize: mobile ? 9 : 12, color: t.inkMuted, opacity: 0.3, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>{n}</span>
        ))}
      </div>

      {/* Links */}
      <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: mobile ? 8 : 32, flexWrap: "wrap" }}>
        {[
          { label: "GitHub", href: "https://github.com/hihi-yessir/whitewall-os" },
          { label: "Live Demo", href: "/demo" },
          { label: "Try It Out", href: "/tryout" },
          { label: "Agent Feed", href: "/feed" },
        ].map((l) => (
          <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined} style={{ fontSize: 13, color: t.inkMuted, textDecoration: "none", fontWeight: 600, padding: mobile ? "8px 12px" : 0 }}>{l.label}</a>
        ))}
      </div>
      <p style={{ fontSize: 11, color: t.inkMuted, opacity: 0.35, marginTop: 20 }}>&copy; 2026 Whitewall</p>
    </footer>
  );
}

// ── Mobile Nav Menu ──

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useContext(ThemeCtx);
  if (!open) return null;
  const links = [
    { label: "Protocol", href: "#problem" },
    { label: "Pipeline", href: "#pipeline" },
    { label: "Integrate", href: "#sdk" },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: `${t.bg}F2`,
      backdropFilter: "blur(12px)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 32,
    }} onClick={onClose}>
      {links.map((l) => (
        <a key={l.label} href={l.href} onClick={onClose}
          style={{ fontSize: 24, fontWeight: 800, color: t.ink, textDecoration: "none", textTransform: "uppercase", letterSpacing: 2 }}>
          {l.label}
        </a>
      ))}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <a href="/demo" style={{ fontSize: 20, fontWeight: 800, color: t.ink, textDecoration: "none", textTransform: "uppercase", letterSpacing: 2 }}>
          Live Demo
        </a>
        <a href="/tryout" style={{ fontSize: 20, fontWeight: 800, color: t.ink, textDecoration: "none", textTransform: "uppercase", letterSpacing: 2 }}>
          Get Your License
        </a>
        <a href="/feed" style={{ fontSize: 20, fontWeight: 800, color: t.ink, textDecoration: "none", textTransform: "uppercase", letterSpacing: 2 }}>
          Agent Feed
        </a>
      </div>
    </div>
  );
}

// ── Main App ──

export default function WhitewallLanding() {
  const { t } = useContext(ThemeCtx);
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useIsMobile();

  return (
    <div style={{ overflow: "auto" }}>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Edge fade overlay — fixed, always visible */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        {/* All content sits above mesh */}
        <div style={{ position: "relative", zIndex: 2 }}>
          {/* Nav */}
          <nav style={{
            position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: mobile ? "16px 20px" : "20px 40px",
            borderBottom: `1px solid ${t.cardBorder}40`,
            background: `${t.bg}B0`, backdropFilter: "blur(12px)",
            transition: "border-color .4s, background .4s",
          }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: t.ink }}>
              <div style={{ display: "flex", gap: 2 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 4, height: 22, borderRadius: 1, background: t.ink, opacity: t.logoDots[i], transition: "background .4s" }} />
                ))}
              </div>
              <span style={{ fontWeight: 900, fontSize: mobile ? 16 : 20, letterSpacing: 1, textTransform: "uppercase" }}>Whitewall</span>
            </a>

            {mobile ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <ThemeToggle />
                <button onClick={() => setMenuOpen(true)} style={{
                  width: 44, height: 44, borderRadius: 8, border: `1.5px solid ${t.cardBorder}`,
                  background: "transparent", cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", color: t.ink, fontSize: 18,
                }}>{"\u2630"}</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <NavLink href="#problem">Protocol</NavLink>
                <NavLink href="#pipeline">Pipeline</NavLink>
                <NavLink href="#sdk">Integrate</NavLink>
                <div style={{ width: 1, height: 20, background: t.cardBorder, opacity: 0.5, marginLeft: 4 }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <ThemeToggle />
                  <Btn small href="/demo">Architecture</Btn>
                  <Btn small primary href="/tryout">Register</Btn>
                </div>
              </div>
            )}
          </nav>

          {/* ── Hero ── */}
          <section style={{
            minHeight: mobile ? "100dvh" : "100vh", display: "flex", alignItems: "center",
            padding: mobile ? "0 20px" : "0 48px",
            maxWidth: 1320, margin: "0 auto",
          }}>
            <div style={{ maxWidth: mobile ? "100%" : 780, paddingTop: mobile ? 40 : 0 }}>
              <div className="ha" style={{
                animationDelay: "0.2s", display: "inline-block", padding: "5px 14px",
                borderRadius: 20, border: `1.5px solid ${t.blue}`, fontSize: mobile ? 9 : 11,
                fontWeight: 700, color: t.blue, marginBottom: mobile ? 20 : 28, letterSpacing: 1,
              }}>
                LICENSE PLATES FOR THE AGENTIC ECONOMY
              </div>
              <h1 style={{
                fontSize: mobile ? 32 : 68, fontWeight: 900, lineHeight: 1.02, margin: 0,
                letterSpacing: mobile ? -1.5 : -2.5, textTransform: "uppercase",
                color: t.ink, transition: "color .4s",
              }}>
                <span className="ha" style={{ animationDelay: "0.35s", display: "block" }}>A billion agents,</span>
                <span className="ha" style={{ animationDelay: "0.55s", display: "block" }}>
                  Every one accountable<span style={{ color: t.blue }}>.</span>
                </span>
              </h1>
              <p className="ha" style={{
                animationDelay: "0.85s", fontSize: mobile ? 14 : 17, color: t.inkMuted,
                margin: "28px 0 0", lineHeight: 1.7, maxWidth: 460, fontWeight: 400, transition: "color .4s",
              }}>
                On-chain identity, verification, and reputation for AI agents.
                Every autonomous action traces back to an accountable human.
              </p>
              <div className="ha" style={{ animationDelay: "1s", display: "flex", gap: 14, marginTop: mobile ? 28 : 40, flexWrap: "wrap" }}>
                <Btn primary small={mobile} href="/demo">Live Demo</Btn>
                <Btn small={mobile} href="/tryout">Get Your License</Btn>
                <Btn small={mobile} href="/feed">Agent Feed</Btn>
              </div>
              <a className="ha" href="https://github.com/hihi-yessir/whitewall-os" target="_blank" rel="noopener noreferrer" style={{
                animationDelay: "1.15s", display: "inline-block", marginTop: 12,
                fontSize: 12, color: t.inkMuted, textDecoration: "none", fontWeight: 600,
                letterSpacing: 0.5,
              }}>
                GitHub {"\u2197"}
              </a>
            </div>
          </section>

          {/* ── Gradient transition from hero mesh into content ── */}
          <div style={{
            height: 120, pointerEvents: "none",
            background: `linear-gradient(180deg, transparent 0%, ${t.bg}D0 100%)`,
            transition: "background .4s",
          }} />

          {/* ── Content sections (overlay on mesh) ── */}
          <div style={{ background: `${t.bg}D0`, backdropFilter: "blur(4px)" }}>
            <ProblemSection />
            <div style={{ height: 1, background: `${t.cardBorder}60`, maxWidth: 1320, margin: "0 auto" }} />
            <PipelineSection />
            <div style={{ height: 1, background: `${t.cardBorder}60`, maxWidth: 1320, margin: "0 auto" }} />
            <IntegrateSection />
            <div style={{ height: 1, background: `${t.cardBorder}60`, maxWidth: 1320, margin: "0 auto" }} />
            <Footer />
          </div>
        </div>

        {/* ── Global styles ── */}
        <style>{`
          @keyframes hi{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
          .ha{opacity:0;animation:hi .7s cubic-bezier(.16,1,.3,1) forwards}
          @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
          *{box-sizing:border-box;margin:0;padding:0}
          ::selection{background:${t.blue}30}
          input::placeholder{color:${t.inkMuted}}
          html{scroll-behavior:smooth}
        `}</style>
    </div>
  );
}
