// simulation.js
// Requires: three.module.js via CDN (import below). This file is an ES module.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* -------------------------------
   UI element references
   ------------------------------- */
const massInput = document.getElementById('massInput');
const gravityPreset = document.getElementById('gravityPreset');
const gravityInput = document.getElementById('gravityInput');
const customGravityRow = document.getElementById('customGravityRow');

const areaInput = document.getElementById('areaInput');
const sigmaInput = document.getElementById('sigmaInput');
const etaInput = document.getElementById('etaInput');
const etaLabel = document.getElementById('etaLabel');

const gapInput = document.getElementById('gapInput');
const playBtn = document.getElementById('playBtn');
const snapBtn = document.getElementById('snapBtn');
const showNumbers = document.getElementById('showNumbers');

const FadhEl = document.getElementById('Fadh');
const FgEl = document.getElementById('Fg');
const PEl = document.getElementById('P');
const SFEl = document.getElementById('SF');
const statusEl = document.getElementById('status');
const statusBadge = document.getElementById('statusBadge');

const presets = document.querySelectorAll('#presets [data-mass]');
const collapseControls = document.getElementById('collapseControls');
const controlsPanel = document.getElementById('controlsPanel');

const threeArea = document.getElementById('threeArea');
const schematicCanvas = document.getElementById('schematicCanvas');

/* -------------------------------
   Default parameters (physical)
   ------------------------------- */
let mass = parseFloat(massInput.value) || 8.0;             // kg
let g = 9.81;                                             // m/s^2
let area_cm2 = parseFloat(areaInput.value) || 10;         // cm^2
let area_m2 = area_cm2 * 1e-4;                            // m^2
let sigma_kPa = parseFloat(sigmaInput.value) || 120;      // kPa
let sigma_Pa = sigma_kPa * 1000;                          // Pa
let eta = parseFloat(etaInput.value) || 0.9;              // efficiency
let gap_mm = parseFloat(gapInput.value) || 1.0;           // mm

let animPlaying = false;
let playStart = 0;

/* -------------------------------
   Wire basic UI
   ------------------------------- */
presets.forEach(b => {
  b.addEventListener('click', () => {
    massInput.value = b.dataset.mass;
    mass = parseFloat(massInput.value);
    updateAll();
  });
});

massInput.addEventListener('input', () => { mass = parseFloat(massInput.value) || 0; updateAll(); });

gravityPreset.addEventListener('change', () => {
  if (gravityPreset.value === 'custom') {
    customGravityRow.style.display = 'block';
    g = parseFloat(gravityInput.value) || 0;
  } else {
    customGravityRow.style.display = 'none';
    g = parseFloat(gravityPreset.value);
  }
  updateAll();
});
gravityInput.addEventListener('input', () => { g = parseFloat(gravityInput.value) || 0; updateAll(); });

areaInput.addEventListener('input', ()=> { area_cm2 = parseFloat(areaInput.value) || 0; area_m2 = area_cm2 * 1e-4; updateAll(); });
sigmaInput.addEventListener('input', ()=> { sigma_kPa = parseFloat(sigmaInput.value) || 0; sigma_Pa = sigma_kPa * 1000; updateAll(); });
etaInput.addEventListener('input', ()=> { eta = parseFloat(etaInput.value); etaLabel.textContent = eta.toFixed(2); updateAll(); });

gapInput.addEventListener('input', ()=> { gap_mm = parseFloat(gapInput.value); updateAll(); });

playBtn.addEventListener('click', () => {
  if (!animPlaying) { animPlaying = true; playBtn.textContent = 'Stop'; playStart = performance.now(); animatePress(); }
  else { animPlaying = false; playBtn.textContent = 'Play Press'; }
});
snapBtn.addEventListener('click', ()=> { gapInput.value = "0"; gap_mm = 0; updateAll(); });

showNumbers.addEventListener('change', ()=> drawSchematic());

collapseControls.addEventListener('click', () => {
  if (controlsPanel.style.display === 'none') { controlsPanel.style.display = 'block'; collapseControls.textContent = 'Collapse Controls'; }
  else { controlsPanel.style.display = 'none'; collapseControls.textContent = 'Show Controls'; }
  setTimeout(()=> { onResize(); }, 60);
});

/* -------------------------------
   Physics helper functions
   ------------------------------- */
function computeForces() {
  // Forces
  const Fg = mass * g;                         // weight N
  const Fadh = sigma_Pa * area_m2 * eta;      // adhesive potential N
  const SF = (Fg > 0) ? (Fadh / Fg) : Infinity;
  const pressure_Pa = (area_m2 > 0) ? (Fg / area_m2) : 0; // Pa
  return { Fg, Fadh, SF, pressure_Pa };
}

