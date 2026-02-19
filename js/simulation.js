// simulation.js (debug-friendly version)
// This is an ES module that imports Three as a module from CDN.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

console.log('%c[simulation.js] booting (debug build)', 'color:#ffbd59;font-weight:700');

//
// UI refs (same ids as simulation.html)
//
const threeArea = document.getElementById('threeArea');
const schematicCanvas = document.getElementById('schematicCanvas');
const massInput = document.getElementById('massInput');
const gravityPreset = document.getElementById('gravityPreset');
const gravityInput = document.getElementById('gravityInput');
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

if (!threeArea) console.error('[simulation.js] threeArea element not found!');
if (!schematicCanvas) console.warn('[simulation.js] schematicCanvas not found - schematic will not draw.');

// --- Simulation parameters (init)
let mass = parseFloat(massInput?.value || 8) || 8;
let g = 9.81;
let area_cm2 = parseFloat(areaInput?.value || 10) || 10;
let area_m2 = area_cm2 * 1e-4;
let sigma_kPa = parseFloat(sigmaInput?.value || 120) || 120;
let sigma_Pa = sigma_kPa * 1000;
let eta = parseFloat(etaInput?.value || 0.9) || 0.9;
let gap_mm = parseFloat(gapInput?.value || 1) || 1;

let animPlaying = false;
let playStart = 0;

// --- Schematic context
const schemCtx = schematicCanvas ? schematicCanvas.getContext('2d') : null;

// Debug overlay element to show WebGL/Three errors on screen
function ensureDebugOverlay() {
  let el = document.getElementById('three-debug-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'three-debug-overlay';
    Object.assign(el.style, {
      position: 'absolute',
      left: '16px',
      top: '16px',
      padding: '10px',
      borderRadius: '8px',
      background: 'rgba(10,10,10,0.6)',
      color: '#ffd79a',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: 'calc(50%)',
      fontSize: '12px'
    });
    el.innerHTML = '3D status: initializing...';
    threeArea.appendChild(el);
  }
  return el;
}
const debugOverlay = ensureDebugOverlay();

// Basic physics compute (same formula as before)
function computeForces() {
  const Fg = mass * g;
  const Fadh = sigma_Pa * area_m2 * eta;
  const SF = (Fg > 0) ? (Fadh / Fg) : Infinity;
  const pressure_Pa = (area_m2 > 0) ? (Fg / area_m2) : 0;
  return { Fg, Fadh, SF, pressure_Pa };
}

// ---------- 2D schematic draw (kept lightweight) ----------
function resizeSchematic() {
  if (!schematicCanvas) return;
  const rect = schematicCanvas.parentElement.getBoundingClientRect();
  schematicCanvas.width = Math.floor(rect.width * devicePixelRatio);
  schematicCanvas.height = Math.floor(rect.height * devicePixelRatio);
  schematicCanvas.style.width = rect.width + 'px';
  schematicCanvas.style.height = rect.height + 'px';
  schemCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  drawSchematic();
}

function drawSchematic() {
  if (!schemCtx) return;
  const W = schematicCanvas.clientWidth, H = schematicCanvas.clientHeight;
  schemCtx.clearRect(0,0,W,H);

  // simple placeholder drawing (keeps representation present)
  schemCtx.fillStyle = '#041018';
  schemCtx.fillRect(0,0,W,H);

  // boxes representing substrate and tape
  const pad = 20;
  const subW = 60, subH = Math.round(H*0.6);
  const subX = pad, subY = (H - subH)/2;
  schemCtx.fillStyle = '#0b1c20';
  schemCtx.fillRect(subX, subY, subW, subH);

  const filmW = 18, filmH = subH*0.6;
  const filmX = W - pad - filmW;
  const filmY = (H - filmH)/2;
  schemCtx.fillStyle = '#072b2d';
  schemCtx.fillRect(filmX, filmY, filmW, filmH);

  // contact patch & arrow text
  const { Fg, Fadh } = computeForces();
  schemCtx.fillStyle = '#dbe9f0';
  schemCtx.font = '12px monospace';
  schemCtx.fillText(`Fg ${Fg.toFixed(2)} N`, filmX - 60, filmY - 8);
  schemCtx.fillText(`Fadh ${Fadh.toFixed(2)} N`, subX + subW + 8, filmY - 8);
}

// ---------- Three.js initialization and robust creation ----------
let threeState = { renderer: null, scene: null, camera: null, tape: null, weight: null, rope: null };

