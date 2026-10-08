// sat-practice.js — single-question-per-screen SAT practice experience:
// intro -> timed test (one question at a time, flag/navigator) -> review -> results

let questions = [];
let currentIndex = 0;
const answers = {};     // id -> letter
const flagged = new Set();
let secondsRemaining = 0;
let timerInterval = null;
let timedMode = true;
let isPaused = false;

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const res = await fetch("sat-questions.json");
    if (!res.ok) throw new Error("Could not load sat-questions.json");
    questions = await res.json();
    $("intro-q-count").textContent = questions.length;
  } catch (err) {
    console.error(err);
    $("screen-intro").innerHTML = `<p class="error-msg">Couldn't load practice questions right now. Please refresh, or check back soon.</p>`;
  }

  $("start-test-btn").addEventListener("click", () => startTest(true));
  $("start-untimed-link").addEventListener("click", (e) => { e.preventDefault(); startTest(false); });
  $("back-btn").addEventListener("click", () => goTo(currentIndex - 1));
  $("next-btn").addEventListener("click", () => {
    if (currentIndex === questions.length - 1) {
      showReview();
    } else {
      goTo(currentIndex + 1);
    }
  });
  $("flag-btn").addEventListener("click", toggleFlag);
  $("pause-btn").addEventListener("click", togglePause);
  $("nav-toggle-btn").addEventListener("click", openNavigator);
  $("navigator-overlay").addEventListener("click", (e) => {
    if (e.target.id === "navigator-overlay") closeNavigator();
  });
  $("goto-review-btn").addEventListener("click", () => { closeNavigator(); showReview(); });
  $("submit-test-btn").addEventListener("click", submitTest);
  $("back-to-test-btn").addEventListener("click", () => showScreen("screen-test"));
}

function startTest(timed) {
  timedMode = timed;
  currentIndex = 0;
  isPaused = false;
  showScreen("screen-test");
  renderQuestion();

  if (timed) {
    const minutes = Math.max(1, parseInt($("timer-minutes").value, 10) || 40);
    secondsRemaining = minutes * 60;
    $("test-timer").style.display = "inline-flex";
    $("pause-btn").style.display = "inline-flex";
    $("pause-btn").textContent = "⏸ Pause";
    updateTimerDisplay();
    runTimer();
  } else {
    $("test-timer").style.display = "none";
    $("pause-btn").style.display = "none";
  }
}

function runTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsRemaining--;
    updateTimerDisplay();
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      showReview();
    }
  }, 1000);
}

function togglePause() {
  if (!timedMode) return;
  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(timerInterval);
    $("pause-btn").textContent = "▶ Resume";
    $("timer-display").classList.add("paused");
  } else {
    runTimer();
    $("pause-btn").textContent = "⏸ Pause";
    $("timer-display").classList.remove("paused");
  }
}