/* -------------------------------
   2D schematic: show side-angle contact
   ------------------------------- */
const schemCtx = schematicCanvas.getContext('2d');

function resizeSchematic() {
  const rect = schematicCanvas.parentElement.getBoundingClientRect();
  schematicCanvas.width = Math.floor(rect.width * devicePixelRatio);
  schematicCanvas.height = Math.floor(rect.height * devicePixelRatio);
  schematicCanvas.style.width = rect.width + 'px';
  schematicCanvas.style.height = rect.height + 'px';
  schemCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  drawSchematic();
}

function drawSchematic() {
  // Clear
  const W = schematicCanvas.clientWidth;
  const H = schematicCanvas.clientHeight;
  schemCtx.clearRect(0,0,W,H);

  // background subtle grid
  schemCtx.fillStyle = 'rgba(0,0,0,0)';
  schemCtx.fillRect(0,0,W,H);

  // draw substrate block (left) and gecko tape film (right) from side
  const pad = 24;
  const subW = 70, subH = Math.round(H*0.64);
  const filmW = 18, filmH = Math.round(H*0.42);
  const subX = pad;
  const subY = Math.round((H - subH)/2);

  const filmX = W - pad - filmW;
  const filmY = Math.round((H - filmH)/2);

  // gap in px mapping from gap_mm (0..1mm)
  const maxSeparationPx = Math.max(10, (W*0.18));
  const gapPx = Math.round(maxSeparationPx * (gap_mm / 1.0)); // 0..maxSeparation

  // draw substrate
  schemCtx.fillStyle = '#0f1720';
  schemCtx.fillRect(subX, subY, subW, subH);
  schemCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  schemCtx.strokeRect(subX, subY, subW, subH);

  // draw film (shifted right by gapPx)
  const filmShiftX = filmX + gapPx;
  schemCtx.fillStyle = '#0b2a2a';
  schemCtx.fillRect(filmShiftX, filmY, filmW, filmH);
  schemCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  schemCtx.strokeRect(filmShiftX, filmY, filmW, filmH);

  // contact patch rectangle — mapped vertically centered on film lower half
  const patchW_px = Math.max(40, Math.min(W*0.4, 120)); // width along substrate surface
  const patchH_px = 18;
  const patchX = subX + subW + 18;
  const patchY = filmY + filmH - patchH_px - 12;

  // if gap small enough (we choose threshold), contact forms.
  const contactThresholdPx = 4;
  const contactFormed = gapPx <= contactThresholdPx;

  // draw patch on substrate (visual region where film meets substrate)
  schemCtx.save();
  schemCtx.fillStyle = '#07151a';
  schemCtx.fillRect(patchX, patchY, patchW_px, patchH_px);
  schemCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  schemCtx.strokeRect(patchX, patchY, patchW_px, patchH_px);
  schemCtx.restore();

  // if contact formed -> show heatmap overlay along patch dependent on pressure
  const { Fg, Fadh, SF, pressure_Pa } = computeForces();
  const pressure_kPa = pressure_Pa / 1000;
  // normalize pressure to [0,1] for color mapping; choose a reference max (200 kPa)
  const refMax_kPa = 200;
  let norm = Math.min(1, pressure_kPa / refMax_kPa);

  // color map: green -> yellow -> red
  function colorForNorm(n) {
    const r = n < 0.5 ? Math.round(2*n*255) : 255;
    const g = n < 0.5 ? 255 : Math.round(255 - (2*(n-0.5)*255));
    const b = 60;
    return `rgba(${r},${g},${b},${0.9*Math.min(1,0.3 + n*0.9)})`;
  }

  if (contactFormed) {
    // draw per-segment gradient to simulate heatmap
    const steps = 24;
    for (let i=0;i<steps;i++){
      const segX = patchX + (i*(patchW_px/steps));
      const segW = Math.ceil(patchW_px/steps);
      // small randomization to look organic
      const segNorm = Math.max(0, Math.min(1, norm * (0.7 + 0.6*Math.sin(i*0.7))));
      schemCtx.fillStyle = colorForNorm(segNorm);
      schemCtx.fillRect(segX, patchY, segW, patchH_px);
    }
  } else {
    // show faint overlay indicating no contact
    schemCtx.fillStyle = 'rgba(255,255,255,0.02)';
    schemCtx.fillRect(patchX, patchY, patchW_px, patchH_px);
  }

  // draw arrow for applied weight at center of film downwards
  const arrowCX = filmShiftX + filmW/2;
  const arrowTop = filmY - 6;
  const arrowBottom = filmY + filmH + 10;
  drawArrow(schemCtx, arrowCX, arrowTop, arrowCX, arrowBottom, '#ff6b6b', 2);
  schemCtx.fillStyle = '#ff6b6b';
  schemCtx.font = '12px monospace';
  schemCtx.fillText(`Fg: ${Fg.toFixed(2)} N`, arrowCX + 8, arrowBottom - 6);

  // draw normal reaction arrow at patch (upwards)
  const reactionX = patchX + patchW_px/2;
  const reactionYTop = patchY + patchH_px + 18;
  const reactionYBottom = patchY + patchH_px;
  drawArrow(schemCtx, reactionX, reactionYTop, reactionX, reactionYBottom, '#38c172', 2);
  schemCtx.fillStyle = '#38c172';
  schemCtx.fillText(`N (reaction)`, reactionX + 8, reactionYBottom + 16);

  // draw pressure text optionally
  schemCtx.fillStyle = showNumbers.checked ? '#e8f4f8' : 'rgba(255,255,255,0.02)';
  schemCtx.font = '12px monospace';
  schemCtx.fillText(`Pressure: ${ (pressure_kPa).toFixed(2) } kPa`, patchX, patchY - 8);
  schemCtx.fillText(`Adhesion (Fadh): ${Fadh.toFixed(2)} N`, patchX, patchY - 24);
  schemCtx.fillText(`SF: ${isFinite(SF) ? SF.toFixed(2) : '—'}`, patchX + patchW_px - 70, patchY - 8);

  // small legend colorbar
  const legendW = 160, legendH = 10;
  const legendX = W - legendW - 14, legendY = 12;
  // gradient
  const grad = schemCtx.createLinearGradient(legendX,0,legendX+legendW,0);
  grad.addColorStop(0, 'rgba(56,193,114,0.95)');
  grad.addColorStop(0.5, 'rgba(246,200,95,0.95)');
  grad.addColorStop(1, 'rgba(255,107,107,0.95)');
  schemCtx.fillStyle = grad;
  schemCtx.fillRect(legendX, legendY, legendW, legendH);
  schemCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  schemCtx.strokeRect(legendX, legendY, legendW, legendH);
  schemCtx.fillStyle = '#9aa6b1'; schemCtx.font = '11px system-ui, monospace';
  schemCtx.fillText('0 kPa', legendX - 2, legendY + legendH + 12);
  schemCtx.fillText(`${refMax_kPa} kPa`, legendX + legendW - 28, legendY + legendH + 12);

  // helper: if film still separated, draw dashed connection to patch
  if (!contactFormed) {
    schemCtx.strokeStyle = 'rgba(255,255,255,0.03)';
    schemCtx.setLineDash([6,6]);
    schemCtx.beginPath();
    schemCtx.moveTo(filmShiftX + filmW/2, filmY + filmH - 6);
    schemCtx.lineTo(patchX + patchW_px/2, patchY - 6);
    schemCtx.stroke();
    schemCtx.setLineDash([]);
  }
}

