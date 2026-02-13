const slider = document.getElementById("distanceSlider");
const distanceValue = document.getElementById("distanceValue");
const forceValue = document.getElementById("forceValue");
const canvas = document.getElementById("vdwGraph");
const ctx = canvas.getContext("2d");

function calculateForce(r) {
    return 1 / Math.pow(r, 6);
}

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = "#ffbd59";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.strokeStyle = "#ffbd59";
    ctx.lineWidth = 2;

    for (let x = 0.3; x <= 2; x += 0.01) {
        let y = calculateForce(x);

        let plotX = ((x - 0.3) / 1.7) * canvas.width;
        let plotY = canvas.height - (y / 150) * canvas.height;

        ctx.lineTo(plotX, plotY);
    }

    ctx.stroke();
}

slider.addEventListener("input", () => {
    let r = parseFloat(slider.value);
    let force = calculateForce(r);

    distanceValue.textContent = r.toFixed(2);
    forceValue.textContent = force.toExponential(3);

    drawGraph();
});

drawGraph();
