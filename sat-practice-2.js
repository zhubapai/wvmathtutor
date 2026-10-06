// Drop-in replacement for the original SAT practice engine.
// Supports the original multiple-choice schema plus visuals and student-produced responses.

let questions = [];
let currentIndex = 0;
const answers = {};
const flagged = new Set();
let secondsRemaining = 0;
let timerInterval = null;
let timedMode = true;

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

async function init() {
  try {
    const res = await fetch("sat-questions-2.json");
    if (!res.ok) throw new Error("Could not load sat-questions.json");
    questions = await res.json();
    $("intro-q-count").textContent = questions.length;
  } catch (err) {
    console.error(err);
    $("screen-intro").innerHTML = '<p class="error-msg">Could not load the practice questions. Please refresh or try again later.</p>';
    return;
  }

  $("start-test-btn").addEventListener("click", () => startTest(true));
  $("start-untimed-link").addEventListener("click", e => { e.preventDefault(); startTest(false); });
  $("back-btn").addEventListener("click", () => goTo(currentIndex - 1));
  $("next-btn").addEventListener("click", () => currentIndex === questions.length - 1 ? showReview() : goTo(currentIndex + 1));
  $("flag-btn").addEventListener("click", toggleFlag);
  $("nav-toggle-btn").addEventListener("click", openNavigator);
  $("navigator-overlay").addEventListener("click", e => { if (e.target.id === "navigator-overlay") closeNavigator(); });
  $("goto-review-btn").addEventListener("click", () => { closeNavigator(); showReview(); });
  $("submit-test-btn").addEventListener("click", submitTest);
  $("back-to-test-btn").addEventListener("click", () => showScreen("screen-test"));
}

function startTest(timed) {
  timedMode = timed;
  currentIndex = 0;
  showScreen("screen-test");
  renderQuestion();
  clearInterval(timerInterval);
  if (timed) {
    const minutes = Math.max(1, parseInt($("timer-minutes").value, 10) || 43);
    secondsRemaining = minutes * 60;
    $("test-timer").style.display = "inline-flex";
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      secondsRemaining--;
      updateTimerDisplay();
      if (secondsRemaining <= 0) { clearInterval(timerInterval); showReview(); }
    }, 1000);
  } else {
    $("test-timer").style.display = "none";
  }
}

function updateTimerDisplay() {
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  $("timer-display").textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
  $(id).style.display = id === "screen-test" ? "flex" : "block";
}

function goTo(index) {
  if (index < 0 || index >= questions.length) return;
  currentIndex = index;
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentIndex];
  $("q-position").textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  $("nav-current").textContent = currentIndex + 1;
  $("nav-total").textContent = questions.length;
  $("q-topic-tag").textContent = q.topic;
  $("q-text").innerHTML = q.question_latex;

  removeTransientQuestionElements();
  if (q.visual) {
    const visual = document.createElement("div");
    visual.id = "q-visual";
    visual.className = "question-visual";
    visual.innerHTML = renderVisual(q.visual);
    $("q-choices").before(visual);
  }

  if (q.response_type === "student_produced") renderStudentResponse(q);
  else renderChoices(q);
  renderHints(q);

  $("flag-btn").classList.toggle("active", flagged.has(q.id));
  $("back-btn").disabled = currentIndex === 0;
  $("next-btn").textContent = currentIndex === questions.length - 1 ? "Review Answers" : "Next";
  typeset([$("q-text"), $("q-visual"), $("q-choices"), $("q-hints")].filter(Boolean));
}

function removeTransientQuestionElements() {
  $("q-visual")?.remove();
  $("q-hints")?.remove();
}

function renderChoices(q) {
  const el = $("q-choices");
  el.className = "choices";
  el.innerHTML = Object.entries(q.choices).map(([letter, text]) => `
    <button class="choice-btn${answers[q.id] === letter ? " selected" : ""}" type="button" data-letter="${letter}">
      <span class="choice-letter">${letter}</span><span class="choice-text">${text}</span>
    </button>`).join("");
  el.querySelectorAll(".choice-btn").forEach(btn => btn.addEventListener("click", () => {
    answers[q.id] = btn.dataset.letter;
    el.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  }));
}

function renderStudentResponse(q) {
  const el = $("q-choices");
  el.className = "student-response-wrap";
  el.innerHTML = `
    <label class="student-response-label" for="student-response-${q.id}">Enter your answer</label>
    <input id="student-response-${q.id}" class="student-response-input" type="text" inputmode="decimal"
      autocomplete="off" maxlength="20" value="${esc(answers[q.id] || "")}" aria-describedby="student-response-help-${q.id}">
    <p id="student-response-help-${q.id}" class="student-response-help">You may enter an integer, decimal, or fraction.</p>`;
  const input = el.querySelector("input");
  input.addEventListener("input", () => {
    const value = input.value.trim();
    if (value) answers[q.id] = value; else delete answers[q.id];
  });
}

