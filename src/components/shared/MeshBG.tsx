"use client";

import { useRef, useEffect, useContext } from "react";
import * as THREE from "three";
import { ThemeCtx } from "./theme";

export function MeshBG() {
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
    const camX = isMob ? 4 : 2;
    const lookX = isMob ? 4 : 2;
    cam.position.set(camX, 2, 45);
    cam.lookAt(lookX, 0, 0);
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: !isMob });
    r.setSize(W, H);
    r.setPixelRatio(isMob ? 1 : Math.min(devicePixelRatio, 2));

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
