(() => {
  const CONTAINER_ID = "gecko-zoom-model";

  // ---- Utilities -----------------------------------------------------------

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ---- Main class ----------------------------------------------------------

  class GeckoHierarchicalZoom {
    constructor(container) {
      this.container = container;

      // Zoom and camera state
      this.minZoom = 1.0;
      this.maxZoom = 9.0;
      this.zoom = 1.0;
      this.targetZoom = 1.0;

      this.time = 0;

      // Structural data
      this.lamellaBands = [];
      this.microLamella = [];
      this.setae = [];
      this.spatulaClusters = [];
      this.atoms = [];

      this._buildDom();
      this._generateStructures();
      this._bindEvents();
      this._resizeCanvas();
      this._updateLabel();
      requestAnimationFrame((t) => this._frame(t));
    }

    // Canvas, labels, controls (all scoped to container)
    _buildDom() {
      this.container.style.position = this.container.style.position || "relative";
      this.container.style.overflow = "hidden";
      this.container.style.minHeight = this.container.style.minHeight || "420px";

      // Canvas
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.touchAction = "none";
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");

      // Label overlay
      this.label = document.createElement("div");
      this.label.style.position = "absolute";
      this.label.style.left = "16px";
      this.label.style.top = "16px";
      this.label.style.padding = "6px 12px";
      this.label.style.borderRadius = "999px";
      this.label.style.background = "rgba(0,0,0,0.6)";
      this.label.style.color = "#f5f7fb";
      this.label.style.fontSize = "0.82rem";
      this.label.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      this.label.style.pointerEvents = "none";
      this.label.style.transition = "opacity 0.25s ease";
      this.container.appendChild(this.label);

      // Zoom controls (bottom-right)
      this.controls = document.createElement("div");
      this.controls.style.position = "absolute";
      this.controls.style.right = "16px";
      this.controls.style.bottom = "16px";
      this.controls.style.display = "flex";
      this.controls.style.flexDirection = "row";
      this.controls.style.gap = "6px";
      this.controls.style.background = "rgba(0,0,0,0.55)";
      this.controls.style.borderRadius = "999px";
      this.controls.style.padding = "4px";
      this.controls.style.border = "1px solid rgba(255,255,255,0.18)";

      const mkBtn = (text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.style.border = "none";
        b.style.outline = "none";
        b.style.width = "28px";
        b.style.height = "28px";
        b.style.borderRadius = "999px";
        b.style.cursor = "pointer";
        b.style.background = "rgba(15,23,42,0.92)";
        b.style.color = "#e5edf9";
        b.style.fontSize = "0.9rem";
        b.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        b.style.display = "flex";
        b.style.alignItems = "center";
        b.style.justifyContent = "center";
        b.onmouseenter = () => {
          b.style.background = "rgba(37,99,235,0.95)";
        };
        b.onmouseleave = () => {
          b.style.background = "rgba(15,23,42,0.92)";
        };
        return b;
      };

      this.btnOut = mkBtn("−");
      this.btnIn = mkBtn("+");
      this.btnReset = mkBtn("⟳");
      this.btnReset.style.width = "32px";

      this.controls.appendChild(this.btnOut);
      this.controls.appendChild(this.btnIn);
      this.controls.appendChild(this.btnReset);
      this.container.appendChild(this.controls);
    }

    // Generate representative geometry in normalized space
    _generateStructures() {
      // Coordinate conventions (side view):
      // - x in [0,1], left to right
      // - y in [0,1], top to bottom
      // - Vertical wall at x ≈ 0.75
      const wallX = 0.75;

      // Macroscopic lamella bands under footpad (side view strips)
      const bandCount = 10;
      for (let i = 0; i < bandCount; i++) {
        const t = i / (bandCount - 1);
        this.lamellaBands.push({
          // Each band emerges from foot towards wall
          x0: lerp(0.4, wallX - 0.02, 0.4 + 0.4 * Math.random()),
          x1: wallX - 0.01,
          y: 0.45 + (t - 0.5) * 0.32,
          thickness: 0.02 + Math.random() * 0.01,
          curvature: (Math.random() - 0.5) * 0.06
        });
      }

      // Inside a single band: “micro-lamella” plates (zoomed ridge interior)
      const plateCount = 40;
      for (let i = 0; i < plateCount; i++) {
        const t = i / plateCount;
        this.microLamella.push({
          localX: 0.52 + t * 0.18,   // narrow region inside a band
          localY: 0.54 + (Math.random() - 0.5) * 0.06,
          height: 0.015 + Math.random() * 0.01
        });
      }

      // Setae anchored along micro-lamella region, pointing to wall
      const setaeCount = 260;
      for (let i = 0; i < setaeCount; i++) {
        const lam = this.microLamella[i % this.microLamella.length];
        const baseX = lam.localX + (Math.random() - 0.5) * 0.01;
        const baseY = lam.localY + (Math.random() - 0.5) * lam.height;
        const length = 0.12 + Math.random() * 0.06;
        const angle = (Math.random() * 0.25 - 0.125); // around horizontal to the right
        this.setae.push({
          baseX,
          baseY,
          length,
          angle,
          waviness: 0.1 + Math.random() * 0.25
        });
      }

      // Spatula clusters along each seta near the wall
      const spatPerSeta = 4;
      for (let i = 0; i < this.setae.length; i++) {
        const clusters = [];
        for (let j = 0; j < spatPerSeta; j++) {
          clusters.push({ along: 0.55 + (j / spatPerSeta) * 0.45 });
        }
        this.spatulaClusters.push(clusters);
      }

      // Atom layer: two opposing rows (wall atoms & spatula atoms)
      const atomCols = 22;
      const atomRows = 3;
      const baseY = 0.55;
      for (let row = 0; row < atomRows; row++) {
        for (let col = 0; col < atomCols; col++) {
          const t = col / (atomCols - 1);
          const x = lerp(wallX - 0.07, wallX - 0.01, t);
          const jitterY = (Math.random() - 0.5) * 0.01;
          const upper = row === 0;
          this.atoms.push({
            x,
            y: baseY + jitterY + (upper ? -0.01 : 0.01) + row * 0.01,
            upper
          });
        }
      }
    }

    // Events: wheel zoom, buttons, resize
    _bindEvents() {
      this.container.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const zoomFactor = Math.exp(-e.deltaY * 0.0015);
          this.targetZoom = clamp(this.targetZoom * zoomFactor, this.minZoom, this.maxZoom);
        },
        { passive: false }
      );

      this.btnIn.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom * 1.35, this.minZoom, this.maxZoom);
      });

      this.btnOut.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom / 1.35, this.minZoom, this.maxZoom);
      });

      this.btnReset.addEventListener("click", () => {
        this.targetZoom = 1.0;
      });

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

    _updateLabel() {
      const z = this.zoom;
      let txt;
      if (z < 1.6) {
        txt = "Gecko foot pressing on wall (side view)";
      } else if (z < 3.0) {
        txt = "Footpad lamella ridges contacting the wall";
      } else if (z < 5.0) {
        txt = "Deeper into one ridge: dense lamella micro-plates and setae bases";
      } else if (z < 7.0) {
        txt = "Zoom into a single seta: spatula pads at the wall";
      } else {
        txt = "Atoms from spatula and wall with van der Waals interactions";
      }
      this.label.textContent = txt;
    }

    _frame() {
      this.time += 0.016;
      this.zoom = lerp(this.zoom, this.targetZoom, 0.14);
      this._render();
      requestAnimationFrame(() => this._frame());
    }

    // ---- Rendering ----------------------------------------------------------

    _render() {
      const ctx = this.ctx;
      if (!ctx) return;

      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      if (width < 2 || height < 2) return;

      ctx.clearRect(0, 0, width, height);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(1, "#020b16");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      this._drawBackgroundGrid(width, height);

      // Camera: we progressively zoom and slide toward the contact interface
      const baseScale = height * 0.8;
      const zoomScale = baseScale * this.zoom;

      const focusT = smoothstep(2.0, 8.5, this.zoom);
      const focusX = lerp(0.45, 0.75, focusT); // move focus toward wall
      const focusY = lerp(0.5, 0.55, focusT);

      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-focusX, -focusY);

      // Wall
      const wallX = 0.75;
      this._drawWall(wallX);

      // Level weights (smooth transitions)
      const z = this.zoom;

      const footAlpha = 1 - smoothstep(1.2, 2.0, z);
      const lamellaBandAlpha = smoothstep(1.3, 2.2, z) * (1 - smoothstep(3.0, 3.8, z));
      const microLamellaAlpha = smoothstep(2.5, 3.4, z) * (1 - smoothstep(4.6, 5.4, z));
      const setaeAlpha = smoothstep(3.4, 4.4, z) * (1 - smoothstep(6.2, 7.0, z));
      const spatulaAlpha = smoothstep(5.0, 6.2, z) * (1 - smoothstep(7.0, 7.6, z));
      const atomAlpha = smoothstep(6.4, 7.6, z);

      if (footAlpha > 0.01) this._drawFoot(footAlpha, wallX);
      if (lamellaBandAlpha > 0.01) this._drawLamellaBands(lamellaBandAlpha, wallX);
      if (microLamellaAlpha > 0.01) this._drawMicroLamella(microLamellaAlpha);
      if (setaeAlpha > 0.01) this._drawSetae(setaeAlpha, wallX);
      if (spatulaAlpha > 0.01) this._drawSpatulae(spatulaAlpha, wallX);
      if (atomAlpha > 0.01) this._drawAtoms(atomAlpha, wallX);

      ctx.restore();
      this._updateLabel();
    }

    _drawBackgroundGrid(w, h) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.06)";
      ctx.lineWidth = 1;
      const step = 32;
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

    _drawWall(wallX) {
      const ctx = this.ctx;
      ctx.save();

      // Wall body
      ctx.fillStyle = "#111827";
      ctx.fillRect(wallX, 0.25, 0.35, 0.6);

      // Edge
      ctx.strokeStyle = "rgba(148,163,184,0.8)";
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.moveTo(wallX, 0.25);
      ctx.lineTo(wallX, 0.85);
      ctx.stroke();

      // Micro roughness
      ctx.strokeStyle = "rgba(148,163,184,0.22)";
      ctx.lineWidth = 0.003;
      for (let i = 0; i < 40; i++) {
        const y = 0.3 + (i / 40) * 0.45;
        const dx = (Math.random() - 0.5) * 0.01;
        ctx.beginPath();
        ctx.moveTo(wallX + dx, y);
        ctx.lineTo(wallX + dx + 0.02, y);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = "rgba(148,163,184,0.8)";
      ctx.font = "0.04px 'Segoe UI', system-ui";
      ctx.fillText("Wall surface", wallX + 0.02, 0.3);

      ctx.restore();
    }

    _drawFoot(alpha, wallX) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      // Leg cylinder
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(0.45, 0.35, 0.12, 0.26, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Footpad shape pressing onto wall (slightly flattened at wall)
      ctx.beginPath();
      ctx.ellipse(0.6, 0.55, 0.22, 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Contact glow near wall
      const grad = ctx.createRadialGradient(wallX - 0.03, 0.55, 0.02, wallX - 0.03, 0.55, 0.18);
      grad.addColorStop(0, "rgba(250,204,21,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0.4, 0.38, 0.4, 0.34);

      ctx.restore();
    }

    _drawLamellaBands(alpha, wallX) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      this.lamellaBands.forEach((band, idx) => {
        const y = band.y;
        const t = (idx / this.lamellaBands.length);
        const offset = Math.sin(this.time * 0.4 + t * Math.PI) * band.curvature;
        const x0 = band.x0;
        const x1 = band.x1;

        ctx.beginPath();
        ctx.moveTo(x0, y + offset);
        ctx.lineTo(x1, y + offset);
        ctx.lineTo(x1, y + band.thickness + offset);
        ctx.lineTo(x0, y + band.thickness + offset);
        ctx.closePath();

        ctx.fillStyle = idx % 2 === 0
          ? "rgba(148,163,184,0.85)"
          : "rgba(100,116,139,0.85)";
        ctx.fill();
      });

      // Label near lamella region
      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.font = "0.035px 'Segoe UI', system-ui";
      ctx.fillText("Lamella ridges", wallX - 0.25, 0.38);

      ctx.restore();
    }

    _drawMicroLamella(alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      this.microLamella.forEach((p, i) => {
        const phase = (i / this.microLamella.length) * Math.PI * 2;
        const wobble = Math.sin(this.time * 0.8 + phase) * 0.003;
        const x = p.localX + wobble;
        const y0 = p.localY - p.height;
        const y1 = p.localY + p.height;

        ctx.strokeStyle = "rgba(148,163,184,0.6)";
        ctx.lineWidth = 0.004;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.stroke();
      });

      ctx.restore();
    }

    _drawSetae(alpha, wallX) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.lineWidth = 0.004;
      const t = this.time;

      for (let i = 0; i < this.setae.length; i++) {
        const s = this.setae[i];
        const phase = (i / this.setae.length) * Math.PI * 2;
        const sway = Math.sin(t * 1.4 + phase) * 0.12 * s.waviness;

        const baseX = s.baseX;
        const baseY = s.baseY;
        const angle = s.angle + sway;
        const length = Math.min(s.length, wallX - baseX - 0.005);

        const tipX = baseX + length * Math.cos(angle);
        const tipY = baseY + length * Math.sin(angle) * 0.4;

        // Main fiber
        ctx.strokeStyle = "rgba(148,163,184,0.7)";
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Highlight core
        ctx.strokeStyle = "rgba(226,232,240,0.7)";
        ctx.lineWidth = 0.002;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = "rgba(209,250,229,0.9)";
      ctx.font = "0.032px 'Segoe UI', system-ui";
      ctx.fillText("Setae fibers", wallX - 0.27, 0.6);

      ctx.restore();
    }

    _drawSpatulae(alpha, wallX) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const t = this.time;

      for (let i = 0; i < this.setae.length; i++) {
        const s = this.setae[i];
        const clusters = this.spatulaClusters[i];
        const phase = (i / this.setae.length) * Math.PI * 2;
        const sway = Math.sin(t * 1.4 + phase) * 0.12 * s.waviness;

        const angle = s.angle + sway;
        const baseX = s.baseX;
        const baseY = s.baseY;
        const len = s.length;

        clusters.forEach((c, idx) => {
          const along = c.along;
          let cx = baseX + len * along * Math.cos(angle);
          let cy = baseY + len * along * Math.sin(angle) * 0.4;

          // Clamp to wall for near-tip clusters
          const atWall = cx > wallX - 0.02;
          if (atWall) cx = wallX - 0.004;

          const size = 0.015 + 0.007 * Math.sin(t * 2.0 + idx * 0.7);

          const normal = angle + Math.PI / 2;
          const p0x = cx + size * 0.6 * Math.cos(normal);
          const p0y = cy + size * 0.6 * Math.sin(normal);
          const p1x = cx - size * 0.6 * Math.cos(normal);
          const p1y = cy - size * 0.6 * Math.sin(normal);
          const p2x = cx + size * 1.7 * Math.cos(angle);
          const p2y = cy + size * 1.7 * Math.sin(angle) * 0.4;

          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.lineTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.closePath();

          if (atWall) {
            ctx.fillStyle = "rgba(250,204,21,0.85)";
          } else {
            ctx.fillStyle = "rgba(148,163,184,0.55)";
          }
          ctx.fill();
        });
      }

      // Contact band glow
      const gy = 0.55;
      const grad = ctx.createLinearGradient(wallX - 0.08, gy - 0.03, wallX - 0.01, gy + 0.03);
      grad.addColorStop(0, "rgba(250,204,21,0.0)");
      grad.addColorStop(0.45, "rgba(250,204,21,0.45)");
      grad.addColorStop(1, "rgba(250,204,21,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(wallX - 0.1, gy - 0.05, 0.12, 0.12);

      ctx.restore();
    }

    _drawAtoms(alpha, wallX) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      // Two clouds of atoms, slightly vibrating
      this.atoms.forEach((a, i) => {
        const phase = (i / this.atoms.length) * Math.PI * 2;
        const jitterX = Math.sin(this.time * 2.4 + phase) * 0.002;
        const jitterY = Math.cos(this.time * 2.0 + phase) * 0.002;

        const x = a.x + jitterX;
        const y = a.y + jitterY;

        const r = 0.006;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = a.upper ? "#60a5fa" : "#fbbf24";
        ctx.fill();
      });

      // Van der Waals "bridges" between close pairs
      ctx.strokeStyle = "rgba(129,140,248,0.6)";
      ctx.lineWidth = 0.002;
      for (let i = 0; i < this.atoms.length; i++) {
        const a = this.atoms[i];
        if (!a.upper) continue;
        for (let j = 0; j < this.atoms.length; j++) {
          const b = this.atoms[j];
          if (b.upper) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 0.0003 && d2 > 0.00002) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "0.032px 'Segoe UI', system-ui";
      ctx.fillText("Atoms + van der Waals forces", wallX - 0.28, 0.5);

      ctx.restore();
    }
  }

  // ---- Bootstrap -----------------------------------------------------------

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
