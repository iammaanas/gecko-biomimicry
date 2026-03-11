(function () {
  const host = document.getElementById("setae-model-container");
  if (!host) {
    return;
  }

  // ---------- UI scaffold (all confined to host) ----------
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gridTemplateColumns = "minmax(280px, 330px) minmax(420px, 1fr)";
  wrapper.style.gap = "12px";
  wrapper.style.alignItems = "stretch";
  wrapper.style.width = "100%";

  const panel = document.createElement("div");
  panel.style.background = "rgba(0,0,0,0.22)";
  panel.style.border = "1px solid rgba(255,255,255,0.1)";
  panel.style.borderRadius = "12px";
  panel.style.padding = "12px";

  const visual = document.createElement("div");
  visual.style.position = "relative";
  visual.style.minHeight = "620px";
  visual.style.border = "1px solid rgba(255,255,255,0.1)";
  visual.style.borderRadius = "12px";
  visual.style.background = "linear-gradient(180deg, #0f1a24, #0b141c)";
  visual.style.overflow = "hidden";

  const title = document.createElement("div");
  title.textContent = "Setae Controls";
  title.style.color = "#ffbd59";
  title.style.fontWeight = "600";
  title.style.marginBottom = "10px";
  panel.appendChild(title);

  function makeControl(labelText, min, max, step, value) {
    const block = document.createElement("div");
    block.style.marginBottom = "12px";

    const label = document.createElement("label");
    label.style.display = "block";
    label.style.color = "#aab6c4";
    label.style.marginBottom = "4px";
    label.style.fontSize = "0.9rem";

    const valueSpan = document.createElement("span");
    valueSpan.style.color = "#eaf2ff";
    valueSpan.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

    label.textContent = `${labelText}: `;
    label.appendChild(valueSpan);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.style.width = "100%";

    block.appendChild(label);
    block.appendChild(input);

    return { block, input, valueSpan };
  }

  const angleCtl = makeControl("Pull angle", -45, 45, 1, 12);
  const compressionCtl = makeControl("Compression", 0, 100, 1, 58);
  const shearCtl = makeControl("Shear direction", -100, 100, 1, 45);

  panel.appendChild(angleCtl.block);
  panel.appendChild(compressionCtl.block);
  panel.appendChild(shearCtl.block);

  const instructions = document.createElement("div");
  instructions.textContent = "Tip: drag inside the model to interact directly (left/right = angle, up/down = compression).";
  instructions.style.color = "#9aa6b4";
  instructions.style.fontSize = "0.84rem";
  instructions.style.lineHeight = "1.45";
  instructions.style.marginBottom = "12px";
  panel.appendChild(instructions);

  const meterLabel = document.createElement("div");
  meterLabel.style.color = "#dbe8f5";
  meterLabel.style.fontSize = "0.9rem";
  meterLabel.style.marginBottom = "6px";
  meterLabel.textContent = "Adhesion force";
  panel.appendChild(meterLabel);

  const meterTrack = document.createElement("div");
  meterTrack.style.height = "12px";
  meterTrack.style.borderRadius = "999px";
  meterTrack.style.background = "rgba(255,255,255,0.12)";
  meterTrack.style.overflow = "hidden";
  panel.appendChild(meterTrack);

  const meterFill = document.createElement("div");
  meterFill.style.height = "100%";
  meterFill.style.width = "0%";
  meterFill.style.background = "linear-gradient(90deg, #ff7b7b, #facc15, #4ade80)";
  meterTrack.appendChild(meterFill);

  const metrics = document.createElement("div");
  metrics.style.marginTop = "12px";
  metrics.style.padding = "10px";
  metrics.style.borderRadius = "10px";
  metrics.style.border = "1px solid rgba(255,255,255,0.1)";
  metrics.style.background = "rgba(0,0,0,0.2)";
  metrics.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  metrics.style.lineHeight = "1.7";
  metrics.style.color = "#dfe9f7";
  panel.appendChild(metrics);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  visual.appendChild(canvas);

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "10px";
  overlay.style.left = "12px";
  overlay.style.padding = "6px 8px";
  overlay.style.borderRadius = "8px";
  overlay.style.background = "rgba(0,0,0,0.3)";
  overlay.style.border = "1px solid rgba(255,255,255,0.1)";
  overlay.style.color = "#d3dfed";
  overlay.style.fontSize = "0.82rem";
  overlay.textContent = "Directional adhesion: strong in pull direction, weak against it.";
  visual.appendChild(overlay);

  wrapper.appendChild(panel);
  wrapper.appendChild(visual);
  host.appendChild(wrapper);

  const small = window.matchMedia("(max-width: 1024px)");
  function syncLayout() {
    wrapper.style.gridTemplateColumns = small.matches ? "1fr" : "minmax(280px, 330px) minmax(420px, 1fr)";
    visual.style.minHeight = small.matches ? "460px" : "620px";
  }
  syncLayout();
  small.addEventListener("change", syncLayout);

  // ---------- Model setup ----------
  const ctx = canvas.getContext("2d");
  const FIBER_COUNT = 130;
  const fibers = [];

  let model = {
    angleDeg: 12,
    compression: 0.58,
    shear: 0.45,
    adhesion: 0,
    contactCount: 0,
    directionalGain: 0,
    detaching: 0
  };

  for (let i = 0; i < FIBER_COUNT; i += 1) {
    const gx = i % 13;
    const gy = Math.floor(i / 13);
    fibers.push({
      xNorm: gx / 12,
      yNorm: gy / 9,
      flexibility: 0.72 + Math.random() * 0.45,
      lengthScale: 0.86 + Math.random() * 0.28,
      phase: Math.random() * Math.PI * 2,
      contact: false
    });
  }

  let pointerActive = false;
  let lastX = 0;
  let lastY = 0;

  function updateControlText() {
    angleCtl.valueSpan.textContent = `${Math.round(model.angleDeg)}°`;
    compressionCtl.valueSpan.textContent = `${Math.round(model.compression * 100)}%`;
    shearCtl.valueSpan.textContent = `${Math.round(model.shear * 100)}%`;
  }

  function setFromControls() {
    model.angleDeg = parseFloat(angleCtl.input.value);
    model.compression = parseFloat(compressionCtl.input.value) / 100;
    model.shear = parseFloat(shearCtl.input.value) / 100;
    updateControlText();
  }

  angleCtl.input.addEventListener("input", setFromControls);
  compressionCtl.input.addEventListener("input", setFromControls);
  shearCtl.input.addEventListener("input", setFromControls);

  canvas.addEventListener("pointerdown", (e) => {
    pointerActive = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointerActive) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    model.angleDeg = Math.max(-45, Math.min(45, model.angleDeg + dx * 0.18));
    model.compression = Math.max(0, Math.min(1, model.compression - dy * 0.003));

    angleCtl.input.value = String(Math.round(model.angleDeg));
    compressionCtl.input.value = String(Math.round(model.compression * 100));
    updateControlText();
  });

  function endPointer(e) {
    pointerActive = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      // no-op
    }
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => {
    pointerActive = false;
  });

  function resizeCanvas() {
    const rect = visual.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function computeAdhesion(angleDeg, compression, shear, contacts) {
    const angleRad = (angleDeg * Math.PI) / 180;

    // Directional effect: best around +18 degrees, weaker opposite direction.
    const preferred = 18 * (Math.PI / 180);
    const directional = Math.max(0.08, Math.cos(angleRad - preferred));

    // Contact quality grows with compression and coherent shear direction.
    const contactQuality = 0.35 + compression * 0.65;
    const shearQuality = 0.4 + Math.max(0, shear) * 0.6;

    const areaRatio = contacts / FIBER_COUNT;
    const adhesion = areaRatio * contactQuality * directional * shearQuality;

    return {
      adhesion: Math.max(0, Math.min(1, adhesion)),
      directional,
      detaching: Math.max(0, (Math.abs(angleDeg) - 30) / 15)
    };
  }

  function drawFrame(timeMs) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) {
      requestAnimationFrame(drawFrame);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const wallX = w * 0.68;
    const padCenterX = w * 0.38;
    const padCenterY = h * 0.52;
    const padW = Math.min(300, w * 0.36);
    const padH = Math.min(230, h * 0.42);

    // rigid surface
    ctx.fillStyle = "#33485e";
    ctx.fillRect(wallX, 0, w - wallX, h);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, 0);
    ctx.lineTo(wallX, h);
    ctx.stroke();

    // footpad ellipse
    ctx.save();
    ctx.translate(padCenterX, padCenterY);
    const padTilt = (model.angleDeg * Math.PI) / 180;
    ctx.rotate(padTilt * 0.18);
    ctx.fillStyle = "#1d2e3d";
    ctx.beginPath();
    ctx.ellipse(0, 0, padW * 0.5, padH * 0.47, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();
    ctx.restore();

    const compressionPush = 22 + model.compression * 45;
    const baseToWall = Math.max(8, wallX - (padCenterX + padW * 0.35));

    let contacts = 0;

    for (let i = 0; i < fibers.length; i += 1) {
      const fiber = fibers[i];

      const localX = (fiber.xNorm - 0.5) * padW * 0.78;
      const localY = (fiber.yNorm - 0.5) * padH * 0.8;

      const baseX = padCenterX + localX;
      const baseY = padCenterY + localY;

      const lean = (model.angleDeg / 45) * 0.55 + model.shear * 0.2;
      const targetLen = (baseToWall + 40 - compressionPush) * fiber.lengthScale;
      const fiberLen = Math.max(18, targetLen);

      const tipXRaw = baseX + fiberLen * Math.cos(lean);
      const tipYRaw = baseY + fiberLen * Math.sin(lean) * 0.55;

      const noise = Math.sin(timeMs * 0.002 + fiber.phase) * 0.9;
      let tipX = tipXRaw + noise;
      let tipY = tipYRaw;

      const canContact = tipX >= wallX - 1;
      fiber.contact = canContact;
      if (canContact) {
        contacts += 1;
        tipX = wallX;
      }

      const ctrlX = baseX + (tipX - baseX) * 0.5 + 7 * fiber.flexibility;
      const ctrlY = baseY + (tipY - baseY) * 0.5 + (model.angleDeg * 0.12);

      // setae shaft
      ctx.strokeStyle = canContact ? "rgba(113, 222, 156, 0.85)" : "rgba(163, 190, 216, 0.55)";
      ctx.lineWidth = canContact ? 1.7 : 1.2;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();

      // spatulae fan
      const fanSpread = 5 + model.compression * 6;
      for (let s = -1; s <= 1; s += 1) {
        const sx = tipX - (canContact ? 0 : 3) + (canContact ? 0 : s * 2);
        const sy = tipY + s * fanSpread * 0.35;
        const ex = canContact ? wallX : sx + 4;
        const ey = sy + s * 0.8;

        ctx.strokeStyle = canContact ? "rgba(255, 189, 89, 0.9)" : "rgba(255, 189, 89, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      if (canContact) {
        ctx.fillStyle = "rgba(74, 222, 128, 0.7)";
        ctx.beginPath();
        ctx.arc(wallX, tipY, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const adhesionResult = computeAdhesion(model.angleDeg, model.compression, model.shear, contacts);
    model.adhesion = adhesionResult.adhesion;
    model.contactCount = contacts;
    model.directionalGain = adhesionResult.directional;
    model.detaching = adhesionResult.detaching;

    // Pull arrow (detachment direction)
    const arrowLen = 44 + Math.abs(model.angleDeg) * 1.2;
    const ax = padCenterX - padW * 0.45;
    const ay = padCenterY + padH * 0.42;
    const angle = ((180 + model.angleDeg) * Math.PI) / 180;
    const bx = ax + arrowLen * Math.cos(angle);
    const by = ay + arrowLen * Math.sin(angle);

    ctx.strokeStyle = "#ff7b7b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    ctx.fillStyle = "#ff7b7b";
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dce8f6";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Rigid surface", wallX + 10, 18);
    ctx.fillText("Setae + spatulae", padCenterX - 40, padCenterY - padH * 0.58);

    if (model.adhesion > 0.65) {
      ctx.fillStyle = "#4ade80";
      ctx.fillText("Strong directional adhesion", 18, 22);
    } else if (model.adhesion > 0.35) {
      ctx.fillStyle = "#facc15";
      ctx.fillText("Moderate hold (near detachment)", 18, 22);
    } else {
      ctx.fillStyle = "#f87171";
      ctx.fillText("Weak hold / detachment likely", 18, 22);
    }

    // Update metrics panel
    meterFill.style.width = `${Math.round(model.adhesion * 100)}%`;

    metrics.innerHTML = [
      `Contact points: ${model.contactCount} / ${FIBER_COUNT}`,
      `Contact area ratio: ${(model.contactCount / FIBER_COUNT).toFixed(2)}`,
      `Directional gain: ${model.directionalGain.toFixed(2)}`,
      `Adhesion index: ${model.adhesion.toFixed(3)}`,
      `Detachment factor: ${model.detaching.toFixed(2)}`
    ].join("<br>");

    requestAnimationFrame(drawFrame);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  updateControlText();
  requestAnimationFrame(drawFrame);
})();