function renderHints(q) {
  const hints = document.createElement("div");
  hints.id = "q-hints";
  hints.className = "practice-hints";
  hints.innerHTML = `
    <div class="hint-row">
      <button class="hint-btn" type="button" data-hint="small">Hint</button>
      <button class="hint-btn" type="button" data-hint="big">More help</button>
    </div>
    <div class="hint-panel" data-panel="small">${q.small_hint}</div>
    <div class="hint-panel" data-panel="big">${q.big_hint}</div>`;
  $("q-choices").after(hints);
  hints.querySelectorAll(".hint-btn").forEach(btn => btn.addEventListener("click", () => {
    const panel = hints.querySelector(`[data-panel="${btn.dataset.hint}"]`);
    panel.classList.toggle("open");
    typeset([panel]);
  }));
}

function toggleFlag() {
  const id = questions[currentIndex].id;
  flagged.has(id) ? flagged.delete(id) : flagged.add(id);
  $("flag-btn").classList.toggle("active", flagged.has(id));
}

function openNavigator() {
  const grid = $("nav-grid");
  grid.innerHTML = questions.map((q, i) => {
    const classes = ["nav-cell"];
    if (hasAnswer(q)) classes.push("answered");
    if (flagged.has(q.id)) classes.push("flagged");
    if (i === currentIndex) classes.push("current");
    return `<button class="${classes.join(" ")}" type="button" data-index="${i}">${i + 1}</button>`;
  }).join("");
  grid.querySelectorAll(".nav-cell").forEach(btn => btn.addEventListener("click", () => {
    goTo(Number(btn.dataset.index)); closeNavigator();
  }));
  $("navigator-overlay").style.display = "flex";
}

function closeNavigator() { $("navigator-overlay").style.display = "none"; }
function hasAnswer(q) { return answers[q.id] !== undefined && String(answers[q.id]).trim() !== ""; }

function showReview() {
  clearInterval(timerInterval);
  showScreen("screen-review");
  const answered = questions.filter(hasAnswer).length;
  const unanswered = questions.length - answered;
  $("review-summary").textContent = timedMode && secondsRemaining <= 0
    ? "Time is up. Review where you left off, then submit."
    : `${answered} of ${questions.length} answered${unanswered ? `, ${unanswered} unanswered` : ""}.`;
  $("review-grid").innerHTML = questions.map((q, i) => `
    <button class="review-cell${hasAnswer(q) ? " answered" : ""}" type="button" data-index="${i}">
      <span class="review-num">${i + 1}</span>
      <span class="review-status">${hasAnswer(q) ? "Answered" : "Unanswered"}${flagged.has(q.id) ? " 🚩" : ""}</span>
    </button>`).join("");
  $("review-grid").querySelectorAll(".review-cell").forEach(btn => btn.addEventListener("click", () => {
    goTo(Number(btn.dataset.index)); showScreen("screen-test");
  }));
}

function submitTest() {
  clearInterval(timerInterval);
  showScreen("screen-results");
  const correct = questions.filter(q => isCorrect(q, answers[q.id])).length;
  $("score-summary").innerHTML = `You answered <strong>${correct} out of ${questions.length}</strong> correctly.`;
  const list = $("results-list");
  list.innerHTML = questions.map((q, i) => resultCard(q, i)).join("");
  list.querySelectorAll(".hint-btn").forEach(btn => btn.addEventListener("click", () => {
    const panel = $(btn.dataset.target);
    panel.classList.toggle("open");
    typeset([panel]);
  }));
  typeset([list]);
}

function resultCard(q, index) {
  const chosen = answers[q.id];
  const correct = isCorrect(q, chosen);
  const status = correct ? "correct" : hasAnswer(q) ? "incorrect" : "skipped";
  const statusText = correct ? "✓ Correct" : hasAnswer(q) ? "✗ Incorrect" : "Skipped";
  let response;
  if (q.response_type === "student_produced") {
    response = `<div class="spr-result"><strong>Your answer:</strong> ${hasAnswer(q) ? esc(chosen) : "No answer"}<br><strong>Correct answer:</strong> ${q.answer_display || esc(q.answer)}</div>`;
  } else {
    response = `<div class="choices result-choices">${Object.entries(q.choices).map(([letter, text]) => {
      const cls = letter === q.answer ? "is-answer" : letter === chosen ? "is-wrong" : "";
      return `<div class="result-choice ${cls}"><span class="choice-letter">${letter}</span><span class="choice-text">${text}</span></div>`;
    }).join("")}</div>`;
  }
  return `<article class="result-card">
    <div class="sat-card-meta"><span class="q-number">Question ${index + 1}</span><span class="tag">${esc(q.topic)}</span><span class="result-flag ${status}">${statusText}</span></div>
    <div class="q-body"><p class="q-text">${q.question_latex}</p>${q.visual ? `<div class="question-visual result-visual">${renderVisual(q.visual)}</div>` : ""}${response}
      <div class="hint-row"><button class="hint-btn" type="button" data-target="sol-${q.id}">Show Full Solution</button></div>
      <div class="hint-panel solution-panel" id="sol-${q.id}"><strong>Solution:</strong> <span>${q.solution_latex}</span></div>
    </div></article>`;
}

