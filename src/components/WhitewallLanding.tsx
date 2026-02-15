"use client";

import { useState, useEffect, useRef, useContext } from "react";
import * as THREE from "three";
import { themes, ThemeCtx, ThemeToggle, Btn, NavLink, CodeViewer } from "./shared/theme";
import { useIsMobile, useReveal } from "./shared/hooks";
import { MeshBG } from "./shared/MeshBG";
import type { ThemeMode } from "./shared/theme";

/* MeshBG extracted to shared/MeshBG.tsx */
/* eslint-disable */
function _MeshBG_REFERENCE_DEAD_CODE() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const raf = useRef<number>(0);
  const { mode } = useContext(ThemeCtx);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const isMob = window.innerWidth < 768;
    const W = cv.clientWidth, H = cv.clientHeight;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
    // Desktop: camera centered, layers pushed far right so mesh fills right 60%. Mobile: centered.
    const camX = isMob ? 4 : 2;
    const lookX = isMob ? 4 : 2;
    cam.position.set(camX, 2, 45);
    cam.lookAt(lookX, 0, 0);
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: !isMob });
    r.setSize(W, H);
    r.setPixelRatio(isMob ? 1 : Math.min(devicePixelRatio, 2));

    // Desktop: layers shifted far right (+8 from original). Mobile: original centered positions.
    const xShift = isMob ? 0 : 8;
    const layerDefs = [
      { x: -4 + xShift, op: 0.12, spd: 0.1, amp: 0.45, seg: 20, freq: 0.4, thick: 1, gap: 0 },
      { x: -0.8 + xShift, op: 0.1, spd: 0.2, amp: 0.38, seg: 28, freq: 0.25, thick: 3, gap: 0.15 },
      { x: 2.5 + xShift, op: 0.15, spd: 0.32, amp: 0.3, seg: 40, freq: 0.28, thick: 2, gap: 0.2 },
      { x: 5.8 + xShift, op: 0.18, spd: 0.45, amp: 0.24, seg: 48, freq: 0.22, thick: 4, gap: 0.12 },
      { x: 9 + xShift, op: 0.14, spd: 0.6, amp: 0.18, seg: 34, freq: 0.3, thick: 2, gap: 0.16 },
      { x: 12 + xShift, op: 0.08, spd: 0.78, amp: 0.1, seg: 22, freq: 0.35, thick: 2, gap: 0.12 },
    ];

    const meshMats: THREE.MeshBasicMaterial[] = [];
    const layers: THREE.Mesh[] = [];
    const flash = new Float32Array(6);
    const pH = 20, pW = 20;

    layerDefs.forEach((c, li) => {
      const useThick = isMob ? 1 : c.thick;
      for (let t = 0; t < useThick; t++) {
        const offset = (t - (c.thick - 1) / 2) * c.gap;
        const subSeg = Math.max(8, (isMob ? Math.floor(c.seg * 0.5) : c.seg) - t * 4);
        const geo = new THREE.PlaneGeometry(pW, pH, subSeg, subSeg);
        const subOp = c.op * (1 - t * 0.15);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, wireframe: true, transparent: true,
          opacity: Math.max(0.02, subOp), side: THREE.DoubleSide,
        });
        (mat as any).userData = { baseOp: Math.max(0.02, subOp) };
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = Math.PI / 2;
        mesh.position.x = c.x + offset;
        mesh.userData = { ...c, subIdx: t, layerIdx: li, orig: Float32Array.from(geo.attributes.position.array) };
        scene.add(mesh); layers.push(mesh); meshMats.push(mat);
      }
      const gSeg = Math.max(6, Math.floor(c.seg * 0.3));
      const gGeo = new THREE.PlaneGeometry(pW, pH, gSeg, gSeg);
      const gMat = new THREE.MeshBasicMaterial({
        color: 0x375bd2, wireframe: true, transparent: true,
        opacity: c.op * 0.15, side: THREE.DoubleSide,
      });
      (gMat as any).userData = { baseOp: c.op * 0.15 };
      const glow = new THREE.Mesh(gGeo, gMat);
      glow.rotation.y = Math.PI / 2; glow.position.x = c.x;
      glow.userData = { isGlow: true, layerIdx: li, origG: Float32Array.from(gGeo.attributes.position.array), ...c };
      scene.add(glow); layers.push(glow as any); meshMats.push(gMat);
    });

    const agentGroup = new THREE.Group(); scene.add(agentGroup);

    interface Agent {
      mesh: THREE.Mesh; trail: THREE.Line; tGeo: THREE.BufferGeometry;
      tPos: Float32Array; tc: number; y: number; z: number;
      isGood: boolean; blockedAt: number; speed: number;
      blocked: boolean; blockTime: number; dead: boolean;
      bobPh: number; lastLayerPassed: number;
    }

    const agents: Agent[] = [];
    const maxAgents = isMob ? 30 : 90;
    const blockChance = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

    function spawnAgent(): Agent {
      let blockedAt = -1;
      for (let i = 0; i < blockChance.length; i++) {
        if (Math.random() < blockChance[i]) { blockedAt = i; break; }
      }
      const isGood = blockedAt === -1;
      const y = (Math.random() - 0.5) * 13, z = (Math.random() - 0.5) * 3;
      const geo = new THREE.SphereGeometry(0.06, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x375bd2, transparent: true, opacity: 0.9 });
      const spawnX = isMob ? -12 : -20;
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(spawnX, y, z);
      const tc = 18;
      const tGeo = new THREE.BufferGeometry();
      const tPos = new Float32Array(tc * 3);
      for (let i = 0; i < tc; i++) { tPos[i * 3] = spawnX; tPos[i * 3 + 1] = y; tPos[i * 3 + 2] = z; }
      tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
      const tMat = new THREE.LineBasicMaterial({ color: 0x375bd2, transparent: true, opacity: 0.12 });
      const trail = new THREE.Line(tGeo, tMat);
      agentGroup.add(mesh); agentGroup.add(trail);
      return { mesh, trail, tGeo, tPos, tc, y, z, isGood, blockedAt,
        speed: 2.5 + Math.random() * 3.5, blocked: false, blockTime: 0,
        dead: false, bobPh: Math.random() * Math.PI * 2, lastLayerPassed: -1 };
    }

    for (let i = 0; i < (isMob ? 8 : 22); i++) {
      const a = spawnAgent();
      a.mesh.position.x = (isMob ? -12 : -20) + Math.random() * (isMob ? 28 : 50);
      for (let j = 0; j < a.tc; j++) {
        a.tPos[j * 3] = a.mesh.position.x - j * 0.15;
        a.tPos[j * 3 + 1] = a.y; a.tPos[j * 3 + 2] = a.z;
      }
      agents.push(a);
    }

    const dC = isMob ? 15 : 35;
    const dGeo = new THREE.BufferGeometry();
    const dP = new Float32Array(dC * 3);
    for (let i = 0; i < dC; i++) {
      dP[i * 3] = (Math.random() - 0.5) * 50;
      dP[i * 3 + 1] = (Math.random() - 0.5) * 18;
      dP[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    dGeo.setAttribute("position", new THREE.BufferAttribute(dP, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x444444, size: 0.02, transparent: true, opacity: 0.1 });
    scene.add(new THREE.Points(dGeo, dustMat));

    let spawnT = 0;
    const anim = (time: number) => {
      const t = time * 0.001, dt = 0.016, mx = mouse.current.x, my = mouse.current.y;
      const isDark = modeRef.current === "dark";
      const lineCol = isDark ? 0xffffff : 0x000000;
      dustMat.color.setHex(isDark ? 0x444444 : 0x999999);

      for (let i = 0; i < 6; i++) flash[i] = Math.max(0, flash[i] - dt * 1.8);

      layers.forEach((l) => {
        const li = l.userData.layerIdx;
        const fb = flash[li] || 0;
        if (l.userData.isGlow) {
          const pc = l.userData, o = l.userData.origG;
          const g = l.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < g.length; i += 3) {
            g[i + 2] = Math.sin(o[i] * pc.freq * 1.1 + t * pc.spd * 1.3) *
              Math.cos(o[i + 1] * pc.freq * 0.5 + t * pc.spd * 0.4) * pc.amp * 1.1;
          }
          l.geometry.attributes.position.needsUpdate = true;
          const mat = l.material as THREE.MeshBasicMaterial;
          mat.opacity = (mat as any).userData.baseOp * (0.7 + 0.3 * Math.sin(t * pc.spd * 1.8)) + fb * 0.12;
          return;
        }
        const { spd, amp, freq, orig, subIdx } = l.userData;
        if (!orig) return;
        const mat = l.material as THREE.MeshBasicMaterial;
        if (mat.color.getHex() !== lineCol) mat.color.setHex(lineCol);
        const p = l.geometry.attributes.position.array as Float32Array;
        const phase = subIdx * 0.7;
        for (let i = 0; i < p.length; i += 3) {
          const ox = orig[i], oy = orig[i + 1];
          let d = Math.sin(ox * freq + t * spd + phase) * Math.cos(oy * freq * 0.7 + t * spd * 0.5) * amp;
          d += Math.sin(ox * freq * 2 - t * spd * 0.35 + phase) * Math.cos(oy * freq * 0.4 + t * spd * 0.15) * amp * 0.35;
          d += Math.sin(oy * freq * 0.25 + t * spd * 0.8) * amp * 0.2;
          const ddx = mx * 10 - ox, ddy = my * 10 - oy, dist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist < 5) d += Math.sin(dist * 1.2 - t * 2) * (1 - dist / 5) * 0.12;
          p[i + 2] = d;
        }
        l.geometry.attributes.position.needsUpdate = true;
        mat.opacity = (mat as any).userData.baseOp + fb * 0.08;
      });

      spawnT += dt;
      if (spawnT > 0.2 && agents.length < maxAgents) { spawnT = 0; agents.push(spawnAgent()); }

      for (let i = agents.length - 1; i >= 0; i--) {
        const a = agents[i]; if (a.dead) continue;
        const px = a.mesh.position.x;
        if (!a.blocked) {
          for (let li = 0; li < layerDefs.length; li++) {
            if (li > a.lastLayerPassed) {
              const lx = layerDefs[li].x;
              if (px >= lx - 0.3 && px <= lx + 0.3) { a.lastLayerPassed = li; flash[li] = Math.min(flash[li] + 0.3, 1.0); }
            }
          }
          if (a.blockedAt >= 0) {
            const lx = layerDefs[a.blockedAt].x;
            if (px >= lx - 0.2 && px <= lx + 0.2) {
              a.blocked = true; a.blockTime = t;
              (a.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xd94040);
              (a.trail.material as THREE.LineBasicMaterial).color.setHex(0xd94040);
              (a.trail.material as THREE.LineBasicMaterial).opacity = 0.05;
              flash[a.blockedAt] = Math.min(flash[a.blockedAt] + 0.4, 1.0);
            }
          }
          if (!a.blocked) {
            a.mesh.position.x += a.speed * dt;
            a.mesh.position.y = a.y + Math.sin(t * 1.2 + a.bobPh) * 0.04;
            const passX = isMob ? 13 : 21;
            const exitX = isMob ? 18 : 35;
            if (px > passX && a.isGood) {
              (a.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x2ead6b);
              (a.trail.material as THREE.LineBasicMaterial).color.setHex(0x2ead6b);
            }
            if (px > exitX) { a.dead = true; agentGroup.remove(a.mesh); agentGroup.remove(a.trail); }
          }
        } else {
          const bt = t - a.blockTime;
          (a.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - bt * 0.5);
          const s = Math.max(0.01, 1 - bt * 0.4); a.mesh.scale.set(s, s, s);
          a.mesh.position.x -= 0.08 * dt;
          if (bt > 2.5) { a.dead = true; agentGroup.remove(a.mesh); agentGroup.remove(a.trail); }
        }
        if (!a.dead) {
          const tp = a.tPos;
          for (let j = a.tc - 1; j > 0; j--) { tp[j * 3] = tp[(j - 1) * 3]; tp[j * 3 + 1] = tp[(j - 1) * 3 + 1]; tp[j * 3 + 2] = tp[(j - 1) * 3 + 2]; }
          tp[0] = a.mesh.position.x; tp[1] = a.mesh.position.y; tp[2] = a.mesh.position.z;
          a.tGeo.attributes.position.needsUpdate = true;
        }
      }
      for (let i = agents.length - 1; i >= 0; i--) { if (agents[i].dead) agents.splice(i, 1); }

      const dp2 = dGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dC; i++) { dp2[i * 3] += 0.002; if (dp2[i * 3] > 25) dp2[i * 3] = -25; }
      dGeo.attributes.position.needsUpdate = true;

      cam.position.x = camX + mx * 1.0; cam.position.y = 2 + my * 0.6;
      cam.lookAt(lookX, 0, 0); r.render(scene, cam);
      raf.current = requestAnimationFrame(anim);
    };
    raf.current = requestAnimationFrame(anim);

    const onM = (e: MouseEvent) => {
      const rc = cv.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rc.left) / rc.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rc.top) / rc.height) * 2 + 1;
    };
    const onR = () => {
      const w2 = cv.clientWidth, h2 = cv.clientHeight;
      cam.aspect = w2 / h2; cam.updateProjectionMatrix(); r.setSize(w2, h2);
    };
    window.addEventListener("mousemove", onM);
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("mousemove", onM); window.removeEventListener("resize", onR); r.dispose(); };
  }, []);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

