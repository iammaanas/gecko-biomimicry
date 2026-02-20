 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/js/simulation.js b/js/simulation.js
index 7fba6cf7bc509f0a77b2f0b7520f65f374a5d618..129f4505179c4883064d73faff11132e680d690d 100644
--- a/js/simulation.js
+++ b/js/simulation.js
@@ -1,79 +1,275 @@
-const massInput = document.getElementById("massInput");
-const gravitySelect = document.getElementById("gravitySelect");
-const areaSlider = document.getElementById("areaSlider");
-const efficiencySlider = document.getElementById("efficiencySlider");
-
-const areaValue = document.getElementById("areaValue");
-const efficiencyValue = document.getElementById("efficiencyValue");
-
-const adhesiveForceEl = document.getElementById("adhesiveForce");
-const weightForceEl = document.getElementById("weightForce");
-const safetyFactorEl = document.getElementById("safetyFactor");
-const statusLabel = document.getElementById("statusLabel");
-
-const presetButtons = document.querySelectorAll(".preset-btn");
-
-/* 
-   CONSTANT ADHESIVE STRESS
-   ~100 kPa for strong gecko-inspired dry adhesive
-*/
-const SIGMA = 100000; // Pascals
-
-function updateSimulation() {
-
-    const mass = parseFloat(massInput.value);
-    const g = parseFloat(gravitySelect.value);
-    const area_cm2 = parseFloat(areaSlider.value);
-    const efficiency = parseFloat(efficiencySlider.value);
-
-    // Update visible slider values
-    areaValue.textContent = area_cm2;
-    efficiencyValue.textContent = efficiency.toFixed(2);
-
-    // Convert cm² to m²
-    const area_m2 = area_cm2 / 10000;
-
-    // Physics
-    const weightForce = mass * g;
-    const adhesiveForce = SIGMA * area_m2 * efficiency;
-    const safetyFactor = adhesiveForce / weightForce;
-
-    adhesiveForceEl.textContent = adhesiveForce.toFixed(2) + " N";
-    weightForceEl.textContent = weightForce.toFixed(2) + " N";
-    safetyFactorEl.textContent = safetyFactor.toFixed(2);
-
-    // Status Logic
-    if (safetyFactor > 1.3) {
-        statusLabel.textContent = "HOLD";
-        statusLabel.style.color = "#4ade80";
-    } 
-    else if (safetyFactor > 1.0) {
-        statusLabel.textContent = "WARNING";
-        statusLabel.style.color = "#facc15";
-    } 
-    else {
-        statusLabel.textContent = "FAIL";
-        statusLabel.style.color = "#f87171";
-    }
-}
-
-// Preset Handling
-presetButtons.forEach(btn => {
-    btn.addEventListener("click", () => {
-
-        presetButtons.forEach(b => b.classList.remove("active"));
-        btn.classList.add("active");
-
-        massInput.value = btn.dataset.mass;
-        updateSimulation();
-    });
-});
-
-// Live Updates
-massInput.addEventListener("input", updateSimulation);
-gravitySelect.addEventListener("change", updateSimulation);
-areaSlider.addEventListener("input", updateSimulation);
-efficiencySlider.addEventListener("input", updateSimulation);
-
-// Initial Run
-updateSimulation();
+const massInput = document.getElementById("massInput");
+const gravitySelect = document.getElementById("gravitySelect");
+const areaSlider = document.getElementById("areaSlider");
+const efficiencySlider = document.getElementById("efficiencySlider");
+
+const areaValue = document.getElementById("areaValue");
+const efficiencyValue = document.getElementById("efficiencyValue");
+
+const adhesiveForceEl = document.getElementById("adhesiveForce");
+const weightForceEl = document.getElementById("weightForce");
+const safetyFactorEl = document.getElementById("safetyFactor");
+const statusLabel = document.getElementById("statusLabel");
+
+const presetButtons = document.querySelectorAll(".preset-btn");
+
+const canvas = document.getElementById("simCanvas");
+const ctx = canvas.getContext("2d");
+
+const SIGMA = 100000; // Pa
+
+let physicsState = {
+    mass: 8,
+    g: 9.81,
+    areaCm2: 10,
+    areaM2: 10 / 10000,
+    efficiency: 0.9,
+    adhesiveForce: 0,
+    weightForce: 0,
+    safetyFactor: 0,
+    status: "--"
+};
+
+let slipOffset = 0;
+
+function resizeCanvas() {
+    const dpr = window.devicePixelRatio || 1;
+    const rect = canvas.getBoundingClientRect();
+
+    canvas.width = Math.max(1, Math.round(rect.width * dpr));
+    canvas.height = Math.max(1, Math.round(rect.height * dpr));
+    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
+
+    drawSimulation();
+}
+
+function clamp(value, min, max) {
+    return Math.min(max, Math.max(min, value));
+}
+
+function drawArrow(x1, y1, x2, y2, color, label) {
+    const angle = Math.atan2(y2 - y1, x2 - x1);
+    const headSize = 10;
+
+    ctx.strokeStyle = color;
+    ctx.fillStyle = color;
+    ctx.lineWidth = 2.2;
+
+    ctx.beginPath();
+    ctx.moveTo(x1, y1);
+    ctx.lineTo(x2, y2);
+    ctx.stroke();
+
+    ctx.beginPath();
+    ctx.moveTo(x2, y2);
+    ctx.lineTo(x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6));
+    ctx.lineTo(x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6));
+    ctx.closePath();
+    ctx.fill();
+
+    ctx.font = "12px Segoe UI";
+    ctx.fillText(label, x2 + 8, y2 - 6);
+}
+
+function drawSimulation() {
+    const width = canvas.clientWidth;
+    const height = canvas.clientHeight;
+
+    if (width < 2 || height < 2) {
+        return;
+    }
+
+    ctx.clearRect(0, 0, width, height);
+
+    // Background grid
+    ctx.strokeStyle = "rgba(255,255,255,0.03)";
+    ctx.lineWidth = 1;
+    for (let x = 0; x <= width; x += 28) {
+        ctx.beginPath();
+        ctx.moveTo(x, 0);
+        ctx.lineTo(x, height);
+        ctx.stroke();
+    }
+    for (let y = 0; y <= height; y += 28) {
+        ctx.beginPath();
+        ctx.moveTo(0, y);
+        ctx.lineTo(width, y);
+        ctx.stroke();
+    }
+
+    const wallX = width * 0.18;
+
+    // Rigid wall
+    ctx.fillStyle = "#2d3d4f";
+    ctx.fillRect(wallX - 30, 20, 30, height - 40);
+
+    ctx.strokeStyle = "rgba(255,255,255,0.18)";
+    ctx.lineWidth = 2;
+    ctx.beginPath();
+    ctx.moveTo(wallX, 20);
+    ctx.lineTo(wallX, height - 20);
+    ctx.stroke();
+
+    // Tape dimensions based on contact area
+    const areaNorm = clamp((physicsState.areaCm2 - 1) / 99, 0, 1);
+    const tapeHeight = 58 + areaNorm * 120;
+    const tapeWidth = 18;
+    const tapeY = height * 0.28;
+
+    // Slip animation
+    const failAmount = clamp(1 - physicsState.safetyFactor, 0, 1);
+    const holdAmount = clamp(physicsState.safetyFactor - 1, 0, 1);
+
+    if (physicsState.safetyFactor < 1) {
+        slipOffset += 0.9 + failAmount * 2.2;
+    } else {
+        slipOffset *= 0.82;
+    }
+
+    const maxSlip = Math.max(16, height - tapeY - tapeHeight - 130);
+    slipOffset = clamp(slipOffset, 0, maxSlip);
+
+    const tapeTop = tapeY + slipOffset;
+    const tapeBottom = tapeTop + tapeHeight;
+    const tapeX = wallX + 2;
+
+    ctx.fillStyle = "#ffbd59";
+    ctx.fillRect(tapeX, tapeTop, tapeWidth, tapeHeight);
+
+    // Contact region glow reflects efficiency
+    const efficiencyAlpha = 0.15 + physicsState.efficiency * 0.5;
+    ctx.fillStyle = `rgba(255, 189, 89, ${efficiencyAlpha})`;
+    ctx.fillRect(wallX - 4, tapeTop, 4, tapeHeight);
+
+    // Hanging link and mass block
+    const linkX = tapeX + tapeWidth;
+    const linkY = tapeBottom;
+    const chainLength = 48;
+
+    ctx.strokeStyle = "#cfd8e3";
+    ctx.lineWidth = 3;
+    ctx.beginPath();
+    ctx.moveTo(linkX, linkY);
+    ctx.lineTo(linkX, linkY + chainLength);
+    ctx.stroke();
+
+    const massNorm = clamp((physicsState.mass - 0.18) / (70 - 0.18), 0, 1);
+    const blockSize = 40 + massNorm * 62;
+    const blockX = linkX - blockSize / 2;
+    const blockY = linkY + chainLength;
+
+    const grad = ctx.createLinearGradient(blockX, blockY, blockX + blockSize, blockY + blockSize);
+    grad.addColorStop(0, "#87a6c4");
+    grad.addColorStop(1, "#5d7690");
+    ctx.fillStyle = grad;
+    ctx.fillRect(blockX, blockY, blockSize, blockSize);
+
+    ctx.strokeStyle = "rgba(0,0,0,0.28)";
+    ctx.strokeRect(blockX, blockY, blockSize, blockSize);
+
+    ctx.fillStyle = "#ecf2f7";
+    ctx.font = "12px Segoe UI";
+    ctx.fillText(`${physicsState.mass.toFixed(2)} kg`, blockX + 7, blockY + blockSize / 2 + 4);
+
+    // Force vectors
+    const forceScale = clamp(physicsState.weightForce / 280, 0.15, 1);
+    const arrowLen = 34 + forceScale * 80;
+
+    drawArrow(linkX + blockSize * 0.45, blockY + blockSize * 0.45, linkX + blockSize * 0.45, blockY + blockSize * 0.45 + arrowLen, "#ff7b7b", "Weight");
+
+    const adhesionScale = clamp(physicsState.adhesiveForce / 280, 0.15, 1);
+    const adhesionLen = 34 + adhesionScale * 70;
+
+    drawArrow(tapeX + tapeWidth + 36, tapeTop + tapeHeight * 0.5, tapeX + tapeWidth + 36 - adhesionLen, tapeTop + tapeHeight * 0.5, "#65d48f", "Adhesion");
+
+    // Status label in scene
+    ctx.fillStyle = "#dbe7f3";
+    ctx.font = "13px Segoe UI";
+    ctx.fillText("Rigid surface", wallX - 82, 18);
+    ctx.fillText("Gecko tape", tapeX + 24, tapeTop + 16);
+
+    if (physicsState.status === "FAIL") {
+        ctx.fillStyle = "#f87171";
+        ctx.fillText("Slip detected", tapeX + 26, tapeBottom + 22 + Math.min(slipOffset * 0.2, 22));
+    } else if (physicsState.status === "WARNING") {
+        ctx.fillStyle = "#facc15";
+        ctx.fillText("Near limit", tapeX + 26, tapeBottom + 22);
+    } else {
+        ctx.fillStyle = "#4ade80";
+        ctx.fillText(`Stable hold (+${(holdAmount * 100).toFixed(0)}%)`, tapeX + 26, tapeBottom + 22);
+    }
+}
+
+function updateSimulation() {
+    const mass = Math.max(0.01, parseFloat(massInput.value) || 0.01);
+    const g = parseFloat(gravitySelect.value) || 9.81;
+    const areaCm2 = parseFloat(areaSlider.value) || 10;
+    const efficiency = parseFloat(efficiencySlider.value) || 0.9;
+
+    areaValue.textContent = areaCm2.toFixed(0);
+    efficiencyValue.textContent = efficiency.toFixed(2);
+
+    const areaM2 = areaCm2 / 10000;
+
+    const weightForce = mass * g;
+    const adhesiveForce = SIGMA * areaM2 * efficiency;
+    const safetyFactor = adhesiveForce / weightForce;
+
+    let status = "FAIL";
+    let statusColor = "#f87171";
+
+    if (safetyFactor > 1.3) {
+        status = "HOLD";
+        statusColor = "#4ade80";
+    } else if (safetyFactor > 1.0) {
+        status = "WARNING";
+        statusColor = "#facc15";
+    }
+
+    physicsState = {
+        mass,
+        g,
+        areaCm2,
+        areaM2,
+        efficiency,
+        adhesiveForce,
+        weightForce,
+        safetyFactor,
+        status
+    };
+
+    adhesiveForceEl.textContent = `${adhesiveForce.toFixed(2)} N`;
+    weightForceEl.textContent = `${weightForce.toFixed(2)} N`;
+    safetyFactorEl.textContent = safetyFactor.toFixed(2);
+    statusLabel.textContent = status;
+    statusLabel.style.color = statusColor;
+}
+
+function frameLoop() {
+    drawSimulation();
+    requestAnimationFrame(frameLoop);
+}
+
+presetButtons.forEach((btn) => {
+    btn.addEventListener("click", () => {
+        presetButtons.forEach((b) => b.classList.remove("active"));
+        btn.classList.add("active");
+        massInput.value = btn.dataset.mass;
+        updateSimulation();
+    });
+});
+
+massInput.addEventListener("input", () => {
+    presetButtons.forEach((b) => b.classList.remove("active"));
+    updateSimulation();
+});
+
+gravitySelect.addEventListener("change", updateSimulation);
+areaSlider.addEventListener("input", updateSimulation);
+efficiencySlider.addEventListener("input", updateSimulation);
+
+window.addEventListener("resize", resizeCanvas);
+
+updateSimulation();
+resizeCanvas();
+frameLoop();
 
EOF
)