function isCorrect(q, value) {
  if (!hasAnswer(q)) return false;
  if (q.response_type !== "student_produced") return value === q.answer;
  const entered = numericValue(value);
  return (q.accepted_answers || [q.answer]).some(a => {
    const expected = numericValue(a);
    return Number.isFinite(entered) && Number.isFinite(expected) && Math.abs(entered - expected) < 1e-9;
  });
}

function numericValue(raw) {
  const text = String(raw).trim().replace(/,/g, "");
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number(text);
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  if (!match || Number(match[2]) === 0) return NaN;
  return Number(match[1]) / Number(match[2]);
}

function renderVisual(v) {
  if (v.type === "table") return `<figure><figcaption>${v.caption || ""}</figcaption><table><thead><tr>${v.headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${v.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></figure>`;
  if (v.type === "geometry_tangent") return tangentDiagram(v);
  return coordinateGraphic(v);
}

function coordinateGraphic(v) {
  const W = 560, H = 330, p = 45;
  const sx = x => p + (x - v.x_min) * (W - 2*p) / (v.x_max - v.x_min);
  const sy = y => H - p - (y - v.y_min) * (H - 2*p) / (v.y_max - v.y_min);
  let marks = `<rect x="${p}" y="${p}" width="${W-2*p}" height="${H-2*p}" fill="#fff" stroke="#cbd5e1"/>`;
  for (let i=0;i<=5;i++) { const x=p+i*(W-2*p)/5, y=p+i*(H-2*p)/5; marks += `<line x1="${x}" y1="${p}" x2="${x}" y2="${H-p}" stroke="#e2e8f0"/><line x1="${p}" y1="${y}" x2="${W-p}" y2="${y}" stroke="#e2e8f0"/>`; }
  if (v.x_min <= 0 && v.x_max >= 0) marks += `<line x1="${sx(0)}" y1="${p}" x2="${sx(0)}" y2="${H-p}" stroke="#334155" stroke-width="1.5"/>`;
  if (v.y_min <= 0 && v.y_max >= 0) marks += `<line x1="${p}" y1="${sy(0)}" x2="${W-p}" y2="${sy(0)}" stroke="#334155" stroke-width="1.5"/>`;
  if (v.lines) v.lines.forEach(line => { marks += `<line x1="${sx(v.x_min)}" y1="${sy(line.slope*v.x_min+line.intercept)}" x2="${sx(v.x_max)}" y2="${sy(line.slope*v.x_max+line.intercept)}" stroke="${line.color}" stroke-width="3" clip-path="url(#plotclip)"/>`; });
  const points = (v.points || []).map(pt => Array.isArray(pt) ? {x:pt[0],y:pt[1]} : pt);
  points.forEach(pt => { marks += `<circle cx="${sx(pt.x)}" cy="${sy(pt.y)}" r="5" fill="#1A5CDB"/>${pt.label ? `<text x="${sx(pt.x)+8}" y="${sy(pt.y)-8}" font-size="13" fill="#334155">${esc(pt.label)}</text>` : ""}`; });
  const labels = `<text x="${W/2}" y="${H-8}" text-anchor="middle" font-size="13">${esc(v.x_label || "x")}</text><text x="14" y="${H/2}" text-anchor="middle" font-size="13" transform="rotate(-90 14 ${H/2})">${esc(v.y_label || "y")}</text>`;
  return `<figure><figcaption>${v.caption || ""}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.caption || "Coordinate graph")}"><defs><clipPath id="plotclip"><rect x="${p}" y="${p}" width="${W-2*p}" height="${H-2*p}"/></clipPath></defs>${marks}${labels}</svg></figure>`;
}

function tangentDiagram(v) {
  return `<figure><figcaption>${v.caption || ""}</figcaption><svg viewBox="0 0 560 300" role="img" aria-label="${esc(v.caption || "Tangent diagram")}">
    <circle cx="190" cy="155" r="85" fill="#eff6ff" stroke="#1A5CDB" stroke-width="3"/>
    <line x1="190" y1="155" x2="242" y2="88" stroke="#334155" stroke-width="3"/>
    <line x1="242" y1="88" x2="455" y2="253" stroke="#D97706" stroke-width="3"/>
    <line x1="190" y1="155" x2="455" y2="253" stroke="#334155" stroke-width="3"/>
    <path d="M242 88 l13 10 l-10 13" fill="none" stroke="#334155" stroke-width="2"/>
    <circle cx="190" cy="155" r="4"/><circle cx="242" cy="88" r="4"/><circle cx="455" cy="253" r="4"/>
    <text x="172" y="175">O</text><text x="235" y="76">T</text><text x="465" y="260">P</text>
    <text x="205" y="122" font-size="14">5</text><text x="318" y="197" font-size="14">13</text>
  </svg></figure>`;
}

function typeset(elements) {
  if (window.MathJax?.typesetPromise && elements.length) window.MathJax.typesetPromise(elements).catch(console.error);
}

document.addEventListener("DOMContentLoaded", init);
