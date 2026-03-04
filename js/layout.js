// Detect current page
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isHome = currentPage === "index.html" || currentPage === "";

// Layout template — no sidebar, clean topbar with back button on inner pages
const layout = `
<div class="main-wrapper">

    <div class="topbar">
        <div class="left-section">
            ${!isHome ? `<div class="back-btn" onclick="history.back()">←</div>` : ""}
            <a class="brand" href="index.html">Gecko Lab</a>
        </div>
        ${!isHome ? `
        <div class="breadcrumb">${pageName(currentPage)}</div>
        ` : ""}
    </div>

    <div class="main-content">
        <div id="page-content"></div>
    </div>

</div>
`;

function pageName(page) {
    const names = {
        "research.html": "Research Papers",
        "mechanism.html": "Mechanism",
        "simulation.html": "Simulation",
        "setae.html": "Setae Model",
        "applications.html": "Applications",
        "timeline.html": "Timeline",
        "future.html": "Future Potential",
        "presentation.html": "Presentation",
        "about.html": "About"
    };
    return names[page] || "";
}

// Inject layout
document.body.innerHTML = layout;
