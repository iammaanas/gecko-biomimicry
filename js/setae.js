(() => {
  const host = document.getElementById("setae-model-container");
  if (!host) return;

  class SetaeAdhesionModel {
    constructor(container) {
      this.container = container;
      this.state = {
        angleDeg: 14,
        preload: 0.62,
        shear: 0.48,
        roughness: 0.18,
        adhesion: 0,
        contactCount: 0,
        directionalGain: 0,
        qualityGain: 0,
        detachmentRisk: 0
      };

      this.fiberCount = 168;
      this.fibers = this.createFibers(this.fiberCount);
      this.lastTime = 0;
      this.pointer = { active: false, x: 0, y: 0 };

      this.buildUi();
      this.bindEvents();
      this.resize();
      this.updateFromControls();
      requestAnimationFrame((t) => this.frame(t));
    }

    createFibers(count) {
      const fibers = [];
      const cols = 14;
      const rows = Math.ceil(count / cols);

      for (let i = 0; i < count; i += 1) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        fibers.push({
          u: c / (cols - 1),
          v: r / (rows - 1),
          flexibility: 0.72 + Math.random() * 0.45,
          lengthScale: 0.82 + Math.random() * 0.34,
          phase: Math.random() * Math.PI * 2,
          contact: false,
          tipY: 0
        });
      }

      return fibers;
    }

    buildUi() {
      const root = document.createElement("div");
      root.style.display = "grid";
      root.style.gridTemplateColumns = "minmax(300px,360px) minmax(420px,1fr)";
      root.style.gap = "12px";
      root.style.width = "100%";

      const panel = document.createElement("section");
      panel.style.border = "1px solid rgba(255,255,255,0.1)";
      panel.style.borderRadius = "12px";
      panel.style.background = "rgba(0,0,0,0.24)";
      panel.style.padding = "12px";

      const visual = document.createElement("section");
      visual.style.position = "relative";
      visual.style.minHeight = "640px";
      visual.style.border = "1px solid rgba(255,255,255,0.1)";
      visual.style.borderRadius = "12px";
      visual.style.background = "linear-gradient(180deg,#0f1a24,#0b141c)";
      visual.style.overflow = "hidden";

      const heading = document.createElement("h2");
      heading.textContent = "Simulation Controls";
      heading.style.margin = "0 0 10px";
      heading.style.color = "#ffbd59";
      heading.style.fontSize = "1.1rem";
      panel.appendChild(heading);

      const mkSlider = (label, min, max, step, value) => {
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "10px";

        const l = document.createElement("label");
        l.style.display = "block";
        l.style.color = "#aebbc9";
        l.style.marginBottom = "4px";
        l.style.fontSize = "0.9rem";

        const v = document.createElement("span");
        v.style.color = "#eaf2ff";
        v.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
        l.textContent = `${label}: `;
        l.appendChild(v);

        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.style.width = "100%";

        wrap.appendChild(l);
        wrap.appendChild(input);
        panel.appendChild(wrap);

        return { input, valueNode: v };
      };

      this.angleCtl = mkSlider("Pull angle (deg)", -55, 55, 1, this.state.angleDeg);
      this.preloadCtl = mkSlider("Preload / compression", 0, 100, 1, Math.round(this.state.preload * 100));
      this.shearCtl = mkSlider("Shear alignment", -100, 100, 1, Math.round(this.state.shear * 100));
      this.roughCtl = mkSlider("Surface roughness", 0, 60, 1, Math.round(this.state.roughness * 100));

      const hint = document.createElement("p");
      hint.textContent = "Drag in the visualization: horizontal motion changes pull angle, vertical motion changes preload.";
      hint.style.margin = "6px 0 10px";
      hint.style.color = "#96a4b3";
      hint.style.fontSize = "0.82rem";
      hint.style.lineHeight = "1.45";
      panel.appendChild(hint);

      const meterTitle = document.createElement("div");
      meterTitle.textContent = "Adhesion indicator";
      meterTitle.style.color = "#dbe8f5";
      meterTitle.style.marginBottom = "6px";
      meterTitle.style.fontSize = "0.9rem";
      panel.appendChild(meterTitle);

      this.meterTrack = document.createElement("div");
      this.meterTrack.style.height = "12px";
      this.meterTrack.style.borderRadius = "999px";
      this.meterTrack.style.background = "rgba(255,255,255,0.12)";
      this.meterTrack.style.overflow = "hidden";
      panel.appendChild(this.meterTrack);

      this.meterFill = document.createElement("div");
      this.meterFill.style.height = "100%";
      this.meterFill.style.width = "0%";
      this.meterFill.style.background = "linear-gradient(90deg,#f87171,#facc15,#4ade80)";
      this.meterTrack.appendChild(this.meterFill);

      this.metrics = document.createElement("div");
      this.metrics.style.marginTop = "10px";
      this.metrics.style.padding = "10px";
      this.metrics.style.borderRadius = "10px";
      this.metrics.style.border = "1px solid rgba(255,255,255,0.1)";
      this.metrics.style.background = "rgba(0,0,0,0.22)";
      this.metrics.style.color = "#deebfa";
      this.metrics.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      this.metrics.style.fontSize = "0.84rem";
      this.metrics.style.lineHeight = "1.6";
      panel.appendChild(this.metrics);

      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      visual.appendChild(this.canvas);

      this.overlay = document.createElement("div");
      this.overlay.style.position = "absolute";
      this.overlay.style.top = "10px";
      this.overlay.style.left = "12px";
      this.overlay.style.padding = "6px 9px";
      this.overlay.style.borderRadius = "8px";
      this.overlay.style.border = "1px solid rgba(255,255,255,0.1)";
      this.overlay.style.background = "rgba(0,0,0,0.3)";
      this.overlay.style.fontSize = "0.82rem";
      this.overlay.style.color = "#d4e0ef";
      this.overlay.textContent = "Directional adhesion anisotropy: high in preferred pull direction.";
      visual.appendChild(this.overlay);

      root.appendChild(panel);
      root.appendChild(visual);
      this.container.appendChild(root);

      this.root = root;
      this.visual = visual;
      this.ctx = this.canvas.getContext("2d");

      const mq = window.matchMedia("(max-width: 1040px)");
      const syncLayout = () => {
        this.root.style.gridTemplateColumns = mq.matches ? "1fr" : "minmax(300px,360px) minmax(420px,1fr)";
        this.visual.style.minHeight = mq.matches ? "500px" : "640px";
      };
      syncLayout();
      mq.addEventListener("change", syncLayout);
    }

    bindEvents() {
      const refresh = () => this.updateFromControls();
      this.angleCtl.input.addEventListener("input", refresh);
      this.preloadCtl.input.addEventListener("input", refresh);
      this.shearCtl.input.addEventListener("input", refresh);
      this.roughCtl.input.addEventListener("input", refresh);

      this.canvas.addEventListener("pointerdown", (e) => {
        this.pointer.active = true;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.canvas.setPointerCapture(e.pointerId);
      });

      this.canvas.addEventListener("pointermove", (e) => {
        if (!this.pointer.active) return;
        const dx = e.clientX - this.pointer.x;
        const dy = e.clientY - this.pointer.y;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;

        this.state.angleDeg = this.clamp(this.state.angleDeg + dx * 0.15, -55, 55);
        this.state.preload = this.clamp(this.state.preload - dy * 0.0025, 0, 1);

        this.angleCtl.input.value = String(Math.round(this.state.angleDeg));
        this.preloadCtl.input.value = String(Math.round(this.state.preload * 100));
        this.pushStateToLabels();
      });

      const stopPointer = (e) => {
        this.pointer.active = false;
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch (_) {
          // noop
        }
      };

      this.canvas.addEventListener("pointerup", stopPointer);
      this.canvas.addEventListener("pointercancel", stopPointer);
      this.canvas.addEventListener("pointerleave", () => {
        this.pointer.active = false;
      });

      window.addEventListener("resize", () => this.resize());
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) requestAnimationFrame((t) => this.frame(t));
      });
    }

    updateFromControls() {
      this.state.angleDeg = parseFloat(this.angleCtl.input.value);
      this.state.preload = parseFloat(this.preloadCtl.input.value) / 100;
      this.state.shear = parseFloat(this.shearCtl.input.value) / 100;
      this.state.roughness = parseFloat(this.roughCtl.input.value) / 100;
      this.pushStateToLabels();
    }

    pushStateToLabels() {
      this.angleCtl.valueNode.textContent = `${Math.round(this.state.angleDeg)}°`;
      this.preloadCtl.valueNode.textContent = `${Math.round(this.state.preload * 100)}%`;
      this.shearCtl.valueNode.textContent = `${Math.round(this.state.shear * 100)}%`;
      this.roughCtl.valueNode.textContent = `${Math.round(this.state.roughness * 100)}%`;
    }

    resize() {
      const rect = this.visual.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    computeAdhesion(contactAreaRatio) {
      const angle = (this.state.angleDeg * Math.PI) / 180;

      const preferred = 16 * (Math.PI / 180);
      const directionalGain = this.clamp(Math.cos(angle - preferred), 0.06, 1);

      const preloadGain = 0.35 + this.state.preload * 0.65;
      const shearGain = 0.35 + this.clamp(this.state.shear, 0, 1) * 0.65;
      const roughnessPenalty = 1 - this.state.roughness * 0.72;

      const qualityGain = preloadGain * shearGain * roughnessPenalty;
      const adhesion = this.clamp(contactAreaRatio * directionalGain * qualityGain, 0, 1);
      const detachmentRisk = this.clamp((Math.abs(this.state.angleDeg) - 30) / 25 + this.state.roughness * 0.45, 0, 1);

      return { adhesion, directionalGain, qualityGain, detachmentRisk };
    }

    frame(timeMs) {
      if (document.hidden) return;

      const dt = this.lastTime ? (timeMs - this.lastTime) / 1000 : 0.016;
      this.lastTime = timeMs;

      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w < 3 || h < 3) {
        requestAnimationFrame((t) => this.frame(t));
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const wallX = w * 0.7;
      ctx.fillStyle = "#33485e";
      ctx.fillRect(wallX, 0, w - wallX, h);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wallX, 0);
      ctx.lineTo(wallX, h);
      ctx.stroke();

      const padX = w * 0.38;
      const padY = h * 0.53;
      const padW = Math.min(320, w * 0.38);
      const padH = Math.min(240, h * 0.4);

      ctx.save();
      ctx.translate(padX, padY);
      ctx.rotate(((this.state.angleDeg * Math.PI) / 180) * 0.16);
      ctx.fillStyle = "#1b2e3e";
      ctx.beginPath();
      ctx.ellipse(0, 0, padW * 0.5, padH * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.stroke();
      ctx.restore();

      const compressionPush = 20 + this.state.preload * 52;
      const gapToWall = Math.max(8, wallX - (padX + padW * 0.34));
      let contacts = 0;

      for (let i = 0; i < this.fibers.length; i += 1) {
        const f = this.fibers[i];
        const bx = padX + (f.u - 0.5) * padW * 0.8;
        const by = padY + (f.v - 0.5) * padH * 0.78;

        const fiberLean = (this.state.angleDeg / 50) * 0.58 + this.state.shear * 0.23;
        const targetLen = (gapToWall + 42 - compressionPush) * f.lengthScale;
        const len = Math.max(18, targetLen);

        const tipXRaw = bx + len * Math.cos(fiberLean);
        const tipYRaw = by + len * Math.sin(fiberLean) * 0.56;

        const roughNoise = (Math.sin(timeMs * 0.002 + f.phase) * (0.8 + this.state.roughness * 2.2));
        let tx = tipXRaw + roughNoise;
        let ty = tipYRaw;

        const contactProbabilityBias = 1 - this.state.roughness * 0.45;
        const canContact = tx >= wallX - 1 && Math.random() < contactProbabilityBias;

        f.contact = canContact;
        if (canContact) {
          contacts += 1;
          tx = wallX;
          f.tipY = ty;
        }

        const cx = bx + (tx - bx) * 0.5 + 7 * f.flexibility;
        const cy = by + (ty - by) * 0.5 + this.state.angleDeg * 0.12;

        ctx.strokeStyle = canContact ? "rgba(113,222,156,0.84)" : "rgba(163,190,216,0.52)";
        ctx.lineWidth = canContact ? 1.6 : 1.15;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.stroke();

        const spread = 4.5 + this.state.preload * 6.5;
        for (let s = -1; s <= 1; s += 1) {
          const sx = tx - (canContact ? 0 : 3) + (canContact ? 0 : s * 2);
          const sy = ty + s * spread * 0.35;
          const ex = canContact ? wallX : sx + 4;
          const ey = sy + s * 0.75;

          ctx.strokeStyle = canContact ? "rgba(255,189,89,0.9)" : "rgba(255,189,89,0.32)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }

        if (canContact) {
          ctx.fillStyle = "rgba(74,222,128,0.66)";
          ctx.beginPath();
          ctx.arc(wallX, ty, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const contactAreaRatio = contacts / this.fiberCount;
      const adhesionResult = this.computeAdhesion(contactAreaRatio);
      this.state.adhesion = adhesionResult.adhesion;
      this.state.contactCount = contacts;
      this.state.directionalGain = adhesionResult.directionalGain;
      this.state.qualityGain = adhesionResult.qualityGain;
      this.state.detachmentRisk = adhesionResult.detachmentRisk;

      const arrowLen = 44 + Math.abs(this.state.angleDeg) * 1.2;
      const ax = padX - padW * 0.45;
      const ay = padY + padH * 0.42;
      const ang = ((180 + this.state.angleDeg) * Math.PI) / 180;
      const bx = ax + arrowLen * Math.cos(ang);
      const by = ay + arrowLen * Math.sin(ang);

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
      ctx.fillText("Setae / spatulae cluster", padX - 42, padY - padH * 0.58);

      if (this.state.adhesion > 0.66) {
        ctx.fillStyle = "#4ade80";
        ctx.fillText("State: strong hold", 18, 22);
      } else if (this.state.adhesion > 0.36) {
        ctx.fillStyle = "#facc15";
        ctx.fillText("State: moderate / near detachment", 18, 22);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.fillText("State: weak hold", 18, 22);
      }

      this.meterFill.style.width = `${Math.round(this.state.adhesion * 100)}%`;
      this.metrics.innerHTML = [
        `contacts: ${this.state.contactCount} / ${this.fiberCount}`,
        `contact area ratio: ${contactAreaRatio.toFixed(3)}`,
        `directional gain: ${this.state.directionalGain.toFixed(3)}`,
        `quality gain: ${this.state.qualityGain.toFixed(3)}`,
        `adhesion index: ${this.state.adhesion.toFixed(3)}`,
        `detachment risk: ${this.state.detachmentRisk.toFixed(3)}`,
        `frame dt: ${(dt * 1000).toFixed(1)} ms`
      ].join("<br>");

      requestAnimationFrame((t) => this.frame(t));
    }

    clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    }
  }

  new SetaeAdhesionModel(host);
})();
