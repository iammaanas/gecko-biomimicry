window.addEventListener('load', () => {
  const canvas = document.getElementById('stage-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight - 54;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  resize();

  // ── helpers ──────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function getProgress() {
    const max = document.body.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return clamp(window.scrollY / max, 0, 1);
  }

  function drawScaleBar(x, y, w, label) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x + w, y - 4); ctx.lineTo(x + w, y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y - 9);
    ctx.restore();
  }

  function label(text, x, y, color, bold) {
    ctx.fillStyle = color || 'rgba(255,189,89,0.9)';
    ctx.font = (bold ? 'bold ' : '') + '12px Segoe UI';
    ctx.fillText(text, x, y);
  }

  function callout(x1, y1, x2, y2, text, subtext, color) {
    color = color || 'rgba(255,189,89,0.5)';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + (x2 > x1 ? 36 : -36), y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const lx = x2 > x1 ? x2 + 40 : x2 - 40;
    ctx.textAlign = x2 > x1 ? 'left' : 'right';
    ctx.fillStyle = color.replace('0.5', '0.9');
    ctx.font = 'bold 12px Segoe UI';
    ctx.fillText(text, lx, y2 - 4);
    if (subtext) {
      ctx.fillStyle = color.replace('0.5', '0.5');
      ctx.font = '11px Segoe UI';
      ctx.fillText(subtext, lx, y2 + 10);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── STAGE 0: Gecko Toe ───────────────────────────────
  function drawStage0(p) {
    const cx = W / 2, cy = H / 2;
    const sp = smooth(p);

    // Background
    const bg = ctx.createRadialGradient(cx, cy * 0.8, 0, cx, cy, Math.max(W, H));
    bg.addColorStop(0, '#0e1a10');
    bg.addColorStop(1, '#0a0f14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Surface
    const surfY = cy + H * 0.2;
    const sg = ctx.createLinearGradient(0, surfY, 0, H);
    sg.addColorStop(0, 'rgba(90,130,170,0.28)');
    sg.addColorStop(1, 'rgba(90,130,170,0.04)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, surfY, W, H - surfY);
    ctx.strokeStyle = 'rgba(140,190,240,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, surfY); ctx.lineTo(W, surfY); ctx.stroke();

    // Toe shape
    const tw = Math.min(W * 0.46, 260);
    const th = Math.min(H * 0.42, 210);
    const tx = cx - tw / 2;
    const ty = surfY - th;

    // Toe shadow
    const shadowGrad = ctx.createRadialGradient(cx, surfY, 0, cx, surfY, tw * 0.6);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(cx, surfY + 6, tw * 0.45, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Toe body
    const tg = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
    tg.addColorStop(0, '#2e2018');
    tg.addColorStop(0.5, '#1e1610');
    tg.addColorStop(1, '#0f0c08');
    ctx.beginPath();
    ctx.moveTo(tx + tw * 0.15, ty + 2);
    ctx.bezierCurveTo(cx - tw * 0.05, ty - th * 0.08, cx + tw * 0.05, ty - th * 0.08, tx + tw * 0.85, ty + 2);
    ctx.bezierCurveTo(tx + tw * 1.04, ty + th * 0.32, tx + tw * 1.0, ty + th * 0.75, tx + tw * 0.94, surfY - 1);
    ctx.lineTo(tx + tw * 0.06, surfY - 1);
    ctx.bezierCurveTo(tx, ty + th * 0.75, tx - tw * 0.04, ty + th * 0.32, tx + tw * 0.15, ty + 2);
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Toe pad (setae area)
    const padH = 20;
    const pg = ctx.createLinearGradient(0, surfY - padH, 0, surfY);
    pg.addColorStop(0, 'rgba(255,189,89,0.06)');
    pg.addColorStop(1, 'rgba(255,189,89,0.22)');
    ctx.beginPath();
    ctx.roundRect(tx + tw * 0.07, surfY - padH, tw * 0.86, padH, [4, 4, 0, 0]);
    ctx.fillStyle = pg;
    ctx.fill();

    // Ridges on toe pad
    ctx.strokeStyle = 'rgba(255,189,89,0.18)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 8; i++) {
      const lx = tx + tw * 0.07 + (tw * 0.86 / 8) * i;
      ctx.beginPath(); ctx.moveTo(lx, surfY - padH); ctx.lineTo(lx, surfY); ctx.stroke();
    }

    // Labels
    ctx.globalAlpha = sp;
    callout(tx + tw * 0.93, surfY - 10, tx + tw * 1.08, surfY - 50, 'Setae pad', '~200,000 setae/toe');
    callout(cx, ty + 30, cx - tw * 0.5, ty - 20, 'Gecko toe', null, 'rgba(180,160,140,0.5)');

    ctx.fillStyle = 'rgba(140,190,240,0.4)';
    ctx.font = '11px Segoe UI';
    ctx.fillText('Glass surface', W * 0.04, surfY + 22);
    ctx.globalAlpha = 1;

    drawScaleBar(W - 130, H - 36, 70, '~1 cm');

    if (p < 0.6) {
      ctx.globalAlpha = (1 - p / 0.6) * 0.55;
      ctx.fillStyle = 'rgba(255,189,89,0.6)';
      ctx.font = '11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('↓  scroll to zoom in', W / 2, H - 22);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  // ── STAGE 1: Lamellae ────────────────────────────────
  function drawStage1(p) {
    const cx = W / 2, cy = H / 2;
    const sp = smooth(p);

    // Background — inside toe pad
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#181008');
    bg.addColorStop(1, '#0a0c0e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const n = 7;
    const lH = Math.min(H * 0.074, 42);
    const gap = Math.min(H * 0.055, 30);
    const total = n * (lH + gap) - gap;
    const sy = cy - total / 2;
    const lW = Math.min(W * 0.8, 540);
    const lX = cx - lW / 2;

    for (let i = 0; i < n; i++) {
      const y = sy + i * (lH + gap);
      const fade = clamp(sp * 2.2 - i * 0.08, 0, 1);

      // Ridge shape
      const rg = ctx.createLinearGradient(lX, y, lX, y + lH);
      rg.addColorStop(0, `rgba(255,189,89,${0.42 * fade})`);
      rg.addColorStop(0.35, `rgba(255,189,89,${0.2 * fade})`);
      rg.addColorStop(1, `rgba(255,189,89,${0.04 * fade})`);

      ctx.beginPath();
      ctx.moveTo(lX, y + lH * 0.5);
      ctx.bezierCurveTo(lX + lW * 0.08, y, lX + lW * 0.92, y, lX + lW, y + lH * 0.5);
      ctx.bezierCurveTo(lX + lW * 0.92, y + lH, lX + lW * 0.08, y + lH, lX, y + lH * 0.5);
      ctx.fillStyle = rg;
      ctx.fill();

      // Ridge highlight top edge
      ctx.beginPath();
      ctx.moveTo(lX, y + lH * 0.5);
      ctx.bezierCurveTo(lX + lW * 0.08, y, lX + lW * 0.92, y, lX + lW, y + lH * 0.5);
      ctx.strokeStyle = `rgba(255,220,140,${0.45 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tiny setae hint at later progress
      if (p > 0.35) {
        const sAlpha = clamp((p - 0.35) / 0.4, 0, 1) * fade * 0.55;
        ctx.strokeStyle = `rgba(255,189,89,${sAlpha})`;
        ctx.lineWidth = 0.6;
        const sc = 32;
        for (let s = 0; s < sc; s++) {
          const sx = lX + (lW / sc) * s + lW / sc / 2;
          const baseY = y + lH * 0.12;
          const h = 7 + Math.sin(s * 1.1 + i * 0.7) * 2;
          const lean = Math.sin(s * 0.9) * 1.5;
          ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx + lean, baseY - h); ctx.stroke();
        }
      }
    }

    // Labels
    ctx.globalAlpha = smooth(p);
    callout(lX + lW, sy + 2 * (lH + gap) + lH / 2, lX + lW + 20, sy + 1 * (lH + gap), 'Lamella', '~500 μm wide');
    ctx.fillStyle = 'rgba(255,189,89,0.3)';
    ctx.font = '11px Segoe UI';
    ctx.fillText(`${n} lamellae visible`, W * 0.04, sy - 16);
    ctx.globalAlpha = 1;

    drawScaleBar(W - 130, H - 36, 80, '~500 μm');
  }

  // ── STAGE 2: Setae Field ─────────────────────────────
  function drawStage2(p) {
    const cx = W / 2, cy = H / 2;
    const sp = smooth(p);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0e180f');
    bg.addColorStop(1, '#060c08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const baseY = cy + H * 0.22;

    // Lamella surface
    const sg = ctx.createLinearGradient(0, baseY, 0, H);
    sg.addColorStop(0, 'rgba(255,189,89,0.16)');
    sg.addColorStop(1, 'rgba(255,189,89,0.03)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, baseY, W, H - baseY);
    ctx.strokeStyle = 'rgba(255,189,89,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(W, baseY); ctx.stroke();

    // Dense setae
    const colW = 16;
    const cols = Math.ceil(W / colW);
    const rows = 7;
    const rSpacing = Math.min(H * 0.055, 28);

    for (let row = 0; row < rows; row++) {
      const rowFade = clamp(sp * 2.0 - row * 0.15, 0, 1);
      if (rowFade <= 0) continue;
      const maxH = (14 + row * 5);

      for (let col = 0; col < cols; col++) {
        const x = col * colW + (row % 2) * (colW / 2);
        const by = baseY - row * rSpacing;
        const h = (maxH * (0.7 + Math.sin(col * 1.4 + row * 0.9) * 0.3)) * rowFade;
        const lean = Math.sin(col * 0.65 + row * 0.5) * 3;
        const alpha = (0.35 + rowFade * 0.45 + (rows - row) / rows * 0.1);

        ctx.strokeStyle = `rgba(255,189,89,${alpha})`;
        ctx.lineWidth = 0.8 + row * 0.08;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.quadraticCurveTo(x + lean * 0.4, by - h * 0.5, x + lean, by - h);
        ctx.stroke();

        // Tip dot for top rows
        if (row >= rows - 2 && rowFade > 0.6) {
          ctx.fillStyle = `rgba(255,220,140,${(rowFade - 0.6) * 2 * 0.6})`;
          ctx.beginPath();
          ctx.arc(x + lean, by - h, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Labels
    ctx.globalAlpha = smooth(p);
    callout(W / 2, baseY - 55, W / 2 + W * 0.18, baseY - 100, 'Seta', '~100 μm tall');
    ctx.fillStyle = 'rgba(255,189,89,0.35)';
    ctx.font = '11px Segoe UI';
    ctx.fillText('~1,000 setae per lamella', W * 0.04, baseY - 14);
    ctx.fillStyle = 'rgba(255,189,89,0.25)';
    ctx.fillText('Lamella surface', W * 0.04, baseY + 22);
    ctx.globalAlpha = 1;

    drawScaleBar(W - 130, H - 36, 60, '~100 μm');
  }

  // ── STAGE 3: Spatulae ────────────────────────────────
  function drawStage3(p, time) {
    const cx = W / 2, cy = H / 2;
    const sp = smooth(p);

    ctx.fillStyle = '#04080e';
    ctx.fillRect(0, 0, W, H);

    // Subtle radial
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
    bg.addColorStop(0, 'rgba(255,189,89,0.025)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const surfY = cy + H * 0.28;

    // Surface
    const sg = ctx.createLinearGradient(0, surfY, 0, H);
    sg.addColorStop(0, 'rgba(100,160,230,0.22)');
    sg.addColorStop(1, 'rgba(100,160,230,0.04)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, surfY, W, H - surfY);
    ctx.strokeStyle = 'rgba(120,175,245,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, surfY); ctx.lineTo(W, surfY); ctx.stroke();

    // Surface molecule hints
    if (p > 0.3) {
      const mAlpha = clamp((p - 0.3) / 0.5, 0, 1) * 0.45;
      const mSpacing = 26;
      for (let mx = mSpacing / 2; mx < W; mx += mSpacing) {
        const jy = Math.sin(mx * 0.22) * 4;
        const mg = ctx.createRadialGradient(mx, surfY + 7 + jy, 0, mx, surfY + 7 + jy, 6);
        mg.addColorStop(0, `rgba(160,210,255,${mAlpha})`);
        mg.addColorStop(1, 'rgba(100,160,240,0)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(mx, surfY + 7 + jy, 6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Seta shaft
    const topY = cy - H * 0.34;
    const botY = surfY - 32;
    const sw = Math.max(5, 14 - sp * 4);

    const shaftG = ctx.createLinearGradient(cx - sw, topY, cx + sw, topY);
    shaftG.addColorStop(0, 'rgba(255,189,89,0.28)');
    shaftG.addColorStop(0.5, 'rgba(255,189,89,0.82)');
    shaftG.addColorStop(1, 'rgba(255,189,89,0.28)');

    ctx.beginPath();
    ctx.moveTo(cx - sw / 2, topY);
    ctx.lineTo(cx + sw / 2, topY);
    ctx.bezierCurveTo(cx + sw / 2 + 3, cy - 20, cx + sw / 3, botY - 20, cx + 1, botY);
    ctx.bezierCurveTo(cx - sw / 3, botY - 20, cx - sw / 2 - 3, cy - 20, cx - sw / 2, topY);
    ctx.fillStyle = shaftG;
    ctx.fill();

    // Tapering highlight
    ctx.strokeStyle = 'rgba(255,220,140,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2, topY);
    ctx.bezierCurveTo(cx - sw / 2 - 3, cy - 20, cx - sw / 3, botY - 20, cx - 1, botY);
    ctx.stroke();

    // Spatulae fan
    const numS = 26;
    const spread = Math.min(W * 0.3, 170) * sp;
    const fanDrop = 30 * sp;

    for (let i = 0; i < numS; i++) {
      const t = i / (numS - 1);
      const angle = (t - 0.5) * Math.PI * 0.88;
      const tipX = cx + Math.sin(angle) * spread;
      const tipY = botY + Math.cos(angle) * 10 + fanDrop * (1 - Math.cos(angle * 2));
      const alpha = (0.45 + (1 - Math.abs(t - 0.5) * 1.8) * 0.45) * sp;

      // Branch
      ctx.strokeStyle = `rgba(255,189,89,${alpha * 0.85})`;
      ctx.lineWidth = 0.9 + (1 - Math.abs(t - 0.5) * 1.6) * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, botY);
      ctx.quadraticCurveTo(cx + Math.sin(angle) * spread * 0.5, botY, tipX, tipY);
      ctx.stroke();

      // Spatula pad
      if (sp > 0.25) {
        const pAlpha = clamp((sp - 0.25) / 0.5, 0, 1) * alpha;
        const padW = 11 * pAlpha;
        const padH = 5 * pAlpha;
        const padDist = 18 * sp;

        ctx.save();
        ctx.translate(tipX, tipY + padDist);
        ctx.rotate(angle * 0.3);
        const pg = ctx.createLinearGradient(-padW / 2, 0, padW / 2, 0);
        pg.addColorStop(0, `rgba(255,200,100,${pAlpha * 0.3})`);
        pg.addColorStop(0.5, `rgba(255,215,130,${pAlpha * 0.95})`);
        pg.addColorStop(1, `rgba(255,200,100,${pAlpha * 0.3})`);
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(0, 0, padW / 2, padH / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Labels
    ctx.globalAlpha = smooth(p);
    callout(cx + sw / 2, topY + 20, cx + W * 0.22, topY + 40, 'Seta shaft', null, 'rgba(255,189,89,0.5)');

    if (sp > 0.3) {
      const la = clamp((sp - 0.3) / 0.4, 0, 1);
      ctx.globalAlpha = la;
      callout(cx + spread * 0.85, botY + fanDrop, cx + spread + 10, botY + fanDrop - 10, 'Spatula pads', '~200 nm', 'rgba(255,210,130,0.5)');
    }

    ctx.globalAlpha = smooth(p);
    ctx.fillStyle = 'rgba(120,175,245,0.45)';
    ctx.font = '11px Segoe UI';
    ctx.fillText('Surface', W * 0.04, surfY + 22);
    ctx.globalAlpha = 1;

    drawScaleBar(W - 130, H - 36, 55, '~1 μm');
  }

  // ── STAGE 4: Van der Waals ───────────────────────────
  function drawStage4(p, time) {
    const cx = W / 2, cy = H / 2;
    const sp = smooth(p);

    ctx.fillStyle = '#030609';
    ctx.fillRect(0, 0, W, H);

    // Subtle glow center
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
    bg.addColorStop(0, 'rgba(80,140,200,0.07)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Gap closes as p increases
    const maxGap = H * 0.2;
    const minGap = H * 0.06;
    const gap = lerp(maxGap, minGap, sp);
    const upperY = cy - gap / 2;
    const lowerY = cy + gap / 2;

    const molR = Math.min(W, H) * 0.026;
    const mSpacing = molR * 2.7;
    const cols = Math.ceil(W / mSpacing) + 2;

    // Force lines
    if (sp > 0.15) {
      const fAlpha = clamp((sp - 0.15) / 0.5, 0, 1);
      const waveAmp = lerp(8, 2, sp);

      for (let i = 0; i < cols; i++) {
        const mx = (i - 0.5) * mSpacing + mSpacing * 0.3;
        const jitter = Math.sin(mx * 0.18 + 1.2) * molR * 0.3;

        const r = lowerY - upperY;
        const forceMag = clamp(0.4 / Math.pow(r / (H * 0.08), 2), 0, 1);
        const intensity = forceMag * fAlpha;

        const fg = ctx.createLinearGradient(mx, upperY, mx, lowerY);
        fg.addColorStop(0, `rgba(255,189,89,0)`);
        fg.addColorStop(0.25, `rgba(255,189,89,${intensity * 0.8})`);
        fg.addColorStop(0.5, `rgba(100,230,190,${intensity})`);
        fg.addColorStop(0.75, `rgba(130,190,255,${intensity * 0.8})`);
        fg.addColorStop(1, `rgba(130,190,255,0)`);

        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.2 + forceMag * 2;
        ctx.beginPath();
        let first = true;
        for (let y = upperY + jitter; y <= lowerY - jitter; y += 2) {
          const xOff = Math.sin(y * 0.09 + time * 2.2 + i * 0.8) * waveAmp;
          if (first) { ctx.moveTo(mx + xOff, y); first = false; }
          else ctx.lineTo(mx + xOff, y);
        }
        ctx.stroke();
      }
    }

    // Upper molecules (spatula)
    for (let i = 0; i < cols; i++) {
      const mx = (i - 0.5) * mSpacing + mSpacing * 0.3;
      const jy = Math.sin(mx * 0.14 + 0.5) * molR * 0.35;
      const bob = Math.sin(time * 1.1 + i * 0.7) * molR * 0.2 * (1 - sp * 0.8);
      const y = upperY + jy + bob;

      const mg = ctx.createRadialGradient(mx, y, 0, mx, y, molR * 1.1);
      mg.addColorStop(0, `rgba(255,225,150,${0.7 + sp * 0.2})`);
      mg.addColorStop(0.5, `rgba(255,180,60,${0.55 + sp * 0.15})`);
      mg.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, y, molR * 1.05, 0, Math.PI * 2); ctx.fill();
    }

    // Lower molecules (surface)
    for (let i = 0; i < cols; i++) {
      const mx = (i - 0.28) * mSpacing + mSpacing * 0.5;
      const jy = Math.cos(mx * 0.12 + 0.8) * molR * 0.3;
      const y = lowerY + jy;

      const mg = ctx.createRadialGradient(mx, y, 0, mx, y, molR * 1.1);
      mg.addColorStop(0, 'rgba(190,225,255,0.82)');
      mg.addColorStop(0.5, 'rgba(100,165,245,0.55)');
      mg.addColorStop(1, 'rgba(60,120,230,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, y, molR, 0, Math.PI * 2); ctx.fill();
    }

    // Distance label
    if (sp > 0.25) {
      const dAlpha = clamp((sp - 0.25) / 0.45, 0, 1);
      ctx.globalAlpha = dAlpha * 0.8;
      const dX = W * 0.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(dX, upperY); ctx.lineTo(dX, lowerY); ctx.stroke();
      ctx.setLineDash([]);
      const dist = lerp(0.8, 0.4, sp).toFixed(1);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = 'bold 11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist} nm`, dX, (upperY + lowerY) / 2 + 4);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // Labels
    ctx.globalAlpha = smooth(p);
    ctx.fillStyle = 'rgba(255,210,130,0.85)';
    ctx.font = 'bold 12px Segoe UI';
    ctx.fillText('Spatula molecules', W * 0.04, upperY - 16);
    ctx.fillStyle = 'rgba(150,200,255,0.85)';
    ctx.font = 'bold 12px Segoe UI';
    ctx.fillText('Surface molecules', W * 0.04, lowerY + 30);

    // Equation box
    if (sp > 0.45) {
      const eqAlpha = clamp((sp - 0.45) / 0.4, 0, 1);
      ctx.globalAlpha = eqAlpha;
      const eqX = W * 0.04, eqY = H - 80;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,189,89,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(eqX, eqY, 210, 56, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,189,89,0.95)';
      ctx.font = 'bold 14px Segoe UI';
      ctx.fillText('F  ∝  1 / r⁶', eqX + 16, eqY + 22);
      ctx.fillStyle = 'rgba(255,189,89,0.5)';
      ctx.font = '11px Segoe UI';
      ctx.fillText('Van der Waals force law', eqX + 16, eqY + 40);
    }

    ctx.globalAlpha = 1;
    drawScaleBar(W - 130, H - 36, 45, '~0.5 nm');
  }

  // ── RENDER LOOP ──────────────────────────────────────
  const STAGE_FUNCS = [drawStage0, drawStage1, drawStage2, drawStage3, drawStage4];
  const NUM_STAGES = 5;
  const STAGE_INFO = [
    { title: 'Gecko Toe', desc: 'Macro view — the toe pad resting on a glass surface (~1 cm)' },
    { title: 'Lamellae', desc: 'Zooming in — parallel ridges called lamellae organize the setae (~500 μm wide)' },
    { title: 'Setae Field', desc: 'Microscale — thousands of hair-like setae emerge from each lamella (~100 μm tall)' },
    { title: 'Spatulae', desc: 'A single seta tip fans into ~1,000 spatula pads that contact the surface (~200 nm)' },
    { title: 'Van der Waals Forces', desc: 'Molecules attract across 0.3–0.6 nm — no glue, no suction, just physics' },
  ];

  const dots = document.querySelectorAll('.stage-dot');
  const titleEl = document.getElementById('stage-title');
  const descEl = document.getElementById('stage-desc');
  const progressBar = document.getElementById('progress-bar');

  let smoothP = 0;
  let time = 0;
  let lastStageIdx = -1;

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const si = parseInt(dot.dataset.stage);
      const max = document.body.scrollHeight - window.innerHeight;
      const target = ((si + 0.05) / NUM_STAGES) * max;
      window.scrollTo({ top: target, behavior: 'smooth' });
    });
  });

  function render() {
    const rawP = getProgress();
    smoothP = lerp(smoothP, rawP, 0.07);

    const stageF = smoothP * NUM_STAGES;
    const si = clamp(Math.floor(stageF), 0, NUM_STAGES - 1);
    const sp = clamp(stageF - si, 0, 1);

    // Update UI
    if (si !== lastStageIdx) {
      lastStageIdx = si;
      titleEl.textContent = STAGE_INFO[si].title;
      descEl.textContent = STAGE_INFO[si].desc;
      dots.forEach((d, i) => d.classList.toggle('active', i === si));
    }

    progressBar.style.width = (rawP * 100) + '%';

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Draw current stage
    if (si === 3 || si === 4) {
      STAGE_FUNCS[si](sp, time);
    } else {
      STAGE_FUNCS[si](sp);
    }

    // Fade-to-black transition at stage boundaries
    if (sp > 0.85 && si < NUM_STAGES - 1) {
      const blend = smooth((sp - 0.85) / 0.15);
      ctx.globalAlpha = blend;
      ctx.fillStyle = '#0a0f14';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    time += 0.016;
    requestAnimationFrame(render);
  }

  render();
});
