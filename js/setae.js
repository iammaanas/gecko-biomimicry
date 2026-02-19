// js/setae.js
// Rebuilt: hierarchical, semi-realistic morphing (toe -> lamellae -> aligned setae -> focused spatulae -> molecules)
// Works with Three.js r149 (non-module) and global OrbitControls; conservative counts for performance.

window.addEventListener("load", () => {
  try {
    if (typeof THREE === "undefined") {
      alert("Three.js not loaded. Check CDN.");
      return;
    }

    const container = document.getElementById("three-container");
    if (!container) { alert("#three-container missing"); return; }

    // remove previous canvas
    const old = container.querySelector("canvas");
    if (old) old.remove();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.id = "three-canvas";
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100vw";
    renderer.domElement.style.height = "100vh";
    renderer.domElement.style.zIndex = "1";
    container.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f14);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    const START_Z = 140, MID_Z = 56, CLOSE_Z = 8;
    camera.position.set(0, 28, START_Z);

    // Controls (manual only)
    let controls = null;
    if (typeof OrbitControls !== "undefined") {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.rotateSpeed = 0.5;
    }

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xffd89a, 1.1);
    key.position.set(30, 60, 30);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.12);
    fill.position.set(-30, 10, -40);
    scene.add(fill);

    // Substrate (wall)
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ color: 0x0d1214, roughness: 0.95 })
    );
    wall.rotation.x = -Math.PI / 2;
    wall.position.y = -2;
    scene.add(wall);

    // ---------------------------
    // TOE (stylized semi-realistic)
    // ---------------------------
    const toeGroup = new THREE.Group();
    const leath = new THREE.MeshStandardMaterial({ color: 0x231b18, roughness: 0.6, metalness: 0.03 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x162028, roughness: 0.86 });

    const sBig = new THREE.SphereGeometry(8, 28, 20);
    const sMed = new THREE.SphereGeometry(6.5, 26, 18);

    const A = new THREE.Mesh(sBig, leath); A.position.set(-10, 6.2, 0); A.scale.set(0.42, 0.24, 0.8); toeGroup.add(A);
    const B = new THREE.Mesh(sBig, leath); B.position.set(0, 5.9, 0); B.scale.set(0.54, 0.28, 1.02); toeGroup.add(B);
    const C = new THREE.Mesh(sMed, leath); C.position.set(11, 6.2, 0); C.scale.set(0.32, 0.22, 0.7); toeGroup.add(C);

    const pad = new THREE.Mesh(new THREE.CircleGeometry(32, 48), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.72, 0);
    toeGroup.add(pad);

    const gloss = new THREE.Mesh(
      new THREE.CircleGeometry(18, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.28, metalness: 0.02, transparent: true, opacity: 0.12 })
    );
    gloss.rotation.x = -Math.PI / 2;
    gloss.position.set(-2, 6.5, -2.2);
    toeGroup.add(gloss);

    toeGroup.position.set(0, 10, 0);
    scene.add(toeGroup);

    // ---------------------------
    // Lamellae (parallel ridges)
    // ---------------------------
    const LAMELLA_COUNT = 6;
    const LAMELLA_LENGTH = 70;
    const LAMELLA_WIDTH = 8;
    const lamellaeGroup = new THREE.Group();
    const lamMat = new THREE.MeshStandardMaterial({ color: 0x142128, roughness: 0.9, metalness: 0.01 });

    for (let i = 0; i < LAMELLA_COUNT; i++) {
      // use thin rounded box for ridge
      const g = new THREE.BoxGeometry(LAMELLA_LENGTH, 1.6, LAMELLA_WIDTH, 8, 1, 1);
      // gentle arc on geometry vertices
      for (let vi = 0; vi < g.attributes.position.count; vi++) {
        const x = g.attributes.position.getX(vi);
        const z = g.attributes.position.getZ(vi);
        // slight curvature
        const curve = Math.cos((x / LAMELLA_LENGTH) * Math.PI) * 0.4;
        g.attributes.position.setY(vi, g.attributes.position.getY(vi) + curve);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, lamMat);
      const offset = (i - Math.floor(LAMELLA_COUNT / 2)) * (LAMELLA_WIDTH + 1.0);
      mesh.position.set(0, 1.25, offset);
      mesh.rotation.x = -Math.PI / 2; // lying flat initially; we'll rotate to match pad
      lamellaeGroup.add(mesh);
    }
    lamellaeGroup.position.set(0, 0.6, 0);
    scene.add(lamellaeGroup);

    // ---------------------------
    // Setae (instanced, aligned brush)
    // ---------------------------
    const SETAE_PER_LAMELLA_X = 12; // along length
    const SETAE_PER_LAMELLA_Z = 6;  // across width
    const SETAE_COUNT = LAMELLA_COUNT * SETAE_PER_LAMELLA_X * SETAE_PER_LAMELLA_Z; // conservative
    const setaeGeom = new THREE.CylinderGeometry(0.038, 0.11, 1.0, 8, 1, true);
    const setaeMat = new THREE.MeshStandardMaterial({
      color: 0xffbd59,
      emissive: 0xffcfa0,
      emissiveIntensity: 0.02,
      roughness: 0.7,
      transparent: true,
      opacity: 0.0
    });
    const setaeInst = new THREE.InstancedMesh(setaeGeom, setaeMat, SETAE_COUNT);
    setaeInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(setaeInst);

    // Build ordered setae array (aligned)
    const setaeInfo = []; // {x,y,z,length,lean,twist}
    const baseXStart = -LAMELLA_LENGTH / 2 + 4;
    for (let li = 0; li < LAMELLA_COUNT; li++) {
      const lamZcenter = (li - (LAMELLA_COUNT - 1) / 2) * (LAMELLA_WIDTH + 1.0);
      for (let xi = 0; xi < SETAE_PER_LAMELLA_X; xi++) {
        const localX = baseXStart + (xi / (SETAE_PER_LAMELLA_X - 1)) * (LAMELLA_LENGTH - 8);
        for (let zi = 0; zi < SETAE_PER_LAMELLA_Z; zi++) {
          // distribute across lamella width with small jitter
          const localZ = lamZcenter + (zi / (SETAE_PER_LAMELLA_Z - 1) - 0.5) * (LAMELLA_WIDTH - 1.6) + (Math.random() - 0.5) * 0.4;
          const baseY = 1.15 + (Math.random() - 0.5) * 0.12;
          const length = 5.5 + Math.random() * 8.4;
          // aligned lean toward +Z direction slight angle
          const lean = 0.22 + (Math.random() - 0.5) * 0.05; // uniform-ish
          const twist = (Math.random() - 0.5) * 0.14;
          setaeInfo.push({ x: localX, z: localZ, y: baseY, length, lean, twist });
        }
      }
    }
    // populate instanced mesh initial (collapsed)
    const tmp = new THREE.Object3D();
    for (let i = 0; i < setaeInfo.length; i++) {
      const s = setaeInfo[i];
      tmp.position.set(s.x, s.y, s.z);
      tmp.rotation.set(-s.lean, s.twist, 0);
      tmp.scale.set(1, 0.02, 1); // collapsed
      tmp.updateMatrix();
      setaeInst.setMatrixAt(i, tmp.matrix);
    }
    setaeInst.instanceMatrix.needsUpdate = true;

    // ---------------------------
    // Focused Seta Detail (one seta, splits to spatulae)
    // ---------------------------
    // choose center-most seta as focus
    const focusIndex = Math.floor(setaeInfo.length / 2);
    const DETAIL_SPAT_COUNT = 18; // number of spatulae for detail
    const detailGroup = new THREE.Group(); // holds detailed shaft + spatulae
    const detailShaftMat = new THREE.MeshStandardMaterial({ color: 0xffbd59, emissive: 0xffbd59, emissiveIntensity: 0.08, roughness: 0.5, transparent: true, opacity: 0.0 });
    const detailTipMat = new THREE.MeshStandardMaterial({ color: 0xffd6a8, emissive: 0xffd6a8, emissiveIntensity: 0.12, roughness: 0.32, transparent: true, opacity: 0.0 });

    const shaftGeom = new THREE.CylinderGeometry(0.08, 0.14, 18, 12, 1, true);
    const shaftMesh = new THREE.Mesh(shaftGeom, detailShaftMat);
    shaftMesh.visible = false;
    detailGroup.add(shaftMesh);

    // spatulae planes (fan)
    const spatulaGeom = new THREE.PlaneGeometry(0.5, 0.22);
    const spatulaMeshes = [];
    for (let i = 0; i < DETAIL_SPAT_COUNT; i++) {
      const m = new THREE.Mesh(spatulaGeom, detailTipMat);
      m.visible = false;
      m.material.side = THREE.DoubleSide;
      detailGroup.add(m);
      spatulaMeshes.push(m);
    }
    scene.add(detailGroup);

    // ---------------------------
    // Molecules (instanced)
    // ---------------------------
    const MOLE_COUNT = 72;
    const molGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const molMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.18, transparent: true, opacity: 0.0 });
    const molInst = new THREE.InstancedMesh(molGeom, molMat, MOLE_COUNT);
    molInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(molInst);
    const molPositions = [];
    const md = new THREE.Object3D();
    for (let i = 0; i < MOLE_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 34;
      const rz = (Math.random() - 0.5) * 34;
      const ry = 14 + Math.random() * 7;
      md.position.set(rx, ry, rz);
      const s = 0.6 + Math.random() * 1.2;
      md.scale.set(s, s, s);
      md.updateMatrix();
      molInst.setMatrixAt(i, md.matrix);
      molPositions.push(new THREE.Vector3(rx, ry, rz));
    }
    molInst.instanceMatrix.needsUpdate = true;

    // ---------------------------
    // Force lines (subtle)
    // ---------------------------
    const LINKS = 40;
    const posBuf = new Float32Array(LINKS * 2 * 3);
    const colBuf = new Float32Array(LINKS * 2 * 3);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.BufferAttribute(posBuf, 3));
    lgeo.setAttribute("color", new THREE.BufferAttribute(colBuf, 3));
    const lmat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
    const forceLines = new THREE.LineSegments(lgeo, lmat);
    forceLines.visible = false;
    scene.add(forceLines);

    const linkIndices = [];
    for (let i = 0; i < LINKS; i++) linkIndices.push(Math.floor(i * (setaeInfo.length / LINKS)));

    // ---------------------------
    // UI references
    // ---------------------------
    const label = document.getElementById("zoomLabel");
    const stageText = document.getElementById("stageText");
    const stageBullet = document.getElementById("stageBullet");

    function updateStageText(stage) {
      if (stage === 0) {
        label.textContent = "Gecko toe on surface";
        stageText.textContent = "Macro view";
        stageBullet.textContent = "Semi-realistic toe resting on a surface.";
      } else if (stage === 1) {
        label.textContent = "Lamellae & texture";
        stageText.textContent = "Micro view";
        stageBullet.textContent = "Lamellae ridges appear; setae prepare to grow.";
      } else if (stage === 2) {
        label.textContent = "Aligned setae field";
        stageText.textContent = "Microscale setae";
        stageBullet.textContent = "Dense aligned setae grow from lamellae (ordered brush).";
      } else if (stage === 3) {
        label.textContent = "Focused seta & spatulae";
        stageText.textContent = "Nanoscale tip";
        stageBullet.textContent = "Focused seta expands into spatulae fan for contact demonstration.";
      } else {
        label.textContent = "Molecular contact (1/r⁶)";
        stageText.textContent = "Molecular";
        stageBullet.textContent = "Molecules appear; force intensity visualized between spatula tips and molecules.";
      }
    }
    updateStageText(0);

    // helpers
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function smooth(x) { return x * x * (3 - 2 * x); }
    function getProgress() { const sh = document.body.scrollHeight - window.innerHeight; if (sh <= 0) return 0; return clamp(window.scrollY / sh, 0, 1); }

    // reusable objects
    const tmpObj = new THREE.Object3D();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    // animation
    function animate() {
      const p = getProgress();
      // stages:
      // 0: [0,0.2) macro
      // 1: [0.2,0.42) lamellae
      // 2: [0.42,0.72) setae growth
      // 3: [0.72,0.88) focused seta -> spatulae
      // 4: [0.88,1.0] molecules & forces
      const s0 = 0.2, s1 = 0.42, s2 = 0.72, s3 = 0.88;

      // camera interpolation
      let camZ, camY;
      if (p < s0) {
        const t = smooth(clamp(p / s0, 0, 1));
        camZ = THREE.MathUtils.lerp(START_Z, MID_Z, t * 0.35);
        camY = THREE.MathUtils.lerp(28, 22, t * 0.6);
        updateStageText(0);
      } else if (p < s1) {
        const t = smooth(clamp((p - s0) / (s1 - s0), 0, 1));
        camZ = THREE.MathUtils.lerp(MID_Z, 40, t * 0.8);
        camY = THREE.MathUtils.lerp(22, 18, t * 0.6);
        updateStageText(1);
      } else if (p < s2) {
        const t = smooth(clamp((p - s1) / (s2 - s1), 0, 1));
        camZ = THREE.MathUtils.lerp(40, 18, t);
        camY = THREE.MathUtils.lerp(18, 14, t * 0.9);
        updateStageText(2);
      } else if (p < s3) {
        const t = smooth(clamp((p - s2) / (s3 - s2), 0, 1));
        camZ = THREE.MathUtils.lerp(18, 10, t);
        camY = THREE.MathUtils.lerp(14, 11, t);
        updateStageText(3);
      } else {
        const t = smooth(clamp((p - s3) / (1 - s3), 0, 1));
        camZ = THREE.MathUtils.lerp(10, CLOSE_Z, t);
        camY = THREE.MathUtils.lerp(11, 8, t);
        updateStageText(4);
      }

      camera.position.lerp(new THREE.Vector3(0, camY, camZ), 0.12);
      const focus = new THREE.Vector3(0, 8 + (1 - p) * 6, 0);
      if (controls) controls.target.lerp(focus, 0.12);

      // toe compress slightly into substrate as p increases
      if (p > 0.03) {
        const compress = clamp((p - 0.03) / 0.12, 0, 1);
        toeGroup.position.lerp(new THREE.Vector3(-2 * compress, 10 - compress * 1.5, -0.6 * compress), 0.08);
      }

      // lamella appearance: fade lamellae in
      const lamT = smooth(clamp((p - s0) / (s1 - s0), 0, 1));
      lamellaeGroup.children.forEach((ch, i) => {
        ch.material.opacity = THREE.MathUtils.lerp(0.0, 1.0, lamT);
        ch.material.transparent = true;
      });

      // setae growth
      const growT = smooth(clamp((p - s1) / (s2 - s1), 0, 1));
      setaeMat.opacity = THREE.MathUtils.lerp(0.0, 0.95, growT);
      for (let i = 0; i < setaeInfo.length; i++) {
        const s = setaeInfo[i];
        const finalLen = s.length;
        const curLen = THREE.MathUtils.lerp(0.02, finalLen, growT);
        // orientation: uniform lean toward +Z with small twist variance
        const euler = new THREE.Euler(-s.lean, s.twist, 0, "XYZ");
        quat.setFromEuler(euler);
        const basePos = new THREE.Vector3(s.x, s.y, s.z);
        tmpObj.position.copy(basePos).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(quat), curLen / 2);
        tmpObj.quaternion.copy(quat);
        tmpObj.scale.set(1, curLen, 1);
        tmpObj.updateMatrix();
        setaeInst.setMatrixAt(i, tmpObj.matrix);
      }
      setaeInst.instanceMatrix.needsUpdate = true;

      // prepare focused detail: compute the focused seta's tip & orientation
      const focusInfo = setaeInfo[focusIndex];
      const focusGrow = clamp(mapRange(p, s1, s3), 0, 1); // progress to detail grows across stages 2->3
      // find current length for focused seta
      const focusedCurLen = THREE.MathUtils.lerp(0.02, focusInfo.length, smooth(clamp((p - s1) / (s2 - s1), 0, 1)));
      const focusEuler = new THREE.Euler(-focusInfo.lean, focusInfo.twist, 0, "XYZ");
      const focusQuat = new THREE.Quaternion().setFromEuler(focusEuler);
      const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(focusQuat).normalize();
      const focusTip = new THREE.Vector3(focusInfo.x, focusInfo.y, focusInfo.z).addScaledVector(upVec, focusedCurLen).addScaledVector(upVec, 0.02);

      // show/hide & position detailed shaft
      if (p >= s2) {
        shaftMesh.visible = true;
        shaftMesh.material.opacity = THREE.MathUtils.lerp(0.0, 1.0, clamp((p - s2) / (s3 - s2), 0, 1));
        // position shaft so user can see up-close: scale and place it centered at expected tip
        shaftMesh.position.copy(focusTip.clone().addScaledVector(upVec, 9)); // center of long shaft
        shaftMesh.quaternion.copy(focusQuat);
        shaftMesh.scale.set(1.0, 1.0, 1.0);
        // ensure detailGroup visibility
        detailGroup.visible = true;
      } else {
        shaftMesh.visible = false;
        detailGroup.visible = false;
      }

      // spatula fan around tip (only for focus and only late stage)
      const spatProg = smooth(clamp((p - s2) / (s3 - s2), 0, 1));
      for (let si = 0; si < spatulaMeshes.length; si++) {
        const m = spatulaMeshes[si];
        if (spatProg > 0.02) {
          m.visible = true;
          m.material.opacity = THREE.MathUtils.lerp(0.0, 1.0, spatProg);
          // fan angle
          const angle = (si / spatulaMeshes.length) * Math.PI * 1.8 - Math.PI * 0.9;
          // place spatula around tip in a fan perpendicular-ish to seta axis
          // compute two orthonormal vectors perpendicular to upVec
          const tangent = new THREE.Vector3().crossVectors(upVec, new THREE.Vector3(0, 1, 0));
          if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
          tangent.normalize();
          const binormal = new THREE.Vector3().crossVectors(upVec, tangent).normalize();
          // radial offset in local plane
          const radius = 0.28 + (Math.sin(si * 1.3) * 0.03);
          const localPos = focusTip.clone()
            .addScaledVector(tangent, Math.cos(angle) * radius)
            .addScaledVector(binormal, Math.sin(angle) * (radius * 0.6))
            .addScaledVector(upVec, 0.01); // tiny lift to avoid z-fighting
          m.position.copy(localPos);
          // orient plane to face away from seta tip normal (so plane normal ~ upVec)
          const planeNormal = new THREE.Vector3(0, 0, 1);
          const spatQuat = new THREE.Quaternion().setFromUnitVectors(planeNormal, upVec);
          // rotate around upVec to fan
          const fanRot = new THREE.Quaternion().setFromAxisAngle(upVec, angle * 0.32);
          spatQuat.multiply(fanRot);
          m.quaternion.copy(spatQuat);
          m.scale.set(0.9, 0.9, 1.0);
        } else {
          m.visible = false;
        }
      }

      // molecules & force lines at deepest zoom
      const molProg = smooth(clamp((p - s3) / (1 - s3), 0, 1));
      molInst.instanceMatrix.needsUpdate = true;
      molInst.count = MOLE_COUNT;
      molInst.material.opacity = THREE.MathUtils.lerp(0.0, 1.0, molProg);

      if (molProg > 0.02) {
        forceLines.visible = true;
        for (let li = 0; li < LINKS; li++) {
          const idx = linkIndices[li];
          const s = setaeInfo[idx];
          // compute current tip for this seta (same as above)
          const curLenIdx = THREE.MathUtils.lerp(0.02, s.length, smooth(clamp((p - s1) / (s2 - s1), 0, 1)));
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-s.lean, s.twist, 0, "XYZ"));
          const tip = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), curLenIdx).addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), 0.02);

          // find nearest molecule
          let nearest = null; let nd = Infinity;
          for (let mi = 0; mi < molPositions.length; mi++) {
            const d2 = tip.distanceToSquared(molPositions[mi]);
            if (d2 < nd) { nd = d2; nearest = molPositions[mi]; }
          }
          const r = Math.sqrt(nd) + 1e-6;
          // use k/r^6 mapping with clamping; tuned k so values are moderate
          let intensity = 200000 / Math.pow(r, 6);
          intensity = clamp(intensity, 0, 1.2);
          intensity *= molProg;

          // write positions
          posBuf[li * 6 + 0] = tip.x; posBuf[li * 6 + 1] = tip.y; posBuf[li * 6 + 2] = tip.z;
          posBuf[li * 6 + 3] = nearest.x; posBuf[li * 6 + 4] = nearest.y; posBuf[li * 6 + 5] = nearest.z;

          const base = [1.0, 0.78, 0.45];
          colBuf[li * 6 + 0] = base[0] * clamp(0.2 + intensity, 0, 1.0);
          colBuf[li * 6 + 1] = base[1] * clamp(0.2 + intensity * 0.9, 0, 1.0);
          colBuf[li * 6 + 2] = base[2] * clamp(0.1 + intensity * 0.6, 0, 1.0);
          colBuf[li * 6 + 3] = colBuf[li * 6 + 0] * 0.5; colBuf[li * 6 + 4] = colBuf[li * 6 + 1] * 0.5; colBuf[li * 6 + 5] = colBuf[li * 6 + 2] * 0.5;
        }
        lgeo.attributes.position.needsUpdate = true;
        lgeo.attributes.color.needsUpdate = true;
      } else {
        forceLines.visible = false;
      }

      if (controls) controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    // small helper to map range
    function mapRange(v, a, b) { if (b === a) return 0; return (v - a) / (b - a); }

    // responsiveness
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    requestAnimationFrame(animate);

    console.log("[SETAE] hierarchical build loaded. Scroll slowly and observe stages.");
    // final note: if visual elements are too faint / too dense, adjust the knobs below (counts & sizes).
  } catch (err) {
    console.error("Error in setae.js:", err);
    alert("setae.js error — see console.");
  }
});
