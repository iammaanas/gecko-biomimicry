import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, container.clientWidth/container.clientHeight, 0.1, 1000);
camera.position.set(0, 2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,10,7);
scene.add(light);

scene.add(new THREE.AmbientLight(0x404040));

// Wall
const wall = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 4, 4),
  new THREE.MeshStandardMaterial({ color: 0x223344 })
);
wall.position.x = -2;
scene.add(wall);

// Tape pad
const tapeMaterial = new THREE.MeshStandardMaterial({ color: 0x00aa55 });
const tape = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 0.1, 1),
  tapeMaterial
);
tape.position.set(-1.2, 1.5, 0);
scene.add(tape);

// Rope
const rope = new THREE.Mesh(
  new THREE.CylinderGeometry(0.02,0.02,2),
  new THREE.MeshStandardMaterial({ color: 0xffffff })
);
rope.position.set(0.5,0.5,0);
scene.add(rope);

// Weight
const weightMaterial = new THREE.MeshStandardMaterial({ color: 0x5555ff });
const weight = new THREE.Mesh(
  new THREE.BoxGeometry(1,1,1),
  weightMaterial
);
weight.position.set(0.5,-0.8,0);
scene.add(weight);

// Inputs
const massInput = document.getElementById("mass");
const gravityInput = document.getElementById("gravity");
const areaInput = document.getElementById("area");
const stressInput = document.getElementById("stress");
const presetInput = document.getElementById("preset");
const results = document.getElementById("results");

presetInput.addEventListener("change", () => {
  massInput.value = presetInput.value;
  update();
});

document.querySelectorAll("input, select").forEach(el => {
  el.addEventListener("input", update);
});

function update() {
  const m = parseFloat(massInput.value);
  const g = parseFloat(gravityInput.value);
  const A = parseFloat(areaInput.value) / 10000; // cm² to m²
  const sigma = parseFloat(stressInput.value) * 1000; // kPa to Pa

  const Fg = m * g;
  const Fadh = sigma * A;
  const SF = Fadh / Fg;

  results.innerHTML = `
    Adhesion Force: ${Fadh.toFixed(2)} N<br>
    Weight Force: ${Fg.toFixed(2)} N<br>
    Safety Factor: ${SF.toFixed(2)}<br>
    Status: ${SF > 1 ? "HOLD" : "FAIL"}
  `;

  if (SF > 1.2) tapeMaterial.color.set(0x00aa55);
  else if (SF > 1) tapeMaterial.color.set(0xffaa00);
  else tapeMaterial.color.set(0xff0000);
}

update();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth/container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
