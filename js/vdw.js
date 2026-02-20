const distanceSlider = document.getElementById("distanceSlider");
const contactSlider = document.getElementById("contactSlider");

const distanceValue = document.getElementById("distanceValue");
const contactValue = document.getElementById("contactValue");
const forceValue = document.getElementById("forceValue");
const adhesionIndex = document.getElementById("adhesionIndex");
const contactSpots = document.getElementById("contactSpots");
const modeLabel = document.getElementById("modeLabel");
const statusChip = document.getElementById("statusChip");

const canvas = document.getElementById("vdwGraph");
const ctx = canvas.getContext("2d");

let state = {
    r: 0.6,
    contactPercent: 75,
    relativeForce: 0,
    adhesion: 0,
    mode: "Strong"
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function drawAxes(width, height, plot) {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();

    ctx.fillStyle = "#a9b8c9";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Relative force", 16, plot.top + 8);
    ctx.fillText("Distance r (nm)", plot.right - 95, height - 12);

    // light horizontal guides
    for (let i = 1; i <= 4; i += 1) {
        const y = plot.top + ((plot.bottom - plot.top) * i) / 5;
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
    }
}

function drawCurve(plot) {
    const minR = 0.3;
    const maxR = 2.0;

    ctx.beginPath();

    for (let i = 0; i <= 260; i += 1) {
        const t = i / 260;
        const r = minR + t * (maxR - minR);

        // normalized to r=0.3 -> 1.0
        const yNorm = Math.pow(minR / r, 6);
        const x = plot.left + t * (plot.right - plot.left);
        const y = plot.bottom - yNorm * (plot.bottom - plot.top);

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.strokeStyle = "#78c1ff";
    ctx.lineWidth = 2.6;
    ctx.stroke();
}

function drawMicroContactScene(width, height) {
    const panelW = 250;
    const x0 = width - panelW - 18;
    const y0 = 18;
    const panelH = 150;

    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, panelW, panelH, 12);
    ctx.fill();
    ctx.stroke();

    // rigid surface
    ctx.fillStyle = "#3d5168";
    ctx.fillRect(x0 + 22, y0 + 20, 16, 110);

    // tape strip
    ctx.fillStyle = "#ffbd59";
    ctx.fillRect(x0 + 38, y0 + 45, 24, 60);

    // micro-contact dots
    const totalDots = 24;
    const activeDots = Math.round((state.contactPercent / 100) * totalDots);

    for (let i = 0; i < totalDots; i += 1) {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const x = x0 + 70 + col * 26;
        const y = y0 + 34 + row * 24;

        const isActive = i < activeDots;
        ctx.fillStyle = isActive ? "#71de9c" : "rgba(170, 182, 196, 0.35)";
        ctx.beginPath();
        ctx.arc(x, y, isActive ? 4.2 : 3.4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = "#d9e8f8";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Micro-contacts", x0 + 95, y0 + 132);
}

function drawCurrentPoint(plot) {
    const minR = 0.3;
    const maxR = 2.0;

    const t = (state.r - minR) / (maxR - minR);
    const yNorm = Math.pow(minR / state.r, 6);

    const x = plot.left + t * (plot.right - plot.left);
    const y = plot.bottom - yNorm * (plot.bottom - plot.top);

    ctx.fillStyle = "#ffbd59";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,189,89,0.45)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ffdb9b";
    ctx.font = "12px Segoe UI";
    ctx.fillText(`r=${state.r.toFixed(2)}nm`, x + 8, y - 10);
}

function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width < 2 || height < 2) {
        return;
    }

    ctx.clearRect(0, 0, width, height);

    const plot = {
        left: 54,
        right: width - 290,
        top: 30,
        bottom: height - 36
    };

    drawAxes(width, height, plot);
    drawCurve(plot);
    drawCurrentPoint(plot);
    drawMicroContactScene(width, height);
}

function updateModel() {
    const r = parseFloat(distanceSlider.value) || 0.6;
    const contactPercent = parseFloat(contactSlider.value) || 75;

    const relativeForce = Math.pow(1 / r, 6);
    const contactEfficiency = contactPercent / 100;

    // normalized index for display only
    const normalized = Math.pow(1 / 0.3, 6);
    const adhesion = (relativeForce / normalized) * contactEfficiency;

    let mode = "Weak";
    if (adhesion >= 0.55) {
        mode = "Strong";
    } else if (adhesion >= 0.25) {
        mode = "Moderate";
    }

    state = { r, contactPercent, relativeForce, adhesion, mode };

    distanceValue.textContent = r.toFixed(2);
    contactValue.textContent = contactPercent.toFixed(0);
    forceValue.textContent = relativeForce.toFixed(2);
    adhesionIndex.textContent = adhesion.toFixed(3);
    contactSpots.textContent = `${Math.round((contactPercent / 100) * 24)} / 24`;
    modeLabel.textContent = mode;

    if (mode === "Strong") {
        statusChip.textContent = "High adhesion window";
        statusChip.style.color = "#4ade80";
        statusChip.style.borderColor = "rgba(74, 222, 128, 0.35)";
        statusChip.style.background = "rgba(74, 222, 128, 0.12)";
    } else if (mode === "Moderate") {
        statusChip.textContent = "Balanced / near threshold";
        statusChip.style.color = "#facc15";
        statusChip.style.borderColor = "rgba(250, 204, 21, 0.35)";
        statusChip.style.background = "rgba(250, 204, 21, 0.12)";
    } else {
        statusChip.textContent = "Low adhesion / likely slip";
        statusChip.style.color = "#f87171";
        statusChip.style.borderColor = "rgba(248, 113, 113, 0.35)";
        statusChip.style.background = "rgba(248, 113, 113, 0.12)";
    }

    draw();
}

distanceSlider.addEventListener("input", updateModel);
contactSlider.addEventListener("input", updateModel);
window.addEventListener("resize", resizeCanvas);

updateModel();
resizeCanvas();
