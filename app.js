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

const secApiStorageKey = "meridian-sec-api-base-url-v1";

function getSecApiBase() {
  try {
    return (window.localStorage.getItem(secApiStorageKey) || "").trim().replace(/\/+$/, "");
  } catch (error) {
    return "";
  }
}

function appendEdgarLink(parent, query) {
  const link = document.createElement("a");
  link.className = "edgar-search-link";
  link.href = "https://www.sec.gov/edgar/search/?q=" + encodeURIComponent(query);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Search official SEC EDGAR ↗";
  parent.append(link);
}

function appendMatches(parent, matches) {
  if (!Array.isArray(matches) || !matches.length) return;
  const label = document.createElement("p");
  label.className = "sec-match-label";
  label.textContent = "Choose a specific match:";
  parent.append(label);
  const list = document.createElement("div");
  list.className = "sec-match-list";
  matches.forEach(function(match) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sec-match-button";
    button.textContent = (match.ticker ? match.ticker + " — " : "") + match.name;
    button.addEventListener("click", function() {
      searchInput.value = match.ticker || match.name;
      showSearchNotice();
    });
    list.append(button);
  });
  parent.append(list);
}

function renderEdgarFallback(query, explanation, matches) {
  searchResult.hidden = false;
  searchResult.replaceChildren();
  const message = document.createElement("p");
  message.className = "edgar-result-note";
  message.textContent = explanation || "Open the SEC's official filings for “" + query + "”.";
  searchResult.append(message);
  appendMatches(searchResult, matches);
  appendEdgarLink(searchResult, query);
  const note = document.createElement("p");
  note.className = "edgar-disclaimer";
  note.textContent = "This opens original SEC records in a new tab. Stock prices are not part of this SEC-only connection.";
  searchResult.append(note);
}

function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not reported";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(value);
}

function formatSecDate(value) {
  if (!value) return "Date not provided";
  const dateValue = new Date(value + "T00:00:00");
  if (Number.isNaN(dateValue.getTime())) return value;
  return dateValue.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function renderCompanyData(data) {
  searchResult.hidden = false;
  searchResult.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "sec-company-heading";
  const title = document.createElement("h2");
  title.textContent = data.company.name + (data.company.ticker ? " (" + data.company.ticker + ")" : "");
  const meta = document.createElement("p");
  meta.className = "muted small";
  meta.textContent = "CIK " + data.company.cik + " · checked " + new Date(data.checkedAt).toLocaleString();
  heading.append(title, meta);
  searchResult.append(heading);

  const grid = document.createElement("div");
  grid.className = "sec-financial-grid";
  data.financials.forEach(function(metric) {
    const card = document.createElement("article");
    card.className = "sec-financial-card";
    const label = document.createElement("span");
    label.className = "muted";
    label.textContent = metric.label;
    const value = document.createElement("strong");
    value.textContent = typeof metric.value === "number" ? formatUsd(metric.value) : "Not reported";
    const dates = document.createElement("p");
    dates.textContent = metric.value == null
      ? "No recognized annual figure returned"
      : "Period ending " + formatSecDate(metric.periodEnd) + " · filed " + formatSecDate(metric.filed);
    card.append(label, value, dates);
    grid.append(card);
  });
  searchResult.append(grid);

  const links = document.createElement("div");
  links.className = "sec-source-links";
  [
    ["Open SEC company filings ↗", data.sources.filings],
    ["Open SEC XBRL facts ↗", data.sources.companyFacts]
  ].forEach(function(entry) {
    const link = document.createElement("a");
    link.className = "edgar-search-link";
    link.href = entry[1];
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = entry[0];
    links.append(link);
  });
  searchResult.append(links);

  const disclaimer = document.createElement("p");
  disclaimer.className = "edgar-disclaimer";
  disclaimer.textContent = data.disclaimer + " Figures are as reported, not forecasts; companies may use different XBRL tags, so missing is not the same as zero.";
  searchResult.append(disclaimer);
}

async function showSearchNotice() {
  const query = searchInput.value.trim();
  searchResult.hidden = false;
  searchResult.replaceChildren();

  if (!query) {
    searchResult.textContent = "Enter a company name or ticker to search SEC filings.";
    return;
  }

  const apiBase = getSecApiBase();
  if (!apiBase) {
    renderEdgarFallback(query, "The in-app SEC bridge is not connected yet. Set its URL once in Settings, or use the official filings link below.");
    return;
  }

  searchButton.disabled = true;
  const originalLabel = searchButton.textContent;
  searchButton.textContent = "Searching…";
  const loading = document.createElement("p");
  loading.className = "edgar-result-note";
  loading.textContent = "Retrieving annual financial facts from the SEC…";
  searchResult.append(loading);

  try {
    const response = await fetch(apiBase + "/api/company?query=" + encodeURIComponent(query), {
      headers: { "Accept": "application/json" }
    });
    const payload = await response.json();
    if (response.ok && payload.ok && payload.company && Array.isArray(payload.financials)) {
      renderCompanyData(payload);
    } else {
      renderEdgarFallback(query, payload.error || "The SEC bridge did not return company data.", payload.matches);
    }
  } catch (error) {
    renderEdgarFallback(query, "Meridian could not reach the SEC bridge. Check the connection in Settings; you can still open the primary-source SEC search below.");
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = originalLabel;
  }
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

/* Optional SEC bridge connection; only the public endpoint URL is saved locally. */
(function setupSecConnection() {
  const input = document.getElementById("sec-api-url");
  const saveButton = document.getElementById("sec-api-save");
  const clearButton = document.getElementById("sec-api-clear");
  const status = document.getElementById("sec-api-status");
  if (!input || !saveButton || !clearButton || !status) return;

  const savedBase = getSecApiBase();
  if (savedBase) {
    input.value = savedBase;
    status.textContent = "A SEC bridge URL is saved in this browser. Test it to confirm it still works.";
  }

  saveButton.addEventListener("click", async function() {
    const raw = input.value.trim().replace(/\/+$/, "");
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (error) {
      status.textContent = "Enter the full Worker URL, including https://.";
      return;
    }
    const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if ((parsed.protocol !== "https:" && !localHost) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      status.textContent = "Use the HTTPS Worker base URL only, without a path, query, or trailing endpoint.";
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Testing…";
    status.textContent = "Checking the bridge configuration…";
    try {
      const response = await fetch(parsed.origin + "/api/health", {
        headers: { "Accept": "application/json" }
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.configured) {
        status.textContent = result.message || result.error || "The bridge responded, but SEC_USER_AGENT has not been configured.";
        return;
      }
      try {
        window.localStorage.setItem(secApiStorageKey, parsed.origin);
      } catch (error) {
        status.textContent = "Connection tested, but this browser blocked local storage. The URL will not persist after refresh.";
        return;
      }
      input.value = parsed.origin;
      status.textContent = "Connected. Stock Research can now retrieve SEC-reported annual financial facts.";
    } catch (error) {
      status.textContent = "Connection failed. Check the URL, Worker deployment, and allowed-origin setting.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save & test connection";
    }
  });

  clearButton.addEventListener("click", function() {
    try {
      window.localStorage.removeItem(secApiStorageKey);
    } catch (error) {
      // The page still behaves as disconnected even if storage is blocked.
    }
    input.value = "";
    status.textContent = "Connection removed from this browser. SEC links still work without the bridge.";
  });
})();