function createThreeScene() {
  // Clear previous renderer if present
  try {
    if (threeState.renderer) {
      console.log('[simulation.js] disposing previous renderer');
      threeState.renderer.dispose?.();
      threeArea.innerHTML = '';
      threeState = { renderer: null, scene: null, camera: null, tape: null, weight: null, rope: null };
    }

    // quick WebGL availability check
    if (!THREE.WEBGL.isWebGLAvailable()) {
      const err = THREE.WEBGL.getWebGLErrorMessage();
      console.error('[simulation.js] WebGL not available:', err);
      debugOverlay.innerText = '3D status: WebGL not available — see console.';
      // show the built-in message HTML if present
      threeArea.appendChild(err);
      return;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(threeArea.clientWidth, threeArea.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.setClearColor(0x041018, 1);

    threeArea.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, threeArea.clientWidth/threeArea.clientHeight, 0.1, 200);
    camera.position.set(0, 3.8, 8.8);
    camera.lookAt(0,1.5,0);

    // lights
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(6, 10, 8);
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0x404040, 0.9));

    // wall (left)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x15232c, roughness: 0.92 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 6), wallMat);
    wall.position.set(-3.6, 1.0, 0);
    scene.add(wall);

    // tape (thin plate)
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x0b3a30, roughness: 0.6, metalness: 0.02 });
    const tape = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.6), tapeMat);
    tape.position.set(-1.6, 1.45, 0);
    scene.add(tape);

    // weight
    const weightMat = new THREE.MeshStandardMaterial({ color: 0x273a49, roughness: 0.5 });
    const weight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.2), weightMat);
    weight.position.set(0.4, -0.7, 0);
    scene.add(weight);

    // rope as thin cylinder
    const ropeMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness: 0.9 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), ropeMat);
    rope.position.set(-0.4, 0.4, 0);
    rope.rotation.z = 0;
    scene.add(rope);

    threeState = { renderer, scene, camera, tape, weight, rope };
    debugOverlay.innerText = '3D status: renderer initialized';

    // start render loop
    function loop() {
      requestAnimationFrame(loop);
      // small animation / look
      if (threeState.tape) {
        // no spin, smooth subtle bob
        threeState.tape.rotation.y += 0.0005;
      }
      // render
      try { threeState.renderer.render(threeState.scene, threeState.camera); } 
      catch (err) {
        console.error('[simulation.js] render error:', err);
        debugOverlay.innerText = '3D status: rendering error — see console';
      }
    }
    loop();

    // ensure resize handling
    window.addEventListener('resize', () => {
      if (!threeState.renderer) return;
      threeState.renderer.setSize(threeArea.clientWidth, threeArea.clientHeight);
      threeState.camera.aspect = threeArea.clientWidth / threeArea.clientHeight;
      threeState.camera.updateProjectionMatrix();
    });

    // small success log
    console.log('[simulation.js] Three initialized successfully');
  }
  catch (e) {
    console.error('[simulation.js] createThreeScene caught', e);
    debugOverlay.innerText = '3D status: init error — check console.';
  }
}

// call createThreeScene immediately and expose a recreate button if needed
createThreeScene();

// add a small "recreate 3D" button programmatically so we can reinit without reload
(function addRecreateButton(){
  const btn = document.createElement('button');
  btn.textContent = 'Recreate 3D';
  Object.assign(btn.style, {
    position:'absolute', right:'16px', bottom:'16px', zIndex:9999,
    padding:'8px 12px', borderRadius:'8px', background:'#0b2b2b', color:'#ffd79a', border:'1px solid rgba(255,255,255,0.04)'
  });
  btn.onclick = ()=> { console.log('[simulation.js] recreate 3D pressed'); debugOverlay.innerText = '3D status: recreating...'; createThreeScene(); };
  threeArea.appendChild(btn);
})();

