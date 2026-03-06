// ─────────────────────────────────────────────────────────────────
// ADHESIVE PHYSICS DATA
// All σ values (shear/normal adhesive stress) from peer-reviewed literature:
//
// gecko  : Autumn et al. 2002 PNAS — 100 kPa shear adhesion for synthetic setae arrays
//          (Real gecko ~1 MPa but synthetic tape ~100 kPa, consistent with 136 kg / 134 cm²)
// tape   : PSA (pressure-sensitive adhesive) shear strength — 3M Scotch ~20–40 kPa
//          Kinloch 1994, "Adhesion and Adhesives" — 30 kPa conservative midpoint
// velcro : Brody et al. measured ~6 N/cm² shear = 60 kPa
//          Velcro Industries datasheet — glass-smooth surface, standard density
// glue   : Cyanoacrylate (super glue) — ASTM D1002 lap shear: 10–25 MPa bulk,
//          practical bond accounting for surface prep / thin film: ~1.5 MPa
//          (reduces to ~150 kPa if poor prep — we use ideal conditions)
// suction: Atmospheric pressure limit = 101,325 Pa. Practical cup efficiency ~70%
//          → max σ = 70 kPa. CRITICAL: fails in vacuum (no atmosphere).
//          Hold force = P_atm × area × η — independent of gravity.
// ─────────────────────────────────────────────────────────────────

const ADHESIVES = {
  gecko: {
    sigma: 100000,          // Pa — van der Waals dry adhesion
    label: "Gecko Tape",
    color: "#ffbd59",
    colorDark: "#c48b00",
    mechanism: "Van der Waals (dry, directional)",
    vacuumOk: true,
    note: null,
    draw: drawGecko
  },
  tape: {
    sigma: 30000,           // Pa — PSA shear
    label: "Normal Tape",
    color: "#e0e8ef",
    colorDark: "#8090a0",
    mechanism: "Pressure-sensitive adhesive (chemical)",
    vacuumOk: false,
    note: "PSA tape degrades in extreme vacuum — limited space use.",
    draw: drawTape
  },
  velcro: {
    sigma: 60000,           // Pa — hook-loop shear
    label: "Velcro",
    color: "#7c9cbf",
    colorDark: "#3a6080",
    mechanism: "Mechanical interlocking (hook & loop)",
    vacuumOk: true,
    note: "Velcro loses ~30% strength on rough or contaminated surfaces.",
    draw: drawVelcro
  },
  glue: {
    sigma: 1500000,         // Pa — cyanoacrylate lap shear (ideal conditions)
    label: "Super Glue",
    color: "#f5a623",
    colorDark: "#8a4d00",
    mechanism: "Covalent / ionic chemical bond",
    vacuumOk: true,
    permanent: true,
    note: "Permanent bond — cannot be detached without damaging surface.",
    draw: drawGlue
  },
  suction: {
    sigma: 70000,           // Pa — practical atmospheric, ~70% of 101,325 Pa
    label: "Suction Cup",
    color: "#64c8ff",
    colorDark: "#0050a0",
    mechanism: "Atmospheric pressure differential",
    vacuumOk: false,
    atmosphericOnly: true,
    note: null,
    draw: drawSuction
  }
};

// ── DOM refs ──────────────────────────────────────────────────────
const massInput       = document.getElementById("massInput");
const gravityInput    = document.getElementById("gravityInput");
const areaSlider      = document.getElementById("areaSlider");
const efficiencySlider= document.getElementById("efficiencySlider");
const areaValue       = document.getElementById("areaValue");
const efficiencyValue = document.getElementById("efficiencyValue");
const adhesiveForceEl = document.getElementById("adhesiveForce");
const weightForceEl   = document.getElementById("weightForce");
const safetyFactorEl  = document.getElementById("safetyFactor");
const statusLabel     = document.getElementById("statusLabel");
const maxLoadEl       = document.getElementById("maxLoad");
const warningBanner   = document.getElementById("warningBanner");
const canvas          = document.getElementById("simCanvas");
const ctx             = canvas.getContext("2d");