function drawArrow(ctx, x1,y1,x2,y2, color='#fff', width=3){
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  const ang = Math.atan2(y2-y1, x2-x1);
  const h = 8;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - h*Math.cos(ang - 0.35), y2 - h*Math.sin(ang - 0.35));
  ctx.lineTo(x2 - h*Math.cos(ang + 0.35), y2 - h*Math.sin(ang + 0.35));
  ctx.closePath(); ctx.fill();
}

/* -------------------------------
   3D scene: lightweight rectangle (wall), tape as plane, weight as box
   ------------------------------- */
let threeState = { renderer:null, scene:null, camera:null, cube:null, tape:null, rope:null };
function initThree() {
  // renderer
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(threeArea.clientWidth, threeArea.clientHeight);
  renderer.setClearColor(0x041018, 1);
  threeArea.innerHTML = ''; // clear
  threeArea.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, threeArea.clientWidth/threeArea.clientHeight, 0.1, 200);
  camera.position.set(0, 4, 9);
  camera.lookAt(0, 1.5, 0);

  // lights
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(6, 10, 8);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0x404040, 0.8));

  // wall (left)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x15232c, roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 6), wallMat);
  wall.position.set(-3.6, 1.0, 0);
  scene.add(wall);

  // tape (thin box)
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x0b3a30, roughness: 0.6, metalness:0.05 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.6), tapeMat);
  tape.position.set(-1.6, 1.45, 0);
  scene.add(tape);

  // weight box (connected by rope)
  const weightMat = new THREE.MeshStandardMaterial({ color: 0x273a49, roughness: 0.5 });
  const weight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), weightMat);
  weight.position.set(0.4, -0.7, 0);
  scene.add(weight);

  // rope: slender cylinder from tape underside to top of weight
  const ropeMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness: 0.9 });
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), ropeMat);
  rope.position.set(-0.4, 0.4, 0);
  rope.rotation.z = 0;
  scene.add(rope);

  // store state
  threeState = { renderer, scene, camera, tape, weight, rope };
}