// ---------- basic UI wiring kept minimal (so schematic keeps updating) ----------
presets.forEach(b => b.addEventListener('click', () => {
  massInput.value = b.dataset.mass; mass = parseFloat(massInput.value); updateAll();
}));
massInput?.addEventListener('input', ()=> { mass = parseFloat(massInput.value) || 0; updateAll(); });
gravityPreset?.addEventListener('change', ()=> {
  if (gravityPreset.value === 'custom') { document.getElementById('customGravityRow').style.display = 'block'; g = parseFloat(gravityInput.value)||9.81; }
  else { document.getElementById('customGravityRow').style.display = 'none'; g = parseFloat(gravityPreset.value); }
  updateAll();
});
gravityInput?.addEventListener('input', ()=> { g = parseFloat(gravityInput.value) || g; updateAll(); });
areaInput?.addEventListener('input', ()=> { area_cm2 = parseFloat(areaInput.value) || 0; area_m2 = area_cm2 * 1e-4; updateAll(); });
sigmaInput?.addEventListener('input', ()=> { sigma_kPa = parseFloat(sigmaInput.value)||0; sigma_Pa = sigma_kPa*1000; updateAll(); });
etaInput?.addEventListener('input', ()=> { eta = parseFloat(etaInput.value)||0.9; etaLabel.textContent = eta.toFixed(2); updateAll(); });
gapInput?.addEventListener('input', ()=> { gap_mm = parseFloat(gapInput.value)||0; updateAll(); });
playBtn?.addEventListener('click', ()=> {
  if (!animPlaying) { animPlaying = true; playBtn.textContent = 'Stop'; playStart = performance.now(); animatePress(); }
  else { animPlaying = false; playBtn.textContent = 'Play Press'; }
});
snapBtn?.addEventListener('click', ()=> { gapInput.value = '0'; gap_mm=0; updateAll(); });

function animatePress() {
  if (!animPlaying) return;
  const now = performance.now();
  const elapsed = (now - playStart)/1000;
  const cycle = (elapsed % 3)/3;
  const t = Math.sin(cycle * Math.PI);
  gapInput.value = (1 - t).toFixed(3);
  gap_mm = parseFloat(gapInput.value);
  updateAll();
  requestAnimationFrame(animatePress);
}

// ---------- update function to refresh UI values and visuals ----------
function updateAll() {
  mass = parseFloat(massInput?.value || mass) || 0;
  if (gravityPreset && gravityPreset.value === 'custom') g = parseFloat(gravityInput?.value) || g;
  else if (gravityPreset) g = parseFloat(gravityPreset.value);
  area_cm2 = parseFloat(areaInput?.value || area_cm2) || 0; area_m2 = area_cm2 * 1e-4;
  sigma_kPa = parseFloat(sigmaInput?.value || sigma_kPa) || 0; sigma_Pa = sigma_kPa * 1000;
  eta = parseFloat(etaInput?.value || eta) || 0.9;
  gap_mm = parseFloat(gapInput?.value || gap_mm) || 0;

  const { Fg, Fadh, SF, pressure_Pa } = computeForces();
  FadhEl.innerText = Fadh.toFixed(2);
  FgEl.innerText = Fg.toFixed(2);
  PEl.innerText = (pressure_Pa/1000).toFixed(2);
  SFEl.innerText = isFinite(SF) ? SF.toFixed(2) : '—';

  let status = 'HOLD', color = '#38c172';
  if (!isFinite(SF)) { status = '—'; color = '#9aa6b1'; }
  else if (SF < 1) { status = 'FAIL'; color = '#ff6b6b'; }
  else if (SF < 1.2) { status = 'WARNING'; color = '#f6c85f'; }
  statusEl.innerText = status; statusEl.style.color = color; statusBadge.innerText = status;

  // update 3D tape color (if present)
  if (threeState && threeState.tape && threeState.tape.material) {
    const hex = (SF > 1.2) ? 0x2bb673 : (SF > 1.0 ? 0xf6c85f : 0xff6b6b);
    threeState.tape.material.color.setHex(hex);
  }

  // update schematic
  try { resizeSchematic(); } catch(e){ console.warn('[simulation.js] schematic draw failed', e); }

  // update debug overlay
  debugOverlay.innerText = `3D status: ${threeState.renderer ? 'running' : 'no renderer'} — SF:${isFinite(SF)?SF.toFixed(2):'—'}`;
}

window.addEventListener('resize', ()=> { 
  // ensure three canvas resized if exists
  if (threeState && threeState.renderer) {
    threeState.renderer.setSize(threeArea.clientWidth, threeArea.clientHeight);
    if (threeState.camera) { threeState.camera.aspect = threeArea.clientWidth/threeArea.clientHeight; threeState.camera.updateProjectionMatrix(); }
  }
  resizeSchematic();
});

setTimeout(()=>{ updateAll(); }, 200);

// expose small debug help in console
console.log('%c[simulation.js] debug tips: If 3D is blank -> open DevTools Console and paste "document.getElementById(\'threeArea\').innerHTML" to inspect the DOM. Also look for network errors for three.module.js', 'color:#9aa6b1');