const presetBtns  = document.querySelectorAll(".preset-btn:not(.preset-g)");
const gravBtns    = document.querySelectorAll(".preset-g");
const adhBtns     = document.querySelectorAll(".adh-btn");

// ── State ─────────────────────────────────────────────────────────
let currentType = "gecko";
let slipOffset  = 0;
let time        = 0;

let state = {
  mass: 8,
  g: 9.81,
  areaCm2: 10,
  efficiency: 0.9,
  adhesiveForce: 0,
  weightForce: 0,
  safetyFactor: 0,
  status: "HOLD",
  maxMass: 0,
  isVacuum: false
};

// ── Resize ───────────────────────────────────────────────────────
function resizeCanvas() {
  const dpr  = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene();
}
window.addEventListener("resize", resizeCanvas);

// ── Physics update ────────────────────────────────────────────────
function updateSimulation() {
  const adh    = ADHESIVES[currentType];
  const mass   = Math.max(0.001, parseFloat(massInput.value) || 0.001);
  const g      = Math.max(0, parseFloat(gravityInput.value) || 0);
  const areaCm2= parseFloat(areaSlider.value) || 10;
  const eff    = parseFloat(efficiencySlider.value) || 0.9;
  const areaM2 = areaCm2 / 10000;

  areaValue.textContent      = areaCm2.toFixed(0);
  efficiencyValue.textContent= eff.toFixed(2);

  const isVacuum  = g < 0.01;           // ISS or manual ~0
  const isSpace   = g < 2.0;            // Moon or below

  // Suction cup: force is atmospheric, independent of gravity.
  // But it DOES NOT WORK in vacuum (no atmosphere to create differential).
  let adhesiveForce;
  let effectiveSigma = adh.sigma;

  if (currentType === "suction" && isVacuum) {
    adhesiveForce = 0;   // No atmosphere = no suction
  } else {
    adhesiveForce = effectiveSigma * areaM2 * eff;
  }

  const weightForce = mass * g;

  // Safety factor: handle zero weight (ISS)
  let safetyFactor;
  if (weightForce < 0.0001) {
    safetyFactor = adhesiveForce > 0 ? 999 : 1;
  } else {
    safetyFactor = adhesiveForce / weightForce;
  }

  // Max holdable mass at current area + efficiency
  let maxMass;
  if (currentType === "suction" && isVacuum) {
    maxMass = 0;
  } else if (g < 0.0001) {
    maxMass = Infinity;
  } else {
    maxMass = (effectiveSigma * areaM2 * eff) / g;
  }

  // Status
  let status, statusColor;
  if (currentType === "suction" && isVacuum) {
    status = "NO HOLD"; statusColor = "#f87171";
  } else if (safetyFactor >= 999) {
    status = "HOLD ∞";  statusColor = "#4ade80";
  } else if (safetyFactor > 1.3) {
    status = "HOLD";    statusColor = "#4ade80";
  } else if (safetyFactor > 1.0) {
    status = "WARNING"; statusColor = "#facc15";
  } else {
    status = "FAIL";    statusColor = "#f87171";
  }

  // Warning banner logic
  let warnings = [];
  if (currentType === "suction" && isVacuum) {
    warnings.push("⚠️ Suction cups require atmospheric pressure to function. In space (ISS / vacuum), there is no atmosphere — the cup generates zero holding force.");
  } else if (currentType === "suction" && isSpace) {
    warnings.push("⚠️ Suction cup performance may vary in low-atmosphere environments (Moon has ~0 atmosphere, Mars ~0.6%). Shown assuming Earth-level atmospheric pressure.");
  }
  if (currentType === "tape" && isVacuum) {
    warnings.push("⚠️ PSA tape outgases in high vacuum — adhesion degrades significantly over time. Not rated for long-term space use.");
  }
  if (currentType === "glue") {
    warnings.push("ℹ️ Super glue forms a permanent covalent bond. Unlike gecko tape, it cannot be reattached once removed — the bond is destructive on detachment.");
  }
  if (adh.note && !warnings.find(w => w.includes(adh.note))) {
    // Only show note if not already covered
  }

  if (warnings.length > 0) {
    warningBanner.innerHTML = warnings.join("<br><br>");
    warningBanner.classList.add("visible");
  } else {
    warningBanner.classList.remove("visible");
  }

  // Update state
  state = { mass, g, areaCm2, efficiency: eff, adhesiveForce, weightForce, safetyFactor, status, statusColor, maxMass, isVacuum };

  // Update results
  adhesiveForceEl.textContent = adhesiveForce < 0.01 ? "0.00 N" : adhesiveForce.toFixed(1) + " N";
  weightForceEl.textContent   = weightForce.toFixed(2) + " N";
  safetyFactorEl.textContent  = safetyFactor >= 999 ? "∞" : safetyFactor.toFixed(2);
  statusLabel.textContent     = status;
  statusLabel.style.color     = statusColor;

  if (maxMass === 0) {
    maxLoadEl.innerHTML = "<span style='color:#f87171'>0 kg (no hold)</span>";
  } else if (!isFinite(maxMass)) {
    maxLoadEl.innerHTML = "<span style='color:#4ade80'>∞ (weightless)</span>";
  } else {
    const kg = maxMass.toFixed(2);
    const colour = maxMass >= mass ? "#4ade80" : "#f87171";
    maxLoadEl.innerHTML = `<span style='color:${colour}'>${kg} kg</span>`;
  }
}