function updateTimerDisplay() {
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  $("timer-display").textContent = `${m}:${s.toString().padStart(2, "0")}`;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
  $(id).style.display = "block";
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

  const choicesEl = $("q-choices");
  choicesEl.innerHTML = Object.entries(q.choices).map(([letter, text]) => `
    <button class="choice-btn${answers[q.id] === letter ? " selected" : ""}" type="button" data-letter="${letter}">
      <span class="choice-letter">${letter}</span>
      <span class="choice-text">${text}</span>
    </button>
  `).join("");

  choicesEl.querySelectorAll(".choice-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      answers[q.id] = btn.dataset.letter;
      choicesEl.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  $("flag-btn").classList.toggle("active", flagged.has(q.id));
  $("back-btn").disabled = currentIndex === 0;
  $("next-btn").textContent = currentIndex === questions.length - 1 ? "Review Answers" : "Next";

  if (window.MathJax) window.MathJax.typesetPromise([$("q-text"), choicesEl]);
}

function toggleFlag() {
  const q = questions[currentIndex];
  if (flagged.has(q.id)) flagged.delete(q.id); else flagged.add(q.id);
  $("flag-btn").classList.toggle("active", flagged.has(q.id));
}

function openNavigator() {
  const grid = $("nav-grid");
  grid.innerHTML = questions.map((q, i) => {
    const classes = ["nav-cell"];
    if (answers[q.id]) classes.push("answered");
    if (flagged.has(q.id)) classes.push("flagged");
    if (i === currentIndex) classes.push("current");
    return `<button class="${classes.join(" ")}" type="button" data-index="${i}">${i + 1}</button>`;
  }).join("");
  grid.querySelectorAll(".nav-cell").forEach(btn => {
    btn.addEventListener("click", () => {
      goTo(parseInt(btn.dataset.index, 10));
      closeNavigator();
    });
  });
  $("navigator-overlay").style.display = "flex";
}
function closeNavigator() { $("navigator-overlay").style.display = "none"; }

function showReview() {
  if (timerInterval) clearInterval(timerInterval);
  showScreen("screen-review");
  const unanswered = questions.filter(q => !answers[q.id]).length;
  $("review-summary").textContent = timedMode && secondsRemaining <= 0
    ? "Time's up! Here's where you left off."
    : `${questions.length - unanswered} of ${questions.length} answered${unanswered ? `, ${unanswered} unanswered` : ""}.`;

  $("review-grid").innerHTML = questions.map((q, i) => {
    const status = answers[q.id] ? "Answered" : "Unanswered";
    const flag = flagged.has(q.id) ? " 🚩" : "";
    return `<button class="review-cell${answers[q.id] ? " answered" : ""}" type="button" data-index="${i}">
      <span class="review-num">${i + 1}</span><span class="review-status">${status}${flag}</span>
    </button>`;
  }).join("");
  $("review-grid").querySelectorAll(".review-cell").forEach(btn => {
    btn.addEventListener("click", () => {
      goTo(parseInt(btn.dataset.index, 10));
      showScreen("screen-test");
    });
  });
}

function submitTest() {
  showScreen("screen-results");
  let correct = 0;
  questions.forEach(q => { if (answers[q.id] === q.answer) correct++; });
  $("score-summary").innerHTML = `You answered <strong>${correct} out of ${questions.length}</strong> correctly.`;

  const list = $("results-list");
  list.innerHTML = questions.map(q => {
    const chosen = answers[q.id];
    const isCorrect = chosen === q.answer;
    const choiceRows = Object.entries(q.choices).map(([letter, text]) => {
      let cls = "";
      if (letter === q.answer) cls = "is-answer";
      else if (letter === chosen) cls = "is-wrong";
      return `<div class="result-choice ${cls}"><span class="choice-letter">${letter}</span><span class="choice-text">${text}</span></div>`;
    }).join("");

    return `
      <article class="result-card">
        <div class="sat-card-meta">
          <span class="q-number">Question ${q.id}</span>
          <span class="tag">${escapeHTML(q.topic)}</span>
          <span class="result-flag ${isCorrect ? "correct" : chosen ? "incorrect" : "skipped"}">
            ${isCorrect ? "✓ Correct" : chosen ? "✗ Incorrect" : "Skipped"}
          </span>
        </div>
        <div class="q-body">
          <p class="q-text">${q.question_latex}</p>
          <div class="choices result-choices">${choiceRows}</div>
          <div class="hint-row">
            <button class="hint-btn" type="button" data-target="sol-${q.id}">Show Full Solution</button>
          </div>
          <div class="hint-panel solution-panel" id="sol-${q.id}">
            <strong>Solution:</strong> <span>${q.solution_latex}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll(".hint-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = $(btn.dataset.target);
      panel.classList.toggle("open");
      if (panel.classList.contains("open") && window.MathJax) window.MathJax.typesetPromise([panel]);
    });
  });

  if (window.MathJax) window.MathJax.typesetPromise([list]);
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", init);