/* Update 3D objects based on values */
function updateThreeVisuals() {
  if (!threeState.renderer) return;
  const { Fg, Fadh, SF } = computeForces();

  // tape color: green->yellow->red per SF
  const color = SF > 1.2 ? 0x2bb673 : (SF > 1.0 ? 0xf6c85f : 0xff6b6b);
  threeState.tape.material.color.setHex(color);

  // weight vertical offset: if failing, lower slowly
  const fail = SF < 1.0;
  if (fail) {
    threeState.weight.position.y = Math.max(-2.2, threeState.weight.position.y - 0.02);
  } else {
    threeState.weight.position.y += ( -0.7 - threeState.weight.position.y) * 0.08;
  }

  // rope length adjust per weight position to keep connection
  const ropeTargetLength = Math.max(0.8, (threeState.tape.position.y - threeState.weight.position.y));
  threeState.rope.scale.y = ropeTargetLength/2.0;
  threeState.rope.position.y = (threeState.tape.position.y + threeState.weight.position.y)/2.0;
  threeState.rope.position.x = (threeState.tape.position.x + threeState.weight.position.x)/2.0;
}

/*  Window resize handler for both canvases */
function onResize() {
  // schematic
  resizeSchematic();

  // three
  if (threeState.renderer) {
    threeState.renderer.setSize(threeArea.clientWidth, threeArea.clientHeight);
    threeState.camera.aspect = threeArea.clientWidth / threeArea.clientHeight;
    threeState.camera.updateProjectionMatrix();
  }
}

/* -------------------------------
   Animation: press action
   ------------------------------- */
function animatePress() {
  if (!animPlaying) return;
  const now = performance.now();
  const elapsed = (now - playStart) / 1000; // seconds
  // press cycle: 0..1..0 (close then release) in 3 seconds
  const cycle = (elapsed % 3) / 3; // 0..1
  // use ease in-out
  const t = Math.sin(cycle * Math.PI);
  gapInput.value = (1 - t).toFixed(3); // gap from 1 to 0 to 1
  gap_mm = parseFloat(gapInput.value);
  updateAll();

  requestAnimationFrame(animatePress);
}

/* -------------------------------
   Render loop (three)
   ------------------------------- */
function renderLoop() {
  requestAnimationFrame(renderLoop);
  if (threeState.renderer) {
    updateThreeVisuals();
    threeState.renderer.render(threeState.scene, threeState.camera);
  }
}

/* -------------------------------
   Master update that syncs everything
   ------------------------------- */
function updateAll() {
  // sync values
  mass = parseFloat(massInput.value) || 0;
  if (gravityPreset.value === 'custom') g = parseFloat(gravityInput.value) || 0;
  else g = parseFloat(gravityPreset.value);
  area_cm2 = parseFloat(areaInput.value) || 0; area_m2 = area_cm2 * 1e-4;
  sigma_kPa = parseFloat(sigmaInput.value) || 0; sigma_Pa = sigma_kPa * 1000;
  eta = parseFloat(etaInput.value) || 0.0;
  gap_mm = parseFloat(gapInput.value) || 0.0;

  const { Fg, Fadh, SF, pressure_Pa } = computeForces();
  const pressure_kPa = pressure_Pa / 1000;

  // update UI readouts
  FadhEl.textContent = Fadh.toFixed(2);
  FgEl.textContent = Fg.toFixed(2);
  PEl.textContent = pressure_kPa.toFixed(2);
  SFEl.textContent = isFinite(SF) ? SF.toFixed(2) : '—';

  let status = 'HOLD', sColor = '#38c172';
  if (!isFinite(SF)) { status = '—'; sColor = '#9aa6b1'; }
  else if (SF < 1.0) { status = 'FAIL'; sColor = '#ff6b6b'; }
  else if (SF < 1.2) { status = 'WARNING'; sColor = '#f6c85f'; }
  statusEl.textContent = status; statusEl.style.color = sColor;
  statusBadge.textContent = `${status}`;

  // repaint schematic and (if present) 3D visuals
  drawSchematic();
  updateThreeVisuals();
}

/* -------------------------------
   Initialization
   ------------------------------- */
function init() {
  // prepare three
  initThree();
  renderLoop();

  // prepare schematic canvas resize and initial draw
  window.addEventListener('resize', onResize);
  setTimeout(onResize, 60); // small delay to ensure layout done

  // small default update
  updateAll();
}

init();
