const pages = {
  overview: "Market Overview",
  research: "Stock Research",
  analysis: "Analysis Lab",
  learning: "Learning Center",
  portfolio: "Portfolio",
  reports: "Daily Report",
  settings: "Settings"
};

function showPage(page) {
  if (!pages[page]) return;
  document.querySelectorAll(".page").forEach(function(section) {
    section.classList.toggle("active", section.id === "page-" + page);
  });
  document.querySelectorAll(".nav-item").forEach(function(button) {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.getElementById("crumb").textContent = pages[page];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(function(button) {
  button.addEventListener("click", function() { showPage(button.dataset.page); });
});
document.querySelectorAll("[data-goto]").forEach(function(button) {
  button.addEventListener("click", function() { showPage(button.dataset.goto); });
});

const date = new Date();
document.getElementById("today").textContent = date.toLocaleDateString(undefined, {
  weekday: "short", month: "short", day: "numeric", year: "numeric"
});

const searchInput = document.getElementById("company-search");
const searchButton = document.getElementById("search-button");
const searchResult = document.getElementById("search-result");

function showSearchNotice() {
  const query = searchInput.value.trim();
  searchResult.hidden = false;
  searchResult.replaceChildren();

  if (!query) {
    searchResult.textContent = "Enter a company name or ticker to prepare a research request.";
    return;
  }

  const message = document.createElement("p");
  message.className = "edgar-result-note";
  message.textContent = "Search the official SEC filing database for “" + query + "”.";

  const link = document.createElement("a");
  link.className = "edgar-search-link";
  link.href = "https://www.sec.gov/edgar/search/?q=" + encodeURIComponent(query);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Search SEC EDGAR ↗";

  const note = document.createElement("p");
  note.className = "edgar-disclaimer";
  note.textContent = "This opens original filings in a new tab. Meridian has not imported market prices or financial statements into this screen yet.";

  searchResult.append(message, link, note);
}
searchButton.addEventListener("click", showSearchNotice);
searchInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") showSearchNotice();
});


/* Learning Center filters and locally saved progress */
(function setupLearningCenter() {
  const grid = document.getElementById("lesson-grid");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll("[data-lesson-id]"));
  const emptyState = document.createElement("p");
  emptyState.className = "lesson-empty-state";
  emptyState.setAttribute("role", "status");
  emptyState.hidden = true;
  emptyState.textContent = "No lessons match your search and selected topic. Try another search or choose All lessons.";
  grid.insertAdjacentElement("afterend", emptyState);
  const search = document.getElementById("lesson-search");
  const filterButtons = Array.from(document.querySelectorAll("[data-lesson-filter]"));
  const count = document.getElementById("lesson-result-count");
  const progressText = document.getElementById("learning-progress-text");
  const progressBar = document.getElementById("learning-progressbar");
  const progressFill = document.getElementById("learning-progress-fill");
  const storageKey = "northstar-completed-lessons-v1";
  let activeFilter = "all";
  let completed = new Set();

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) completed = new Set(saved.filter(function(id) {
      return cards.some(function(card) { return card.dataset.lessonId === id; });
    }));
  } catch (error) {
    // Progress still works for this page view if browser storage is unavailable.
  }

  function updateProgress() {
    const total = cards.length;
    const finished = completed.size;
    const percent = total ? Math.round((finished / total) * 100) : 0;
    progressText.textContent = finished + " of " + total + " lessons completed";
    progressFill.style.width = percent + "%";
    progressBar.setAttribute("aria-valuenow", String(finished));
    cards.forEach(function(card) {
      const button = card.querySelector("[data-complete]");
      const isDone = completed.has(card.dataset.lessonId);
      if (!button) return;
      button.setAttribute("aria-pressed", String(isDone));
      button.textContent = isDone ? "Completed ✓" : "Mark complete";
    });
  }

  function filterLessons() {
    const query = (search.value || "").trim().toLocaleLowerCase();
    let visible = 0;
    cards.forEach(function(card) {
      const categoryMatches = activeFilter === "all" || card.dataset.category === activeFilter;
      const textMatches = !query || card.textContent.toLocaleLowerCase().includes(query);
      const show = categoryMatches && textMatches;
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = "Showing " + visible + " of " + cards.length + " lessons";
    emptyState.hidden = visible !== 0;
  }

  filterButtons.forEach(function(button) {
    button.addEventListener("click", function() {
      activeFilter = button.dataset.lessonFilter;
      filterButtons.forEach(function(other) {
        const selected = other === button;
        other.classList.toggle("active", selected);
        other.setAttribute("aria-pressed", String(selected));
      });
      filterLessons();
    });
  });

  search.addEventListener("input", filterLessons);

  grid.addEventListener("click", function(event) {
    const startButton = event.target.closest(".lesson-start-button");
    if (!startButton) return;
    const card = startButton.closest("[data-lesson-id]");
    if (!card) return;
    const details = card.querySelector("details");
    if (details) details.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    const summary = details && details.querySelector("summary");
    if (summary) summary.focus({ preventScroll: true });
  });

  grid.addEventListener("click", function(event) {
    const button = event.target.closest("[data-complete]");
    if (!button) return;
    const id = button.dataset.complete;
    if (completed.has(id)) completed.delete(id);
    else completed.add(id);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(completed)));
    } catch (error) {
      // Keep the changed completion state in memory for this page view.
    }
    updateProgress();
  });

  filterLessons();
  updateProgress();
})();