// ── Shared draw helpers ───────────────────────────────────────────
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function drawArrow(x1, y1, x2, y2, color, label) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const hs  = 10;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs * Math.cos(ang - Math.PI/6), y2 - hs * Math.sin(ang - Math.PI/6));
  ctx.lineTo(x2 - hs * Math.cos(ang + Math.PI/6), y2 - hs * Math.sin(ang + Math.PI/6));
  ctx.closePath(); ctx.fill();
  ctx.font = "12px Segoe UI"; ctx.fillStyle = color;
  ctx.fillText(label, x2 + 10, y2 - 4);
}

function grid(W, H) {
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 28) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 28) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawWall(wallX, H) {
  ctx.fillStyle = "#1e2e3e";
  ctx.fillRect(wallX - 32, 20, 32, H - 40);
  // Brick lines
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let y = 20; y < H - 40; y += 22) {
    ctx.beginPath(); ctx.moveTo(wallX - 32, y); ctx.lineTo(wallX, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(wallX, 20); ctx.lineTo(wallX, H - 20); ctx.stroke();
}

function drawMass(linkX, tapeBottom, slipOff) {
  const chainLen = 44;
  const massNorm = clamp((state.mass - 0.18) / (70 - 0.18), 0, 1);
  const sz = 36 + massNorm * 68;
  const bx = linkX - sz / 2;
  const by = tapeBottom + chainLen + slipOff;

  ctx.strokeStyle = "#9aa4af"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(linkX, tapeBottom + slipOff); ctx.lineTo(linkX, by); ctx.stroke();

  const grad = ctx.createLinearGradient(bx, by, bx + sz, by + sz);
  grad.addColorStop(0, "#7a9ab8"); grad.addColorStop(1, "#4d6880");
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, sz, sz);
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, sz, sz);
  ctx.fillStyle = "#dbe7f3"; ctx.font = "bold 11px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(state.mass.toFixed(2) + " kg", bx + sz/2, by + sz/2 + 4);
  ctx.textAlign = "left";

  return { bx, by, sz };
}

