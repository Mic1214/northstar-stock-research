const pages = {
  overview: "Market Overview",
  research: "Stock Research",
  analysis: "Analysis Lab",
  learning: "Learning Center",
  portfolio: "Portfolio",
  reports: "Daily Report"
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
  if (!query) {
    searchResult.textContent = "Enter a company name or ticker to prepare a research request.";
    return;
  }
  searchResult.textContent = "“" + query + "” is noted for the next development stage. This starter does not contact a data provider or retrieve financial information yet.";
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