/* Clear entry point for beginning or continuing lessons */
(function setupStartLessonsButton() {
  const startButton = document.getElementById("start-lessons-button");
  const lessonGrid = document.getElementById("lesson-grid");
  if (!startButton || !lessonGrid) return;

  startButton.addEventListener("click", function() {
    const cards = Array.from(lessonGrid.querySelectorAll("[data-lesson-id]"));
    if (!cards.length) return;

    const completedIds = new Set();
    try {
      const saved = JSON.parse(window.localStorage.getItem("northstar-completed-lessons-v1") || "[]");
      if (Array.isArray(saved)) saved.forEach(function(id) { completedIds.add(id); });
    } catch (error) {
      // If local storage is blocked, simply start at the first lesson.
    }

    const nextLesson = cards.find(function(card) {
      return !completedIds.has(card.dataset.lessonId);
    }) || cards[0];

    const search = document.getElementById("lesson-search");
    if (search && search.value) {
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const allFilter = document.querySelector('[data-lesson-filter="all"]');
    if (allFilter && !allFilter.classList.contains("active")) allFilter.click();

    cards.forEach(function(card) { card.classList.remove("start-target"); });
    nextLesson.classList.add("start-target");
    const lessonDetails = nextLesson.querySelector("details");
    if (lessonDetails) lessonDetails.open = true;
    nextLesson.scrollIntoView({ behavior: "smooth", block: "start" });
    const lessonSummary = lessonDetails && lessonDetails.querySelector("summary");
    if (lessonSummary) lessonSummary.focus({ preventScroll: true });
    window.setTimeout(function() { nextLesson.classList.remove("start-target"); }, 2200);
  });
})();


/* Persistent interface color theme; market gain/loss colors remain semantic. */
(function setupColorThemes() {
  const validThemes = new Set(["blue", "purple", "indigo", "cyan", "glacier", "violet"]);
  const storageKey = "meridian-color-theme-v1";
  const themeButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));

  function applyTheme(theme, savePreference) {
    if (!validThemes.has(theme)) theme = "blue";
    document.documentElement.setAttribute("data-theme", theme);
    themeButtons.forEach(function(button) {
      const selected = button.dataset.themeChoice === theme;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    if (savePreference) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        // The theme still applies for this page view if storage is unavailable.
      }
    }
  }

  let savedTheme = "blue";
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored && validThemes.has(stored)) savedTheme = stored;
  } catch (error) {
    // Start with the default blue theme if browser storage is unavailable.
  }
  applyTheme(savedTheme, false);
  themeButtons.forEach(function(button) {
    button.addEventListener("click", function() {
      applyTheme(button.dataset.themeChoice, true);
    });
  });
})();
