// ===============================
// CONSTANT MATERIAL PROPERTY
// ===============================

const SIGMA_KPA = 120; // Gecko adhesive stress (constant)
const SIGMA_PA = SIGMA_KPA * 1000;

// ===============================
// DOM REFERENCES
// ===============================

const massInput = document.getElementById("massInput");
const gravitySelect = document.getElementById("gravitySelect");
const areaSlider = document.getElementById("areaSlider");
const efficiencySlider = document.getElementById("efficiencySlider");

const adhesiveDisplay = document.getElementById("adhesiveForce");
const weightDisplay = document.getElementById("weightForce");
const safetyDisplay = document.getElementById("safetyFactor");
const statusDisplay = document.getElementById("statusLabel");

const presetButtons = document.querySelectorAll(".preset-btn");

// ===============================
// PRESET BUTTON LOGIC
// ===============================

presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {

        presetButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const mass = parseFloat(btn.dataset.mass);
        massInput.value = mass;

        updateSimulation();
    });
});

// ===============================
// MAIN UPDATE FUNCTION
// ===============================

function updateSimulation() {

    const mass = parseFloat(massInput.value);
    const g = parseFloat(gravitySelect.value);
    const area_cm2 = parseFloat(areaSlider.value);
    const eta = parseFloat(efficiencySlider.value);

    const area_m2 = area_cm2 * 1e-4;

    const Fg = mass * g;
    const Fadh = SIGMA_PA * area_m2 * eta;

    const SF = Fadh / Fg;

    updateUI(Fg, Fadh, SF);
}

// ===============================
// UI UPDATE
// ===============================

function updateUI(Fg, Fadh, SF) {

    adhesiveDisplay.textContent = Fadh.toFixed(2) + " N";
    weightDisplay.textContent = Fg.toFixed(2) + " N";
    safetyDisplay.textContent = SF.toFixed(2);

    if (SF >= 1.3) {
        statusDisplay.textContent = "HOLD";
        statusDisplay.style.color = "#4ade80"; // green
    }
    else if (SF >= 1.0) {
        statusDisplay.textContent = "WARNING";
        statusDisplay.style.color = "#facc15"; // yellow
    }
    else {
        statusDisplay.textContent = "FAIL";
        statusDisplay.style.color = "#ef4444"; // red
    }
}

// ===============================
// AUTO UPDATE ON INPUT CHANGE
// ===============================

[massInput, gravitySelect, areaSlider, efficiencySlider]
.forEach(input => {
    input.addEventListener("input", updateSimulation);
});

// Run once at load
updateSimulation();