// ── UI components (ThemeToggle, Btn, NavLink, useReveal imported from shared) ──

// ── Problem Section ──

function ProblemSection() {
  const { t } = useContext(ThemeCtx);
  const [ref, vis] = useReveal();
  const mobile = useIsMobile();
  const cards = [
    { num: "01", title: "No Identity",
      desc: "AI agents transact via x402, but the payment protocol has no identity layer. An agent can pay $0.50 and remain completely anonymous.",
      icon: "\uD83D\uDC64" },
    { num: "02", title: "Sybil Floods",
      desc: "One person deploys 1,000 agents. Each pays independently. No way to detect they share an operator \u2014 or to hold anyone accountable.",
      icon: "\uD83D\uDD04" },
    { num: "03", title: "No Trust Layer",
      desc: "Service providers have no on-chain mechanism to verify who is behind an agent before fulfilling a request. Deepfakes, spam, abuse \u2014 all anonymous.",
      icon: "\u26A0" },
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
              <span style={{ fontSize: 24 }}>{c.icon}</span>
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
    { step: "G3", title: "Liveness", desc: "EVMClient.read \u2192 Verification TTL. Is the human bond still valid and not expired?" },
    { step: "G4", title: "Reputation", desc: "EVMClient.read \u2192 ReputationRegistry. What tier is this agent? Does it meet the minimum service requirement?" },
    { step: "DON", title: "Consensus", desc: "3/5 DON nodes reach consensus on the verification report. Signed report submitted on-chain." },
    { step: "ACE", title: "Policy", desc: "runPolicy() \u2014 HumanVerifiedPolicy enforces the final on-chain safety check. Approve or reject." },
  ];
  return (
    <section id="pipeline" ref={ref as React.RefObject<HTMLElement>}
      style={{ padding: mobile ? "80px 20px" : "120px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "all .8s cubic-bezier(.16,1,.3,1)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: t.blue, textTransform: "uppercase" }}>The Pipeline</span>
        <h2 style={{ fontSize: mobile ? 32 : 48, fontWeight: 900, letterSpacing: -2, margin: "16px 0 0", lineHeight: 1.05, textTransform: "uppercase" }}>
          5-Gate verification with<br />
          CRE&apos;s DON consensus<span style={{ color: t.blue }}>.</span><br />
          &amp; ACE enforcement<span style={{ color: t.blue }}>.</span>
        </h2>
        <p style={{ fontSize: mobile ? 15 : 17, color: t.inkMuted, margin: "20px 0 0", maxWidth: 520, lineHeight: 1.7 }}>
          Every request passes through CRE&apos;s 5-Gate pipeline. DON nodes sign the report. ACE enforces on-chain — even if CRE is compromised.
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
      { text: "const status = await wos.getAgentStatus(", color: "default" },
      { text: "    agentId", color: "blue" },
      { text: ");", color: "default" },
      { text: "" },
      { text: "if (status.isHumanVerified) {", color: "keyword" },
      { text: "    // Agent is accountable", color: "muted" },
      { text: "}", color: "default" },
    ],
  },
  go: {
    file: "verify.go",
    lines: [
      { text: 'import "github.com/whitewall-os/sdk-go"', color: "keyword" },
      { text: "" },
      { text: "client, err := whitewallOS.Connect(", color: "default" },
      { text: '    whitewallOS.BaseSepolia,', color: "string" },
      { text: ")", color: "default" },
      { text: "" },
      { text: "status, err := client.GetAgentStatus(", color: "default" },
      { text: "    agentId,", color: "blue" },
      { text: ")", color: "default" },
      { text: "" },
      { text: "if status.IsHumanVerified {", color: "keyword" },
      { text: "    // Agent is accountable", color: "muted" },
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
  { name: "getAgentStatus", desc: "Full status — registration, human verification, tier, owner, wallet, validation count.", sig: "(agentId)" },
  { name: "isHumanVerified", desc: "Quick boolean — does this agent have an accountable human?", sig: "(agentId)" },
  { name: "isRegistered", desc: "Check if an agent exists in the IdentityRegistry.", sig: "(agentId)" },
  { name: "getValidationSummary", desc: "Validation count and average score for an agent.", sig: "(agentId)" },
  { name: "onAccessGranted", desc: "Watch for real-time AccessGranted events on-chain.", sig: "(callback)" },
];

const mcpTools = [
  { name: "whitewall_os_check_agent", desc: "Quick check — is this agent registered and human-verified?", sig: "(agentId)" },
  { name: "whitewall_os_get_status", desc: "Full report — registration, tier, owner, wallet, validations.", sig: "(agentId)" },
  { name: "whitewall_os_get_policy", desc: "Read protocol policy from chain — registries, validators, required tier.", sig: "()" },
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
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            <CodeViewer code={solidityCode} colorMap={colorMap} />
            <FeatureCards items={solidityModifiers} label="3 Modifiers" />
          </div>
        )}

        {tier === "app" && (
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
                        padding: "3px 10px", border: "none", cursor: "pointer",
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
        )}

        {tier === "agent" && (
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            <CodeViewer code={mcpConfig} colorMap={colorMap} />
            <FeatureCards items={mcpTools} label="3 Tools" />
          </div>
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
        <Btn primary small={mobile}>Read the Memorandum</Btn>
        <Btn small={mobile} href="/demo">Try Demo</Btn>
        <Btn small={mobile} href="https://github.com">GitHub</Btn>
      </div>

      {/* Powered by */}
      <div style={{ marginTop: 60, paddingTop: 30, borderTop: `1px solid ${t.cardBorder}`, display: "flex", justifyContent: "center", alignItems: "center", gap: mobile ? 16 : 36, flexWrap: "wrap" }}>
        <span style={{ fontSize: mobile ? 10 : 12, color: t.inkMuted, whiteSpace: "nowrap", fontWeight: 500 }}>Powered by:</span>
        {["Chainlink CRE", "Chainlink DON", "Chainlink ACE", "World ID", "x402"].map((n) => (
          <span key={n} style={{ fontSize: mobile ? 9 : 12, color: t.inkMuted, opacity: 0.3, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>{n}</span>
        ))}
      </div>

      {/* Links */}
      <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: mobile ? 8 : 32, flexWrap: "wrap" }}>
        {["GitHub", "Docs", "Discord", "Twitter"].map((l) => (
          <a key={l} href="#" style={{ fontSize: 13, color: t.inkMuted, textDecoration: "none", fontWeight: 600, padding: mobile ? "8px 12px" : 0 }}>{l}</a>
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
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Btn small>Memorandum</Btn><Btn small primary href="/demo">Try Demo</Btn>
      </div>
    </div>
  );
}

// ── Main App ──

export default function WhitewallLanding() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  const t = themes[mode];
  const [menuOpen, setMenuOpen] = useState(false);
  const mobile = useIsMobile();

  return (
    <ThemeCtx.Provider value={{ mode, toggle, t }}>
      <div style={{
        background: t.bg, minHeight: "100vh", color: t.ink,
        fontFamily: "'Inter',system-ui,-apple-system,sans-serif",
        overflow: "auto", transition: "background .4s,color .4s",
      }}>
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

        {/* Fixed mesh background — visible behind all content */}
        <MeshBG />

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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 4, height: 22, borderRadius: 1, background: t.ink, opacity: t.logoDots[i], transition: "background .4s" }} />
                ))}
              </div>
              <span style={{ fontWeight: 900, fontSize: mobile ? 16 : 20, letterSpacing: 1, textTransform: "uppercase" }}>Whitewall</span>
            </div>

            {mobile ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <ThemeToggle />
                <button onClick={() => setMenuOpen(true)} style={{
                  width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${t.cardBorder}`,
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
                  <Btn small>Memorandum</Btn>
                  <Btn small primary href="/demo">Try Demo</Btn>
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
                fontSize: mobile ? 38 : 68, fontWeight: 900, lineHeight: 1.02, margin: 0,
                letterSpacing: mobile ? -1.5 : -2.5, textTransform: "uppercase",
                color: t.ink, transition: "color .4s", whiteSpace: "nowrap",
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
                <Btn primary small={mobile}>Read the Memorandum</Btn>
                <Btn small={mobile} href="/demo">Try Demo</Btn>
                <Btn small={mobile} href="https://github.com">GitHub</Btn>
              </div>
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
    </ThemeCtx.Provider>
  );
}