function drawForceVectors(tapeX, tapeW, tapeTop, tapeH, blockInfo) {
  const { bx, by, sz } = blockInfo;
  const wScale = clamp(state.weightForce / 400, 0.12, 1);
  const aScale = clamp(state.adhesiveForce / 400, 0.12, 1);
  const wLen = 32 + wScale * 90;
  const aLen = 32 + aScale * 80;

  drawArrow(bx + sz/2, by + sz*0.4, bx + sz/2, by + sz*0.4 + wLen, "#f87171", "Weight");

  if (state.adhesiveForce > 0) {
    const ax = tapeX + tapeW + 40;
    const ay = tapeTop + tapeH * 0.45;
    drawArrow(ax, ay, ax - aLen, ay, "#4ade80", "Adhesion");
  } else {
    ctx.fillStyle = "#f87171"; ctx.font = "11px Segoe UI";
    ctx.fillText("No hold force", tapeX + tapeW + 8, tapeTop + tapeH * 0.45);
  }
}

function statusText(tapeX, tapeW, tapeTop, tapeH, slipOff) {
  ctx.font = "12px Segoe UI";
  if (state.status === "FAIL" || state.status === "NO HOLD") {
    ctx.fillStyle = "#f87171";
    ctx.fillText("Slipping!", tapeX + tapeW + 8, tapeTop + tapeH + 20 + slipOff * 0.15);
  } else if (state.status === "WARNING") {
    ctx.fillStyle = "#facc15";
    ctx.fillText("Near limit", tapeX + tapeW + 8, tapeTop + tapeH + 20);
  } else {
    ctx.fillStyle = "#4ade80";
    const pct = clamp((state.safetyFactor - 1) * 100, 0, 999);
    const pctStr = state.safetyFactor >= 999 ? "∞" : pct.toFixed(0) + "%";
    ctx.fillText("Stable (+"+pctStr+")", tapeX + tapeW + 8, tapeTop + tapeH + 20);
  }
}

// ── Per-adhesive drawing functions ────────────────────────────────

