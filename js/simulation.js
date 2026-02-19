const massInput = document.getElementById("massInput");
const gravitySelect = document.getElementById("gravitySelect");
const areaSlider = document.getElementById("areaSlider");
const efficiencySlider = document.getElementById("efficiencySlider");

const areaValue = document.getElementById("areaValue");
const efficiencyValue = document.getElementById("efficiencyValue");

const adhesiveForceEl = document.getElementById("adhesiveForce");
const weightForceEl = document.getElementById("weightForce");
const safetyFactorEl = document.getElementById("safetyFactor");
const statusLabel = document.getElementById("statusLabel");

const presetButtons = document.querySelectorAll(".preset-btn");

/* 
   CONSTANT ADHESIVE STRESS
   ~100 kPa for strong gecko-inspired dry adhesive
*/
const SIGMA = 100000; // Pascals

function updateSimulation() {

    const mass = parseFloat(massInput.value);
    const g = parseFloat(gravitySelect.value);
    const area_cm2 = parseFloat(areaSlider.value);
    const efficiency = parseFloat(efficiencySlider.value);

    // Update visible slider values
    areaValue.textContent = area_cm2;
    efficiencyValue.textContent = efficiency.toFixed(2);

    // Convert cm² to m²
    const area_m2 = area_cm2 / 10000;

    // Physics
    const weightForce = mass * g;
    const adhesiveForce = SIGMA * area_m2 * efficiency;
    const safetyFactor = adhesiveForce / weightForce;

    adhesiveForceEl.textContent = adhesiveForce.toFixed(2) + " N";
    weightForceEl.textContent = weightForce.toFixed(2) + " N";
    safetyFactorEl.textContent = safetyFactor.toFixed(2);

    // Status Logic
    if (safetyFactor > 1.3) {
        statusLabel.textContent = "HOLD";
        statusLabel.style.color = "#4ade80";
    } 
    else if (safetyFactor > 1.0) {
        statusLabel.textContent = "WARNING";
        statusLabel.style.color = "#facc15";
    } 
    else {
        statusLabel.textContent = "FAIL";
        statusLabel.style.color = "#f87171";
    }
}

// Preset Handling
presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {

        presetButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        massInput.value = btn.dataset.mass;
        updateSimulation();
    });
});

// Live Updates
massInput.addEventListener("input", updateSimulation);
gravitySelect.addEventListener("change", updateSimulation);
areaSlider.addEventListener("input", updateSimulation);
efficiencySlider.addEventListener("input", updateSimulation);

// Initial Run
updateSimulation();
