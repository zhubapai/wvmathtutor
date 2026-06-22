// practice.js — loads problems.json and builds the practice problems page

// Diagram renderers: one function per problem id that needs a custom SVG figure.
// To add a new problem with a diagram, write a small function here that returns
// an SVG string, then reference it by id in the DIAGRAMS map below.
const DIAGRAMS = {
  "geo-001": function () {
    // Coordinates mirror the original TikZ: B(0,0) C(4,0) M(2,0) A(-0.75,2.75)
    // Scaled and flipped for screen space (SVG y grows downward).
    const scale = 55;
    const offsetX = 90;
    const offsetY = 30;
    const pt = (x, y) => [offsetX + x * scale, offsetY + (3 - y) * scale];

    const B = pt(0, 0);
    const C = pt(4, 0);
    const M = pt(2, 0);
    const A = pt(-0.75, 2.75);

    return `
<svg viewBox="0 0 340 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Triangle ABC with median AM drawn to midpoint M of BC. Angle BMA is 45 degrees, angle BCA is 30 degrees.">
  <polygon points="${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}" fill="none" stroke="#0B1F3A" stroke-width="2"/>
  <line x1="${A[0]}" y1="${A[1]}" x2="${M[0]}" y2="${M[1]}" stroke="#0B1F3A" stroke-width="2"/>

  <!-- tick marks showing BM = MC -->
  <line x1="${(B[0]+M[0])/2 - 4}" y1="${B[1]-5}" x2="${(B[0]+M[0])/2 - 4}" y2="${B[1]+5}" stroke="#1A5CDB" stroke-width="2"/>
  <line x1="${(B[0]+M[0])/2 + 4}" y1="${B[1]-5}" x2="${(B[0]+M[0])/2 + 4}" y2="${B[1]+5}" stroke="#1A5CDB" stroke-width="2"/>
  <line x1="${(M[0]+C[0])/2 - 4}" y1="${M[1]-5}" x2="${(M[0]+C[0])/2 - 4}" y2="${M[1]+5}" stroke="#1A5CDB" stroke-width="2"/>
  <line x1="${(M[0]+C[0])/2 + 4}" y1="${M[1]-5}" x2="${(M[0]+C[0])/2 + 4}" y2="${M[1]+5}" stroke="#1A5CDB" stroke-width="2"/>

  <!-- labels -->
  <text x="${A[0]}" y="${A[1]-12}" font-family="Inter, sans-serif" font-size="15" font-weight="600" text-anchor="middle" fill="#0B1F3A">A</text>
  <text x="${B[0]-14}" y="${B[1]+16}" font-family="Inter, sans-serif" font-size="15" font-weight="600" text-anchor="middle" fill="#0B1F3A">B</text>
  <text x="${C[0]+14}" y="${C[1]+16}" font-family="Inter, sans-serif" font-size="15" font-weight="600" text-anchor="middle" fill="#0B1F3A">C</text>
  <text x="${M[0]}" y="${M[1]+20}" font-family="Inter, sans-serif" font-size="15" font-weight="600" text-anchor="middle" fill="#0B1F3A">M</text>

  <text x="${(B[0]+M[0])/2 + 35}" y="${B[1]-2}" font-family="Inter, sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="#D4A017">45&#176;</text>
  <text x="${(M[0]+C[0])/2 + 28}" y="${C[1]-2}" font-family="Inter, sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="#D4A017">30&#176;</text>
  <text x="${B[0]+5}" y="${B[1]-5}" font-family="Inter, sans-serif" font-size="13" font-weight="600" text-anchor="middle" fill="#D4A017">x</text>
</svg>`;
  }
};

async function loadProblems() {
  const container = document.getElementById("problem-list");
  try {
    const res = await fetch("problems.json");
    if (!res.ok) throw new Error("Could not load problems.json");
    const problems = await res.json();
    renderFilterTabs(problems);
    renderProblems(problems, container);
  } catch (err) {
    container.innerHTML = `<p class="error-msg">Couldn't load practice problems right now. Please refresh, or check back soon.</p>`;
    console.error(err);
  }
}

function renderFilterTabs(problems) {
  const bar = document.getElementById("filter-bar");
  if (!bar) return;

  // Count problems per topic, preserving first-seen order
  const counts = {};
  problems.forEach(p => { counts[p.topic] = (counts[p.topic] || 0) + 1; });
  const topics = Object.keys(counts);

  if (topics.length <= 1) {
    bar.style.display = "none";
    return;
  }

  const tabs = [
    { label: "All", topic: "all", count: problems.length },
    ...topics.map(t => ({ label: t, topic: t, count: counts[t] }))
  ];

  bar.innerHTML = tabs.map((t, i) => `
    <button class="filter-tab${i === 0 ? " active" : ""}" type="button" data-topic="${escapeHTML(t.topic)}">
      ${escapeHTML(t.label)}<span class="count">${t.count}</span>
    </button>
  `).join("");

  bar.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      bar.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(btn.dataset.topic);
    });
  });
}

function applyFilter(topic) {
  const cards = document.querySelectorAll(".problem-card");
  cards.forEach(card => {
    const matches = topic === "all" || card.dataset.topic === topic;
    card.classList.toggle("hidden", !matches);
  });
}

function renderProblems(problems, container) {
  if (!problems.length) {
    container.innerHTML = `<p class="loading-msg">New problems are on the way &mdash; check back soon!</p>`;
    return;
  }

  container.innerHTML = "";

  problems.forEach((p, index) => {
    const card = document.createElement("article");
    card.className = "problem-card";
    card.dataset.topic = p.topic;

    const diagramHTML = DIAGRAMS[p.id]
      ? `<div class="diagram-wrap">${DIAGRAMS[p.id]()}</div>`
      : "";

    const videoHTML = p.youtube_id
      ? `<div class="video-wrap">
           <iframe src="https://www.youtube.com/embed/${p.youtube_id}"
                   title="Video walkthrough: ${escapeHTML(p.title)}"
                   loading="lazy"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   allowfullscreen></iframe>
         </div>`
      : `<p class="no-video-msg">Video walkthrough coming soon.</p>`;

    card.innerHTML = `
      <div class="card-meta">
        <span class="problem-number">#${String(index + 1).padStart(2, "0")}</span>
        <span class="tag">${escapeHTML(p.topic)}</span>
        ${p.difficulty ? `<span class="tag difficulty">${escapeHTML(p.difficulty)}</span>` : ""}
      </div>
      <div class="card-body">
        <h2 class="problem-title">${escapeHTML(p.title)}</h2>
        <p class="question-text">${p.question_latex}</p>
        ${diagramHTML}
        <button class="show-solution-btn" type="button" aria-expanded="false">Show Solution</button>
        <div class="solution-panel">
          <p class="solution-label">Solution</p>
          <p class="solution-text">${p.solution_latex}</p>
          <div class="answer-box">${p.answer_latex}</div>
          ${videoHTML}
        </div>
      </div>
    `;

    const btn = card.querySelector(".show-solution-btn");
    const panel = card.querySelector(".solution-panel");
    btn.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.textContent = isOpen ? "Hide Solution" : "Show Solution";
      if (isOpen && window.MathJax) {
        window.MathJax.typesetPromise([panel]);
      }
    });

    container.appendChild(card);
  });

  // Render all LaTeX (questions) on initial load
  if (window.MathJax) {
    window.MathJax.typesetPromise([container]);
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", loadProblems);
