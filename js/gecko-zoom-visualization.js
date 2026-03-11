(() => {
  const CONTAINER_ID = "gecko-zoom-model";

  // Zoom levels (conceptual)
  // 0: Foot touching wall (side view)
  // 1: Ridges / lamellae on footpad (side view, closer)
  // 2: Zoom into a single ridge → many setae
  // 3: Zoom into a single seta → spatula pads
  // 4: Zoom into contact interface → atoms & van der Waals forces

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function visAtLevel(z, level, halfWidth) {
    const start = level - halfWidth;
    const end = level + halfWidth;
    return smoothstep(start, start + halfWidth, z) * (1 - smoothstep(level, end, z));
  }

  class GeckoHierarchicalZoom {
    constructor(container) {
      this.container = container;

      // Zoom in logical units 0–4
      this.zoom = 0;
      this.targetZoom = 0;
      this.minZoom = 0;
      this.maxZoom = 4;

      this.time = 0;
      this.guided = false;
      this.guidedStart = 0;

      this._buildDom();
      this._bindEvents();
      this._resizeCanvas();
      this._updateCaption();
      requestAnimationFrame((t) => this._frame(t));
    }

    _buildDom() {
      // Container styling (local only)
      if (!this.container.style.position) {
        this.container.style.position = "relative";
      }
      this.container.style.overflow = "hidden";

      // Canvas
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.touchAction = "none";
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");

      // Caption overlay
      this.caption = document.createElement("div");
      this.caption.style.position = "absolute";
      this.caption.style.left = "16px";
      this.caption.style.top = "16px";
      this.caption.style.maxWidth = "360px";
      this.caption.style.padding = "8px 12px";
      this.caption.style.borderRadius = "10px";
      this.caption.style.background = "rgba(0,0,0,0.7)";
      this.caption.style.color = "#e5edf9";
      this.caption.style.fontSize = "0.82rem";
      this.caption.style.lineHeight = "1.5";
      this.caption.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      this.caption.style.pointerEvents = "none";
      this.caption.style.transition = "opacity 0.25s ease";
      this.caption.style.opacity = "1";
      this.container.appendChild(this.caption);

      // Control panel (bottom)
      this.controls = document.createElement("div");
      this.controls.style.position = "absolute";
      this.controls.style.left = "50%";
      this.controls.style.bottom = "16px";
      this.controls.style.transform = "translateX(-50%)";
      this.controls.style.display = "flex";
      this.controls.style.alignItems = "center";
      this.controls.style.gap = "10px";
      this.controls.style.padding = "8px 12px";
      this.controls.style.borderRadius = "999px";
      this.controls.style.background = "rgba(0,0,0,0.7)";
      this.controls.style.border = "1px solid rgba(148,163,184,0.5)";
      this.controls.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      this.controls.style.fontSize = "0.8rem";
      this.controls.style.color = "#e5edf9";

      // Zoom out button
      this.btnOut = document.createElement("button");
      this._styleIconButton(this.btnOut);
      this.btnOut.textContent = "−";

      // Zoom in button
      this.btnIn = document.createElement("button");
      this._styleIconButton(this.btnIn);
      this.btnIn.textContent = "+";

      // Guided tour button
      this.btnTour = document.createElement("button");
      this.btnTour.type = "button";
      this.btnTour.textContent = "Play tour";
      this.btnTour.style.border = "none";
      this.btnTour.style.outline = "none";
      this.btnTour.style.cursor = "pointer";
      this.btnTour.style.borderRadius = "999px";
      this.btnTour.style.padding = "4px 10px";
      this.btnTour.style.background = "rgba(37,99,235,0.9)";
      this.btnTour.style.color = "#e5edf9";
      this.btnTour.style.fontSize = "0.8rem";
      this.btnTour.style.fontFamily = "inherit";
      this.btnTour.onmouseenter = () => {
        this.btnTour.style.background = "rgba(59,130,246,0.96)";
      };
      this.btnTour.onmouseleave = () => {
        this.btnTour.style.background = "rgba(37,99,235,0.9)";
      };

      // Zoom slider
      this.slider = document.createElement("input");
      this.slider.type = "range";
      this.slider.min = "0";
      this.slider.max = "4";
      this.slider.step = "0.01";
      this.slider.value = "0";
      this.slider.style.width = "260px";
      this.slider.style.cursor = "pointer";
      this.slider.style.background = "transparent";
      this.slider.style.accentColor = "#fbbf24"; // supported in modern browsers

      // Level labels (static text under slider)
      this.levelLabels = document.createElement("div");
      this.levelLabels.style.display = "flex";
      this.levelLabels.style.justifyContent = "space-between";
      this.levelLabels.style.marginTop = "2px";
      this.levelLabels.style.fontSize = "0.7rem";
      this.levelLabels.style.color = "rgba(226,232,240,0.85)";
      this.levelLabels.style.width = "260px";
      this.levelLabels.style.pointerEvents = "none";

      const labels = [
        "Foot",
        "Ridges",
        "Setae",
        "Spatulae",
        "Atoms"
      ];
      labels.forEach((txt) => {
        const span = document.createElement("span");
        span.textContent = txt;
        span.style.textAlign = "center";
        span.style.flex = "1 1 0";
        this.levelLabels.appendChild(span);
      });

      // Left and right sub-wrappers to keep layout neat
      const leftWrap = document.createElement("div");
      leftWrap.style.display = "flex";
      leftWrap.style.gap = "6px";
      leftWrap.style.alignItems = "center";

      const sliderWrap = document.createElement("div");
      sliderWrap.style.display = "flex";
      sliderWrap.style.flexDirection = "column";
      sliderWrap.style.alignItems = "stretch";

      sliderWrap.appendChild(this.slider);
      sliderWrap.appendChild(this.levelLabels);
      leftWrap.appendChild(this.btnOut);
      leftWrap.appendChild(sliderWrap);
      leftWrap.appendChild(this.btnIn);

      this.controls.appendChild(leftWrap);
      this.controls.appendChild(this.btnTour);
      this.container.appendChild(this.controls);
    }

    _styleIconButton(btn) {
      btn.type = "button";
      btn.style.border = "none";
      btn.style.outline = "none";
      btn.style.width = "26px";
      btn.style.height = "26px";
      btn.style.borderRadius = "999px";
      btn.style.cursor = "pointer";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.background = "rgba(15,23,42,0.95)";
      btn.style.color = "#e5edf9";
      btn.style.fontSize = "0.85rem";
      btn.onmouseenter = () => {
        btn.style.background = "rgba(30,64,175,0.95)";
      };
      btn.onmouseleave = () => {
        btn.style.background = "rgba(15,23,42,0.95)";
      };
    }

    _bindEvents() {
      // Wheel zoom (smooth)
      this.container.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY;
          const factor = Math.exp(-delta * 0.0015);
          this.targetZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
          this.slider.value = String(this.targetZoom);
          this.guided = false;
        },
        { passive: false }
      );

      // Slider
      this.slider.addEventListener("input", () => {
        this.targetZoom = clamp(parseFloat(this.slider.value) || 0, this.minZoom, this.maxZoom);
        this.guided = false;
      });

      // Buttons
      this.btnIn.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom + 0.8, this.minZoom, this.maxZoom);
        this.slider.value = String(this.targetZoom);
        this.guided = false;
      });

      this.btnOut.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom - 0.8, this.minZoom, this.maxZoom);
        this.slider.value = String(this.targetZoom);
        this.guided = false;
      });

      this.btnTour.addEventListener("click", () => {
        this.guided = true;
        this.guidedStart = performance.now() / 1000;
      });

      // Resize
      window.addEventListener("resize", () => this._resizeCanvas());
    }

    _resizeCanvas() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _frame(tMs) {
      const t = tMs / 1000;
      const dt = 0.016;
      this.time += dt;

      if (this.guided) {
        const elapsed = t - this.guidedStart;
        const duration = 16; // seconds from level 0 → 4
        const u = clamp(elapsed / duration, 0, 1);
        this.targetZoom = this.minZoom + (this.maxZoom - this.minZoom) * u;
        this.slider.value = String(this.targetZoom);
        if (u >= 1) this.guided = false;
      }

      const smoothFactor = 0.15;
      this.zoom = lerp(this.zoom, this.targetZoom, smoothFactor);

      this._render();
      requestAnimationFrame((nt) => this._frame(nt));
    }

    _updateCaption() {
      const z = this.zoom;
      let title, body;

      if (z < 0.8) {
        title = "Gecko footpad on wall (macroscopic side view)";
        body =
          "You see the gecko toe pressed against a vertical surface. Everything looks smooth at this scale, " +
          "but the grip comes from microscopic structures hidden in the contact zone.";
      } else if (z < 1.8) {
        title = "Lamellar ridges on the footpad";
        body =
          "Zooming in reveals parallel lamellae—soft ridges that increase contact area and distribute load " +
          "across the toe where it presses on the wall.";
      } else if (z < 2.8) {
        title = "Microscopic setae on a single ridge";
        body =
          "Each ridge is covered with thousands of setae—tiny, flexible hairs. They bend and conform to " +
          "the wall’s microscopic bumps, multiplying real contact sites.";
      } else if (z < 3.6) {
        title = "Nanoscopic spatula pads on a single seta";
        body =
          "Each seta branches into hundreds of spatula-like tips. These flattened pads spread out at the " +
          "surface, creating huge total contact area without any sticky glue.";
      } else {
        title = "Atoms in contact: van der Waals interactions";
        body =
          "At the deepest scale, atoms in the spatula tip and atoms in the wall come very close. Weak, " +
          "short-range van der Waals attractions at millions of these sites add up to strong, reversible adhesion.";
      }

      this.caption.innerHTML =
        "<strong style='color:#fbbf24; font-weight:600;'>" +
        title +
        "</strong><br>" +
        "<span>" +
        body +
        "</span>";
    }

    _render() {
      const ctx = this.ctx;
      if (!ctx) return;
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      if (width < 2 || height < 2) return;

      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(1, "#020817");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Subtle grid for depth reference
      this._drawGrid(width, height);

      // Normalized coordinate system for scenes
      const sceneHeight = 1.0;
      const sceneWidth = sceneHeight * (width / height);
      const baseScale = height * 0.9;
      const zoomScale = baseScale * (0.75 + this.zoom * 0.25);

      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-sceneWidth * 0.5, -sceneHeight * 0.5);

      const z = this.zoom;

      const a0 = visAtLevel(z, 0.0, 0.7);
      const a1 = visAtLevel(z, 1.0, 0.7);
      const a2 = visAtLevel(z, 2.0, 0.7);
      const a3 = visAtLevel(z, 3.0, 0.7);
      const a4 = visAtLevel(z, 4.0, 0.7);

      // Shared wall baseline
      this._drawWall(sceneWidth, sceneHeight);

      if (a0 > 0.01) this._drawFootSide(sceneWidth, sceneHeight, a0);
      if (a1 > 0.01) this._drawRidgesSide(sceneWidth, sceneHeight, a1);
      if (a2 > 0.01) this._drawSetaeClose(sceneWidth, sceneHeight, a2);
      if (a3 > 0.01) this._drawSpatulaClose(sceneWidth, sceneHeight, a3);
      if (a4 > 0.01) this._drawAtoms(sceneWidth, sceneHeight, a4);

      ctx.restore();

      this._updateCaption();
    }

    _drawGrid(w, h) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.07)";
      ctx.lineWidth = 1;
      const step = 36;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawWall(sceneWidth, sceneHeight) {
      const ctx = this.ctx;
      ctx.save();
      const wallX = sceneWidth * 0.7;
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(wallX, 0.06, sceneWidth - wallX + 0.3, sceneHeight - 0.12);

      // Texture
      ctx.strokeStyle = "rgba(148,163,184,0.15)";
      ctx.lineWidth = 0.004;
      for (let y = 0.08; y < sceneHeight - 0.08; y += 0.05) {
        ctx.beginPath();
        ctx.moveTo(wallX - 0.02, y);
        ctx.lineTo(sceneWidth, y);
        ctx.stroke();
      }

      // Edge highlight
      ctx.strokeStyle = "rgba(226,232,240,0.7)";
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.moveTo(wallX, 0.06);
      ctx.lineTo(wallX, sceneHeight - 0.06);
      ctx.stroke();

      ctx.restore();
    }

    _drawFootSide(sceneWidth, sceneHeight, alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const wallX = sceneWidth * 0.7;

      // Toe pad pressed against wall
      const toeWidth = sceneWidth * 0.35;
      const toeHeight = sceneHeight * 0.35;
      const toeX = wallX - toeWidth * 0.9;
      const toeY = sceneHeight * 0.35;

      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.ellipse(
        toeX + toeWidth * 0.5,
        toeY + toeHeight * 0.5,
        toeWidth * 0.5,
        toeHeight * 0.5,
        -0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Outline
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 0.01;
      ctx.stroke();

      // Leg segment
      ctx.beginPath();
      ctx.ellipse(
        toeX - toeWidth * 0.1,
        toeY - toeHeight * 0.15,
        toeWidth * 0.35,
        toeHeight * 0.55,
        -0.7,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.strokeStyle = "rgba(148,163,184,0.4)";
      ctx.stroke();

      // Contact glow stripe
      const contactY0 = toeY + toeHeight * 0.1;
      const contactY1 = toeY + toeHeight * 0.9;
      const grad = ctx.createLinearGradient(wallX - 0.06, contactY0, wallX + 0.02, contactY1);
      grad.addColorStop(0, "rgba(251,191,36,0.0)");
      grad.addColorStop(0.5, "rgba(251,191,36,0.35)");
      grad.addColorStop(1, "rgba(251,191,36,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(wallX - 0.1, contactY0, 0.12, contactY1 - contactY0);

      ctx.restore();
    }

    _drawRidgesSide(sceneWidth, sceneHeight, alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const wallX = sceneWidth * 0.7;

      // Magnified toe underside as a block next to wall
      const blockW = sceneWidth * 0.5;
      const blockH = sceneHeight * 0.6;
      const blockX = wallX - blockW;
      const blockY = sceneHeight * 0.2;

      ctx.fillStyle = "#020617";
      ctx.fillRect(blockX, blockY, blockW, blockH);
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.lineWidth = 0.01;
      ctx.strokeRect(blockX, blockY, blockW, blockH);

      // Ridges (lamellae) as parallel soft arcs that touch wall
      const ridgeCount = 14;
      for (let i = 0; i < ridgeCount; i++) {
        const t = i / (ridgeCount - 1);
        const yMid = lerp(blockY + blockH * 0.15, blockY + blockH * 0.85, t);
        const depth = blockW * 0.13;
        const mouthX = wallX;
        const baseX = mouthX - depth;
        const bulge = blockH * 0.04 * Math.sin(t * Math.PI);

        ctx.beginPath();
        ctx.moveTo(baseX, yMid - bulge);
        ctx.quadraticCurveTo(
          lerp(baseX, mouthX, 0.45),
          yMid,
          mouthX,
          yMid + bulge * 0.8
        );

        ctx.strokeStyle =
          i % 2 === 0
            ? "rgba(148,163,184,0.9)"
            : "rgba(148,163,184,0.45)";
        ctx.lineWidth = 0.008;
        ctx.stroke();
      }

      // Zoom indicator bracket on one ridge
      ctx.strokeStyle = "rgba(251,191,36,0.9)";
      ctx.lineWidth = 0.012;
      const focusY = blockY + blockH * 0.5;
      ctx.beginPath();
      ctx.moveTo(wallX - blockW * 0.26, focusY - blockH * 0.08);
      ctx.lineTo(wallX - blockW * 0.2, focusY - blockH * 0.08);
      ctx.moveTo(wallX - blockW * 0.26, focusY + blockH * 0.08);
      ctx.lineTo(wallX - blockW * 0.2, focusY + blockH * 0.08);
      ctx.stroke();

      ctx.restore();
    }

    _drawSetaeClose(sceneWidth, sceneHeight, alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const wallX = sceneWidth * 0.7;

      // Big single ridge as base
      const baseX = wallX - sceneWidth * 0.2;
      const baseY0 = sceneHeight * 0.25;
      const baseY1 = sceneHeight * 0.75;

      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY0);
      ctx.lineTo(baseX, baseY1);
      ctx.lineTo(baseX - sceneWidth * 0.12, baseY1 + sceneHeight * 0.04);
      ctx.lineTo(baseX - sceneWidth * 0.12, baseY0 - sceneHeight * 0.04);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 0.01;
      ctx.stroke();

      // Many setae emerging from ridge toward wall
      const setaeCount = 260;
      for (let i = 0; i < setaeCount; i++) {
        const r = i / (setaeCount - 1);
        const y = lerp(baseY0 + sceneHeight * 0.03, baseY1 - sceneHeight * 0.03, r);

        const baseJitter = (Math.random() - 0.5) * 0.004;
        const bx = baseX + baseJitter;

        const length = sceneWidth * 0.16 * (0.7 + Math.random() * 0.3);
        const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.25;
        const time = this.time;
        const sway = Math.sin(time * 1.3 + i * 0.01) * 0.2 * (0.5 + Math.random() * 0.5);
        const theta = angle + sway * 0.1;

        const ex = bx + length * Math.cos(theta);
        const ey = y + length * Math.sin(theta);

        ctx.strokeStyle = "rgba(148,163,184,0.7)";
        ctx.lineWidth = 0.004;
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = "rgba(226,232,240,0.6)";
        ctx.lineWidth = 0.002;
        ctx.beginPath();
        ctx.moveTo(bx, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Highlight one seta region
      ctx.strokeStyle = "rgba(251,191,36,0.9)";
      ctx.lineWidth = 0.012;
      const focusY = (baseY0 + baseY1) * 0.5;
      ctx.beginPath();
      ctx.moveTo(baseX + sceneWidth * 0.04, focusY - sceneHeight * 0.08);
      ctx.lineTo(baseX + sceneWidth * 0.06, focusY - sceneHeight * 0.08);
      ctx.moveTo(baseX + sceneWidth * 0.04, focusY + sceneHeight * 0.08);
      ctx.lineTo(baseX + sceneWidth * 0.06, focusY + sceneHeight * 0.08);
      ctx.stroke();

      ctx.restore();
    }

    _drawSpatulaClose(sceneWidth, sceneHeight, alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const wallX = sceneWidth * 0.7;

      // Single enlarged seta
      const baseX = wallX - sceneWidth * 0.25;
      const baseY = sceneHeight * 0.3;
      const length = sceneWidth * 0.22;
      const angle = -Math.PI / 2 + 0.15 * Math.sin(this.time * 1.1);
      const tipX = baseX + length * Math.cos(angle);
      const tipY = baseY + length * Math.sin(angle);

      ctx.strokeStyle = "rgba(148,163,184,0.9)";
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Branch into spatula pads near tip
      const branchCount = 12;
      for (let i = 0; i < branchCount; i++) {
        const u = 0.55 + (i / (branchCount - 1)) * 0.4;
        const cx = baseX + length * u * Math.cos(angle);
        const cy = baseY + length * u * Math.sin(angle);

        const padLen = sceneWidth * 0.05;
        const padAngle = angle + ((i - (branchCount - 1) / 2) / (branchCount - 1)) * 0.6;
        const px = cx + padLen * Math.cos(padAngle);
        const py = cy + padLen * Math.sin(padAngle) * 0.6;

        const nAngle = padAngle + Math.PI / 2;
        const size = sceneWidth * 0.02;

        const p0x = px + size * 0.6 * Math.cos(nAngle);
        const p0y = py + size * 0.6 * Math.sin(nAngle);
        const p1x = px - size * 0.6 * Math.cos(nAngle);
        const p1y = py - size * 0.6 * Math.sin(nAngle);
        const p2x = px + size * 1.8 * Math.cos(padAngle);
        const p2y = py + size * 1.3 * Math.sin(padAngle);

        ctx.beginPath();
        ctx.moveTo(p0x, p0y);
        ctx.lineTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.closePath();
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        ctx.fill();
      }

      // Contact band at wall
      const contactY0 = sceneHeight * 0.25;
      const contactY1 = sceneHeight * 0.75;
      const grad = ctx.createLinearGradient(wallX - 0.05, contactY0, wallX + 0.02, contactY1);
      grad.addColorStop(0, "rgba(251,191,36,0)");
      grad.addColorStop(0.5, "rgba(251,191,36,0.45)");
      grad.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(wallX - 0.08, contactY0, 0.1, contactY1 - contactY0);

      ctx.restore();
    }

    _drawAtoms(sceneWidth, sceneHeight, alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const wallX = sceneWidth * 0.7;

      // Zoomed rectangular patch for spatula tip
      const tipX0 = wallX - sceneWidth * 0.18;
      const tipX1 = wallX - sceneWidth * 0.02;
      const tipY0 = sceneHeight * 0.3;
      const tipY1 = sceneHeight * 0.7;

      ctx.fillStyle = "#020617";
      ctx.fillRect(tipX0, tipY0, tipX1 - tipX0, tipY1 - tipY0);
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 0.008;
      ctx.strokeRect(tipX0, tipY0, tipX1 - tipX0, tipY1 - tipY0);

      // Atoms on spatula side (left)
      const rows = 7;
      const cols = 10;
      const dx = (tipX1 - tipX0) / (cols + 2);
      const dy = (tipY1 - tipY0) / (rows + 2);

      const atomsSpatula = [];
      const atomsWall = [];

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const jitterX = (Math.random() - 0.5) * dx * 0.15;
          const jitterY = (Math.random() - 0.5) * dy * 0.15;
          const x = tipX0 + dx * (1.2 + i) + jitterX;
          const y = tipY0 + dy * (1.2 + j) + jitterY;
          atomsSpatula.push({ x, y });
        }
      }

      // Atoms on wall side (right), slightly offset
      const offset = sceneWidth * 0.022;
      atomsSpatula.forEach((a) => {
        atomsWall.push({
          x: a.x + offset,
          y: a.y + (Math.random() - 0.5) * dy * 0.2
        });
      });

      // Draw atoms
      ctx.fillStyle = "#38bdf8";
      atomsSpatula.forEach((a) => {
        ctx.beginPath();
        ctx.arc(a.x, a.y, sceneWidth * 0.008, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#f97316";
      atomsWall.forEach((a) => {
        ctx.beginPath();
        ctx.arc(a.x, a.y, sceneWidth * 0.008, 0, Math.PI * 2);
        ctx.fill();
      });

      // Van der Waals "bridges"
      ctx.strokeStyle = "rgba(251,191,36,0.75)";
      ctx.lineWidth = 0.004;
      ctx.setLineDash([0.02, 0.02]);

      for (let k = 0; k < atomsSpatula.length; k++) {
        const a = atomsSpatula[k];
        const b = atomsWall[k];
        const dx2 = b.x - a.x;
        const dy2 = b.y - a.y;
        const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist < sceneWidth * 0.06) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    if (container.__geckoZoomInstance) return;
    container.__geckoZoomInstance = new GeckoHierarchicalZoom(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