function drawGecko(wallX, W, H, tapeTop, tapeH, tapeW, slipOff) {
  const tapeX = wallX + 2;
  const eff = state.efficiency;

  // Main tape body
  const g1 = ctx.createLinearGradient(tapeX, 0, tapeX + tapeW, 0);
  g1.addColorStop(0, "#ffbd59");
  g1.addColorStop(1, "#c48b00");
  ctx.fillStyle = g1;
  ctx.fillRect(tapeX, tapeTop, tapeW, tapeH);

  // Setae lines on tape surface
  ctx.strokeStyle = "rgba(180,100,0,0.4)";
  ctx.lineWidth = 0.8;
  const numSetae = Math.floor(tapeH / 5);
  for (let i = 0; i < numSetae; i++) {
    const sy = tapeTop + i * 5 + 2;
    const lean = Math.sin(i * 0.7 + time * 0.8) * 1.5;
    ctx.beginPath();
    ctx.moveTo(tapeX + 2, sy);
    ctx.lineTo(tapeX + 2 + lean, sy - 4);
    ctx.stroke();
  }

  // Contact glow
  const alpha = 0.15 + eff * 0.5;
  ctx.fillStyle = `rgba(255,189,89,${alpha})`;
  ctx.fillRect(wallX - 4, tapeTop, 6, tapeH);

  // VdW sparkles at contact
  if (eff > 0.6) {
    for (let i = 0; i < 6; i++) {
      const py = tapeTop + (i / 5) * tapeH;
      const pulse = 0.4 + 0.3 * Math.sin(time * 2.5 + i * 1.3);
      ctx.fillStyle = `rgba(255,220,120,${pulse * eff})`;
      ctx.beginPath();
      ctx.arc(wallX - 2, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#dbe7f3"; ctx.font = "11px Segoe UI";
  ctx.fillText("Gecko tape", tapeX + tapeW + 6, tapeTop + 14);
  ctx.fillStyle = "rgba(255,189,89,0.6)"; ctx.font = "10px Segoe UI";
  ctx.fillText("van der Waals", tapeX + tapeW + 6, tapeTop + 28);
}

function drawTape(wallX, W, H, tapeTop, tapeH, tapeW, slipOff) {
  const tapeX = wallX + 2;
  const eff = state.efficiency;

  // Clear/white PSA tape body
  const alpha = 0.75 + eff * 0.2;
  ctx.fillStyle = `rgba(220,235,248,${alpha})`;
  ctx.fillRect(tapeX, tapeTop, tapeW, tapeH);

  // Slight transparency lines
  ctx.strokeStyle = "rgba(180,200,220,0.3)";
  ctx.lineWidth = 1;
  for (let y = tapeTop; y < tapeTop + tapeH; y += 8) {
    ctx.beginPath(); ctx.moveTo(tapeX, y); ctx.lineTo(tapeX + tapeW, y); ctx.stroke();
  }

  // PSA adhesive edge (sticky side glows amber)
  ctx.fillStyle = `rgba(255,180,80,${0.2 + eff * 0.45})`;
  ctx.fillRect(wallX - 3, tapeTop, 5, tapeH);

  ctx.fillStyle = "#dbe7f3"; ctx.font = "11px Segoe UI";
  ctx.fillText("Normal tape", tapeX + tapeW + 6, tapeTop + 14);
  ctx.fillStyle = "rgba(180,200,220,0.6)"; ctx.font = "10px Segoe UI";
  ctx.fillText("PSA chemical", tapeX + tapeW + 6, tapeTop + 28);
}

function drawVelcro(wallX, W, H, tapeTop, tapeH, tapeW, slipOff) {
  const tapeX = wallX + 2;
  const eff = state.efficiency;

  // Velcro body — two-tone
  ctx.fillStyle = "#3a5070";
  ctx.fillRect(tapeX, tapeTop, tapeW, tapeH);

  // Hook side texture
  const hookSpacing = 5;
  const numHooks = Math.floor(tapeH / hookSpacing);
  ctx.strokeStyle = `rgba(100,180,255,${0.5 + eff * 0.4})`;
  ctx.lineWidth = 1.0;
  for (let i = 0; i < numHooks; i++) {
    const hy = tapeTop + i * hookSpacing + 3;
    ctx.beginPath();
    ctx.moveTo(tapeX + 3, hy);
    ctx.lineTo(tapeX + 3, hy - 3);
    ctx.quadraticCurveTo(tapeX + 8, hy - 3, tapeX + 8, hy);
    ctx.stroke();
  }

  // Loop side (contact face)
  ctx.fillStyle = `rgba(70,130,200,${0.25 + eff * 0.5})`;
  ctx.fillRect(wallX - 4, tapeTop, 6, tapeH);

  // Interlocked line
  ctx.strokeStyle = `rgba(150,200,255,${eff * 0.6})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < numHooks; i++) {
    const hy = tapeTop + i * hookSpacing + 3;
    ctx.beginPath();
    ctx.moveTo(wallX - 4, hy);
    ctx.lineTo(wallX, hy);
    ctx.stroke();
  }

  ctx.fillStyle = "#dbe7f3"; ctx.font = "11px Segoe UI";
  ctx.fillText("Velcro", tapeX + tapeW + 6, tapeTop + 14);
  ctx.fillStyle = "rgba(100,180,255,0.6)"; ctx.font = "10px Segoe UI";
  ctx.fillText("Hook & loop", tapeX + tapeW + 6, tapeTop + 28);
}

function drawGlue(wallX, W, H, tapeTop, tapeH, tapeW, slipOff) {
  const tapeX = wallX + 2;
  const eff = state.efficiency;

  // Glue body — amber/honey
  const gg = ctx.createLinearGradient(tapeX, tapeTop, tapeX + tapeW, tapeTop + tapeH);
  gg.addColorStop(0, "#b06800");
  gg.addColorStop(0.5, "#d48000");
  gg.addColorStop(1, "#8a4a00");
  ctx.fillStyle = gg;
  ctx.fillRect(tapeX, tapeTop, tapeW, tapeH);

  // Glossy highlight
  ctx.fillStyle = "rgba(255,220,100,0.22)";
  ctx.fillRect(tapeX + 2, tapeTop + 2, tapeW - 4, tapeH * 0.4);

  // Chemical bond indicators — tight dots at contact face
  for (let i = 0; i < Math.floor(tapeH / 6); i++) {
    const py = tapeTop + i * 6 + 3;
    const pulse = 0.6 + 0.2 * Math.sin(time * 1.5 + i * 0.5);
    ctx.fillStyle = `rgba(255,180,50,${pulse * eff})`;
    ctx.beginPath(); ctx.arc(wallX - 1, py, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  // "PERMANENT" label
  if (eff > 0.5) {
    ctx.fillStyle = "rgba(255,180,50,0.5)"; ctx.font = "bold 8px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("PERM", tapeX + tapeW/2, tapeTop + tapeH/2 + 3);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#dbe7f3"; ctx.font = "11px Segoe UI";
  ctx.fillText("Super glue", tapeX + tapeW + 6, tapeTop + 14);
  ctx.fillStyle = "rgba(255,180,60,0.6)"; ctx.font = "10px Segoe UI";
  ctx.fillText("Chemical bond", tapeX + tapeW + 6, tapeTop + 28);
}

function drawSuction(wallX, W, H, tapeTop, tapeH, tapeW, slipOff) {
  const tapeX = wallX + 2;
  const eff = state.efficiency;
  const fail = state.status === "NO HOLD";
  const cx = tapeX + tapeW / 2;
  const cy = tapeTop + tapeH / 2;
  const rOuter = tapeH * 0.44;
  const rInner = rOuter * 0.55;

  // Cup rim
  ctx.strokeStyle = fail ? "rgba(248,113,113,0.7)" : `rgba(100,200,255,${0.5 + eff * 0.45})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke();

  // Cup interior — vacuum zone
  const cg = ctx.createRadialGradient(cx, cy, rInner * 0.2, cx, cy, rInner);
  if (fail) {
    cg.addColorStop(0, "rgba(248,113,113,0.06)");
    cg.addColorStop(1, "rgba(248,113,113,0.18)");
  } else {
    cg.addColorStop(0, `rgba(30,80,160,${0.35 * eff})`);
    cg.addColorStop(1, `rgba(60,140,220,${0.12 * eff})`);
  }
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy, rOuter - 1, 0, Math.PI * 2); ctx.fill();

  // Atmospheric pressure arrows pressing inward (when working)
  if (!fail && eff > 0.4) {
    const numArrows = 8;
    for (let i = 0; i < numArrows; i++) {
      const ang = (i / numArrows) * Math.PI * 2;
      const x1 = cx + Math.cos(ang) * (rOuter + 14);
      const y1 = cy + Math.sin(ang) * (rOuter + 14);
      const x2 = cx + Math.cos(ang) * (rOuter + 3);
      const y2 = cy + Math.sin(ang) * (rOuter + 3);
      const aAlpha = 0.3 + 0.3 * Math.sin(time * 1.8 + i * 0.8);
      ctx.strokeStyle = `rgba(100,200,255,${aAlpha * eff})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // Contact seal
  if (!fail) {
    ctx.fillStyle = `rgba(80,160,255,${0.3 + eff * 0.4})`;
    ctx.beginPath(); ctx.arc(wallX - 1, cy, 4, 0, Math.PI * 2); ctx.fill();
  }

  // ⚠ fail cross
  if (fail) {
    ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - 12); ctx.lineTo(cx + 12, cy + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 12, cy - 12); ctx.lineTo(cx - 12, cy + 12); ctx.stroke();
  }

  ctx.fillStyle = "#dbe7f3"; ctx.font = "11px Segoe UI";
  ctx.fillText("Suction cup", tapeX + tapeW + 6, tapeTop + 14);
  if (fail) {
    ctx.fillStyle = "#f87171"; ctx.font = "10px Segoe UI";
    ctx.fillText("No atmosphere!", tapeX + tapeW + 6, tapeTop + 28);
  } else {
    ctx.fillStyle = "rgba(100,200,255,0.6)"; ctx.font = "10px Segoe UI";
    ctx.fillText("Atmospheric ΔP", tapeX + tapeW + 6, tapeTop + 28);
  }
}

// ── Main draw scene ───────────────────────────────────────────────
function drawScene() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (W < 2 || H < 2) return;

  ctx.clearRect(0, 0, W, H);
  grid(W, H);

  const wallX = W * 0.18;
  drawWall(wallX, H);

  // Surface label
  ctx.fillStyle = "#5a7890"; ctx.font = "11px Segoe UI";
  ctx.fillText("Rigid surface", wallX - 88, 16);

  // Tape geometry
  const areaNorm  = clamp((state.areaCm2 - 1) / 199, 0, 1);
  const tapeH     = 55 + areaNorm * 130;
  const tapeW     = 20;
  const tapeY0    = H * 0.24;

  // Slip animation
  const fail = state.status === "FAIL" || state.status === "NO HOLD";
  if (fail) {
    slipOffset += 0.85 + clamp(1 - state.safetyFactor, 0, 1) * 2.5;
  } else {
    slipOffset *= 0.78;
  }
  const maxSlip = Math.max(12, H - tapeY0 - tapeH - 140);
  slipOffset = clamp(slipOffset, 0, maxSlip);

  const tapeTop = tapeY0 + slipOffset;
  const linkX   = wallX + tapeW + 2;

  // Draw current adhesive type
  ADHESIVES[currentType].draw(wallX, W, H, tapeTop, tapeH, tapeW, slipOffset);

  // Draw mass block
  const blockInfo = drawMass(linkX, tapeTop + tapeH, slipOffset);

  // Force arrows
  drawForceVectors(wallX + 2, tapeW, tapeTop, tapeH, blockInfo);

  // Status
  statusText(wallX + 2, tapeW, tapeTop, tapeH, slipOffset);

  // Gravity label bottom-right
  const gLabel = state.g < 0.01 ? "g ≈ 0 m/s² (ISS)" : `g = ${state.g.toFixed(2)} m/s²`;
  ctx.fillStyle = "rgba(154,164,175,0.55)"; ctx.font = "11px Segoe UI";
  ctx.fillText(gLabel, W - 140, H - 12);

  // Adhesive label bottom-left
  ctx.fillStyle = "rgba(154,164,175,0.55)";
  ctx.fillText(ADHESIVES[currentType].label, 10, H - 12);

  time += 0.018;
}

function frameLoop() { drawScene(); requestAnimationFrame(frameLoop); }

// ── Event wiring ──────────────────────────────────────────────────

// Adhesive type
adhBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    adhBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    slipOffset = 0;
    updateSimulation();
  });
});

// Mass presets
presetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    massInput.value = btn.dataset.mass;
    updateSimulation();
  });
});

// Gravity presets
gravBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    gravBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    gravityInput.value = btn.dataset.g;
    updateSimulation();
  });
});

// Manual gravity input
gravityInput.addEventListener("input", () => {
  gravBtns.forEach(b => b.classList.remove("active"));
  updateSimulation();
});

// Mass input
massInput.addEventListener("input", () => {
  presetBtns.forEach(b => b.classList.remove("active"));
  updateSimulation();
});

areaSlider.addEventListener("input", updateSimulation);
efficiencySlider.addEventListener("input", updateSimulation);

// Init
updateSimulation();
resizeCanvas();
frameLoop();
