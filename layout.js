// Detect current page
const currentPage = window.location.pathname.split("/").pop() || "index.html";

// Layout template
const layout = `
<div class="main-wrapper">

    <div class="topbar">
        <div class="left-section">
            <div class="menu-btn" onclick="toggleMenu()">☰</div>
            <div class="brand">Gecko Lab</div>
        </div>

        <div class="nav-controls">
            <div class="nav-arrow" onclick="history.back()">←</div>
            <div class="nav-arrow" onclick="history.forward()">→</div>
        </div>
    </div>

    <div class="sidebar" id="sidebar">
        <h2>Gecko Lab</h2>

        <a class="nav-item ${currentPage === "index.html" ? "active" : ""}" href="index.html">Home</a>
        <a class="nav-item ${currentPage === "research.html" ? "active" : ""}" href="research.html">Research</a>
        <a class="nav-item ${currentPage === "mechanism.html" ? "active" : ""}" href="mechanism.html">Mechanism</a>
        <a class="nav-item ${currentPage === "simulation.html" ? "active" : ""}" href="simulation.html">Simulation</a>
        <a class="nav-item ${currentPage === "setae.html" ? "active" : ""}" href="setae.html">Setae Model</a>
        <a class="nav-item ${currentPage === "presentation.html" ? "active" : ""}" href="presentation.html">Presentation</a>
        <a class="nav-item ${currentPage === "about.html" ? "active" : ""}" href="about.html">About</a>
    </div>

    <div class="overlay" id="overlay" onclick="toggleMenu()"></div>

    <div class="main-content">
        <div id="page-content"></div>
    </div>

</div>
`;

// Inject layout
document.body.innerHTML = layout;

// Sidebar toggle
function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
}
