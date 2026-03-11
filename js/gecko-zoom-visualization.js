(() => {
  const CONTAINER_ID = "gecko-zoom-model";

  // ---- Utility helpers -----------------------------------------------------

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

  // ---- Model setup ---------------------------------------------------------

  class GeckoZoomVisualization {
    constructor(container) {
      this.container = container;

      // Zoom state
      this.minZoom = 1.0;
      this.maxZoom = 8.0;
      this.zoom = 1.0;        // rendered zoom (smoothed)
      this.targetZoom = 1.0;  // user intent

      // For subtle parallax / motion
      this.time = 0;

      // Precomputed structure data
      this.lamellae = [];
      this.setae = [];
      this.spatulae = [];

      this._buildDom();
      this._generateStructures();
      this._bindEvents();
      this._resizeCanvas();
      this._updateLabel();
      requestAnimationFrame((t) => this._frame(t));
    }

    // Create canvas, overlay label, and controls INSIDE the container
    _buildDom() {
      // Style container without touching global CSS
      this.container.style.position = this.container.style.position || "relative";
      this.container.style.overflow = "hidden";
      this.container.style.minHeight = this.container.style.minHeight || "420px";

      // Canvas
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.touchAction = "none"; // allow wheel / pinch
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");

      // Label overlay
      this.label = document.createElement("div");
      this.label.style.position = "absolute";
      this.label.style.left = "16px";
      this.label.style.top = "16px";
      this.label.style.padding = "6px 10px";
      this.label.style.borderRadius = "999px";
      this.label.style.background = "rgba(0,0,0,0.6)";
      this.label.style.color = "#f5f7fb";
      this.label.style.fontSize = "0.82rem";
      this.label.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      this.label.style.pointerEvents = "none";
      this.label.style.transition = "opacity 0.25s ease";
      this.label.style.opacity = "1";
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
      this.controls.style.border = "1px solid rgba(255,255,255,0.15)";

      const mkBtn = (label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.style.border = "none";
        btn.style.outline = "none";
        btn.style.width = "28px";
        btn.style.height = "28px";
        btn.style.borderRadius = "999px";
        btn.style.cursor = "pointer";
        btn.style.background = "rgba(15,23,42,0.9)";
        btn.style.color = "#e5edf9";
        btn.style.fontSize = "0.9rem";
        btn.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.padding = "0";
        btn.onmouseenter = () => {
          btn.style.background = "rgba(30,64,175,0.95)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "rgba(15,23,42,0.9)";
        };
        return btn;
      };

      this.btnZoomOut = mkBtn("−");
      this.btnZoomIn = mkBtn("+");
      this.btnReset = mkBtn("⟳");
      this.btnReset.style.width = "32px";

      this.controls.appendChild(this.btnZoomOut);
      this.controls.appendChild(this.btnZoomIn);
      this.controls.appendChild(this.btnReset);
      this.container.appendChild(this.controls);
    }

    // Generate representative lamellae, setae, and spatula clusters
    _generateStructures() {
      // Normalized coordinate system: x in [0,1], y in [0,1], later mapped to canvas

      // Lamellae: stripes under the footpad area
      const lamellaCount = 14;
      for (let i = 0; i < lamellaCount; i++) {
        const t = i / (lamellaCount - 1);
        this.lamellae.push({
          y: 0.55 + (t - 0.5) * 0.25, // band vertical placement
          thickness: 0.02,
          curve: (Math.random() - 0.5) * 0.08
        });
      }

      // Setae: anchor along lamellae, but we only represent a subset
      const setaeCount = 260; // within 200–400 guideline
      for (let i = 0; i < setaeCount; i++) {
        const lam = this.lamellae[i % lamellaCount];
        const baseX = 0.3 + Math.random() * 0.25;
        const baseY = lam.y + (Math.random() - 0.5) * 0.02;
        const length = 0.18 + Math.random() * 0.1;
        const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.4; // generally downward
        this.setae.push({
          baseX,
          baseY,
          length,
          angle,
          waviness: 0.1 + Math.random() * 0.2
        });
      }

      // Spatula clusters: a few per seta, but represented as groups at the ends
      const spatulaPerSeta = 4;
      for (let i = 0; i < this.setae.length; i++) {
        const s = this.setae[i];
        const clusters = [];
        for (let j = 0; j < spatulaPerSeta; j++) {
          const offset = 0.7 + (j / spatulaPerSeta) * 0.3;
          clusters.push({
            along: offset
          });
        }
        this.spatulae.push(clusters);
      }
    }

    // ---- Events -------------------------------------------------------------

    _bindEvents() {
      // Wheel / trackpad zoom
      this.container.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY;
          const zoomFactor = Math.exp(-delta * 0.0015); // smooth
          this.targetZoom = clamp(this.targetZoom * zoomFactor, this.minZoom, this.maxZoom);
        },
        { passive: false }
      );

      // Zoom buttons
      this.btnZoomIn.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom * 1.3, this.minZoom, this.maxZoom);
      });
      this.btnZoomOut.addEventListener("click", () => {
        this.targetZoom = clamp(this.targetZoom / 1.3, this.minZoom, this.maxZoom);
      });
      this.btnReset.addEventListener("click", () => {
        this.targetZoom = 1.0;
      });

      // Resize
      window.addEventListener("resize", () => this._resizeCanvas());
    }

    _resizeCanvas() {
      const rect = this.container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- Label based on zoom level -----------------------------------------

    _updateLabel() {
      const z = this.zoom;
      let text;
      if (z < 1.5) {
        text = "Gecko Foot (macroscopic view)";
      } else if (z < 3) {
        text = "Lamellae Ridges (footpad microstructure)";
      } else if (z < 6) {
        text = "Microscopic Setae (hair-like fibers)";
      } else {
        text = "Nanoscopic Spatula Tips (van der Waals contact)";
      }
      this.label.textContent = text;
    }

    // ---- Main animation frame ----------------------------------------------

    _frame(timestamp) {
      const dt = 0.016; // stable for simplicity
      this.time += dt;

      // Smooth zoom toward target
      const smoothing = 0.12;
      this.zoom = lerp(this.zoom, this.targetZoom, smoothing);

      this._render();
      requestAnimationFrame((t) => this._frame(t));
    }

    // ---- Rendering ----------------------------------------------------------

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
      bg.addColorStop(1, "#020b14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Subtle surface grid for context
      this._drawBackgroundGrid(width, height);

      // Normalized → screen mapping
      const scaleBase = height * 0.9;
      const zoomScale = scaleBase * this.zoom;
      const originX = width * 0.5;
      const originY = height * 0.35;

      // Establish a transform so that (0,0)-(1,1) maps to a zoomed region
      ctx.save();
      ctx.translate(originX, originY);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-0.5, -0.5); // center around (0.5,0.5)

      // Draw wall surface (y ~0.65-0.7 in normalized coords)
      this._drawSurface();

      // Determine visibility weights for each level using smooth transitions
      const z = this.zoom;

      const footAlpha = 1 - smoothstep(1.3, 2.0, z);
      const lamellaAlpha = smoothstep(1.2, 2.0, z) * (1 - smoothstep(3.0, 4.0, z));
      const setaeAlpha = smoothstep(2.5, 3.5, z) * (1 - smoothstep(5.2, 6.0, z));
      const spatulaAlpha = smoothstep(5.0, 6.2, z);

      // Draw in hierarchical order
      if (footAlpha > 0.01) this._drawFootSilhouette(footAlpha);
      if (lamellaAlpha > 0.01) this._drawLamellae(lamellaAlpha);
      if (setaeAlpha > 0.01) this._drawSetae(setaeAlpha);
      if (spatulaAlpha > 0.01) this._drawSpatulae(spatulaAlpha);

      ctx.restore();

      this._updateLabel();
    }

    _drawBackgroundGrid(width, height) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.06)";
      ctx.lineWidth = 1;
      const step = 32;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawSurface() {
      const ctx = this.ctx;
      ctx.save();

      const y0 = 0.65;
      const y1 = 0.8;

      // Slightly textured plane
      ctx.fillStyle = "#111827";
      ctx.fillRect(-0.5, y0, 2.0, y1 - y0);

      // Top highlight
      ctx.fillStyle = "rgba(148,163,184,0.65)";
      ctx.fillRect(-0.5, y0 - 0.003, 2.0, 0.003);

      // Micro-texture noise lines
      ctx.strokeStyle = "rgba(148,163,184,0.18)";
      ctx.lineWidth = 0.0015;
      for (let i = 0; i < 40; i++) {
        const x0 = -0.4 + Math.random() * 1.8;
        const x1 = x0 + 0.18 + Math.random() * 0.2;
        const y = y0 + 0.01 + (i / 60) * 0.06;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawFootSilhouette(alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      // Simple footpad + part of leg as shapes
      ctx.fillStyle = "#0f172a";

      // Leg segment
      ctx.beginPath();
      ctx.ellipse(0.3, 0.1, 0.22, 0.35, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Footpad
      ctx.beginPath();
      ctx.ellipse(0.42, 0.45, 0.35, 0.22, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Soft outline
      ctx.strokeStyle = "rgba(148,163,184,0.45)";
      ctx.lineWidth = 0.01;
      ctx.stroke();

      // Contact glow
      const grad = ctx.createRadialGradient(0.45, 0.6, 0.05, 0.45, 0.68, 0.35);
      grad.addColorStop(0, "rgba(250,204,21,0.35)");
      grad.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0.1, 0.5, 0.8, 0.4);

      ctx.restore();
    }

    _drawLamellae(alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 0.01;

      this.lamellae.forEach((lam, idx) => {
        const baseY = lam.y;
        const curve = lam.curve;
        const xStart = 0.24;
        const xEnd = 0.65;

        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const x = lerp(xStart, xEnd, t);
          const wave = Math.sin(t * Math.PI) * curve;
          const y = baseY + wave;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const isHighlight = idx % 2 === 0;
        ctx.strokeStyle = isHighlight
          ? "rgba(148,163,184,0.95)"
          : "rgba(148,163,184,0.45)";
        ctx.stroke();
      });

      ctx.restore();
    }

    _drawSetae(alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.lineWidth = 0.005;
      const time = this.time;

      for (let i = 0; i < this.setae.length; i++) {
        const s = this.setae[i];

        // Slight wiggle based on time and position
        const phase = (i / this.setae.length) * Math.PI * 2;
        const sway = Math.sin(time * 1.4 + phase) * 0.08 * s.waviness;

        const baseX = s.baseX;
        const baseY = s.baseY;
        const length = s.length;
        const angle = s.angle + sway;

        const tipX = baseX + length * Math.cos(angle);
        const tipY = baseY + length * Math.sin(angle);

        // Two-tone for core + halo
        ctx.strokeStyle = "rgba(148,163,184,0.75)";
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.strokeStyle = "rgba(236,252,203,0.6)";
        ctx.lineWidth = 0.0025;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawSpatulae(alpha) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const time = this.time;

      for (let i = 0; i < this.setae.length; i++) {
        const s = this.setae[i];
        const clusters = this.spatulae[i];
        const baseX = s.baseX;
        const baseY = s.baseY;

        const phase = (i / this.setae.length) * Math.PI * 2;
        const sway = Math.sin(time * 1.4 + phase) * 0.08 * s.waviness;
        const angle = s.angle + sway;
        const len = s.length;

        clusters.forEach((cl, idx) => {
          const along = cl.along;
          const cx = baseX + len * along * Math.cos(angle);
          const cy = baseY + len * along * Math.sin(angle);

          // At the wall, spatula tips flatten against the surface (y ≈ 0.65)
          const contactY = 0.65;
          const isAtSurface = cy > contactY - 0.02;

          const tipY = isAtSurface ? contactY : cy;
          const normalAngle = angle + Math.PI / 2;
          const size = 0.02 + 0.01 * Math.sin(time * 2.1 + idx * 0.7);

          const p0x = cx + size * 0.5 * Math.cos(normalAngle);
          const p0y = tipY + size * 0.5 * Math.sin(normalAngle);
          const p1x = cx - size * 0.5 * Math.cos(normalAngle);
          const p1y = tipY - size * 0.5 * Math.sin(normalAngle);
          const p2x = cx + size * 1.8 * Math.cos(angle);
          const p2y = tipY + size * 1.8 * Math.sin(angle) * 0.4;

          ctx.beginPath();
          ctx.moveTo(p0x, p0y);
          ctx.lineTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.closePath();

          const baseColor = isAtSurface
            ? "rgba(250,204,21,"
            : "rgba(148,163,184,";

          const opacity = isAtSurface ? 0.85 : 0.45;
          ctx.fillStyle = baseColor + opacity + ")";
          ctx.fill();
        });
      }

      // Faint contact band glow
      const glowY = 0.65;
      const grad = ctx.createLinearGradient(0.2, glowY - 0.02, 0.2, glowY + 0.04);
      grad.addColorStop(0, "rgba(250,204,21,0.0)");
      grad.addColorStop(0.5, "rgba(250,204,21,0.4)");
      grad.addColorStop(1, "rgba(250,204,21,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0.0, glowY - 0.03, 1.2, 0.1);

      ctx.restore();
    }
  }

  // ---- Bootstrap -----------------------------------------------------------

  function initGeckoZoomVisualization() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    // Avoid double-init
    if (container.__geckoZoomInstance) return;
    container.__geckoZoomInstance = new GeckoZoomVisualization(container);
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGeckoZoomVisualization);
  } else {
    initGeckoZoomVisualization();
  }
})();
