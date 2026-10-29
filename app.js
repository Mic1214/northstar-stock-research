const pages = {
  home: "Home",
  learning: "Learning Center",
  tools: "Financial Tools",
  savings: "Savings Portfolio",
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
  button.addEventListener("click", function() {
    const page = button.dataset.goto;
    showPage(page);
    const targetId = button.dataset.scrollTo;
    if (!targetId || !pages[page]) return;
    window.setTimeout(function() {
      const target = document.getElementById(targetId);
      if (target && target.closest(".page.active")) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
  });
});

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

/* Meridian's core 42-point Fundamental Stock Checklist, based on the owner-supplied PDF. */
const FUNDAMENTAL_SECTIONS = [
  {
    id: "business",
    name: "Business Quality & Durability",
    items: [
      { id: "business-simple", text: "Business is simple to understand", why: "A business model explains what the company sells, who buys it, and what it costs to deliver. Understanding this helps you judge whether profits can last and what could go wrong." },
      { id: "revenue-diversified", text: "Company has diversified revenue sources", why: "Sales across several products, customers, or regions can reduce dependence on one source. Heavy dependence on a single customer or product makes a company more vulnerable." },
      { id: "disruption-risk", text: "Industry is not subject to rapid, unpredictable disruption", why: "Disruption occurs when new technology or a new business approach replaces older ones. Consider whether change could quickly damage demand for the company's offerings." },
      { id: "relevance-10-years", text: "Company will likely still be relevant in 10 years", why: "Long-term relevance means the company can keep attracting customers and earning money as tastes, competition, and technology change." },
      { id: "brand-loyalty", text: "Has meaningful brand recognition or customer loyalty", why: "Recognition means customers know the company; loyalty means they keep choosing it. A famous name alone does not prove the business is strong." }
    ]
  },
  {
    id: "moat",
    name: "Moat & Competitive Position",
    items: [
      { id: "pricing-power", text: "Has pricing power", why: "Pricing power is the ability to raise prices without losing too many customers. It can help the company cover rising costs and protect profit." },
      { id: "margins-peers", text: "Has higher gross or net margins than peers", why: "A margin is the portion of sales left after certain costs. Compare the company with genuinely similar businesses and accounting measures." },
      { id: "net-margin-industry", text: "Has net profit margin above industry average", why: "Net profit margin is profit after expenses, interest, and taxes divided by revenue. The checklist asks for a comparison with the industry average." },
      { id: "barriers-entry", text: "Has clear barriers to entry", why: "Barriers can include patents, licenses, expensive facilities, or difficult-to-copy technology. They can make it harder for new rivals to compete away profits." },
      { id: "market-share", text: "Market share is stable or growing", why: "Market share is the company's portion of sales or customers in a market. A stable or rising share can indicate that the company is retaining or winning customers." }
    ]
  },
  {
    id: "growth",
    name: "Growth: Historical, Current, and Projected",
    items: [
      { id: "revenue-5-years", text: "Revenue has grown consistently over the past 5 years", why: "Revenue is sales before expenses. Review a five-year series, not just one unusually strong year, to judge consistency." },
      { id: "revenue-growth-15", text: "Actual revenue growth is above 15% using latest fiscal year or TTM revenue", why: "Use the latest fiscal year or trailing twelve months (TTM). TTM combines the most recent four reported quarters to provide a current full-year view." },
      { id: "eps-5-years", text: "EPS has grown consistently over the past 5 years", why: "Earnings per share (EPS) is profit available to common shareholders divided by average common shares. Compare several years and note changes in share count." },
      { id: "eps-growth-15", text: "Actual EPS growth is above 15% using latest fiscal year or 3-year CAGR", why: "CAGR is the steady annual growth rate that connects a starting value to its ending value over several years. State which period and EPS measure you use." },
      { id: "revenue-supports-eps", text: "Revenue growth supports EPS growth", why: "EPS can improve from higher sales, cost cuts, or fewer shares. Check whether revenue growth helps support the improvement rather than assuming it does." },
      { id: "growth-accelerating", text: "Growth is accelerating", why: "Acceleration means the growth rate itself is increasing. A company can still be growing while slowing down if its growth rate is falling." },
      { id: "forward-revenue-growth", text: "Consensus analyst estimates project revenue growth above 15% over the next fiscal year or next 2-year CAGR, with estimates stable or rising", why: "Consensus estimates summarize analysts' forecasts. Record the forecast period, the number or coverage of analysts if available, and whether estimates are stable or rising." },
      { id: "forward-eps-fcf-growth", text: "Consensus analyst estimates project EPS or free cash flow per share growth above 15% over the next fiscal year or next 2–3 years, with estimates stable or rising", why: "Per-share growth matters because total profit can rise while the share count rises too. This criterion requires forward estimates, not only historical company filings." }
    ]
  },
  {
    id: "cash-profitability",
    name: "Cash Generation & Profitability",
    items: [
      { id: "positive-fcf", text: "Positive free cash flow", why: "Free cash flow (FCF) is commonly operating cash flow minus capital expenditures. It is cash left after investment in long-lived assets." },
      { id: "fcf-increasing", text: "Free cash flow has increased over the past 3–5 years", why: "Review the trend over three to five years. Individual years may be affected by the timing of cash collection or investment spending." },
      { id: "fcf-four-of-five", text: "Free cash flow has been positive in at least 4 of the last 5 years", why: "Check each of the last five annual periods. Repeated positive FCF can suggest the business is able to fund more of its needs internally." },
      { id: "fcf-margin", text: "Free cash flow margin is stable or improving", why: "FCF margin is FCF divided by revenue. A stable or rising margin means the company is keeping a steady or larger portion of sales as available cash." },
      { id: "operating-margin", text: "Operating margin is stable or improving", why: "Operating margin is operating profit divided by revenue, before interest and taxes. Trends can reveal whether normal operating costs are growing faster or slower than sales." }
    ]
  },
  {
    id: "financial-strength",
    name: "Financial Strength & Capital Efficiency",
    items: [
      { id: "cash-more-debt", text: "More cash than debt", why: "This indicates net cash, but also consider repayment dates and other obligations. A cash balance alone does not establish overall financial safety." },
      { id: "roic-15", text: "ROIC is above 15%", why: "Return on invested capital (ROIC) measures after-tax operating profit relative to capital invested in operations. Compare consistently and check whether the result is sustainable." },
      { id: "shares-stable", text: "Shares outstanding are stable or declining", why: "Issuing additional shares dilutes existing ownership. A stable or declining share count can help business growth translate into growth per share." },
      { id: "recession-resilience", text: "Company would likely remain financially sound during a severe recession", why: "Look at cash, debt, earnings reliability, and obligations to judge whether the company could manage a sharp downturn without forced borrowing, asset sales, or heavy dilution." }
    ]
  },
  {
    id: "industry",
    name: "Industry Tailwinds & Leadership",
    items: [
      { id: "industry-growing", text: "Industry is growing", why: "Industry growth means overall demand or spending across the market is increasing. Check industry evidence rather than assuming a company's growth proves the industry is growing." },
      { id: "industry-tailwinds", text: "Industry has meaningful long-term tailwinds", why: "Tailwinds are long-running trends that support demand. Competitors may benefit from the same trend, so this check alone does not prove a company has an advantage." },
      { id: "industry-leader", text: "Company is a leader, not a laggard, within its industry", why: "Compare the company with relevant peers using evidence such as product position, growth, or profitability. Being the largest does not automatically make it the best investment." },
      { id: "peer-comparison", text: "Growth, margins, and returns compare favorably to peers", why: "Compare growth, profit margins, and returns on invested capital with similar companies. Use consistent definitions and periods." }
    ]
  },
  {
    id: "management",
    name: "Management & Capital Allocation",
    items: [
      { id: "insider-ownership", text: "Insider ownership is meaningful", why: "Insider ownership covers shares held by executives, directors, and other insiders. It may align incentives, but it does not guarantee good decisions; voting control also matters." },
      { id: "management-threats", text: "No major threats to the business model from management decisions", why: "Review choices that could weaken the business, such as an overpriced acquisition, excessive debt, or spending that damages its competitive advantage." },
      { id: "dividend", text: "Dividend is stable or growing", why: "A stable or growing dividend can signal confidence in cash generation, but must have sustainable funding. Some growing companies reinvest cash instead of paying dividends." }
    ]
  },
  {
    id: "valuation",
    name: "Valuation & Analyst Support",
    items: [
      { id: "pe-history", text: "P/E is reasonable relative to its historical average", why: "Price-to-earnings (P/E) is share price divided by EPS. Compare today with the company's own history and investigate why growth, risk, or interest rates might justify a different ratio." },
      { id: "peg-below-1", text: "PEG ratio is below 1", why: "PEG is P/E divided by the annual EPS growth rate expressed as a whole percentage number. It depends on growth assumptions and is not reliable when those assumptions are weak." },
      { id: "pe-peers", text: "P/E is reasonable relative to peers", why: "Compare similar businesses using the same trailing or forward P/E method. A higher ratio may reflect higher expectations or different risks." },
      { id: "valuation-growth", text: "Valuation is justified by revenue, earnings, and cash flow growth", why: "Judge whether expected revenue, earnings, and cash flow improvements support the price investors pay. Even good results may disappoint if the price already assumes too much." },
      { id: "cyclical-trough", text: "Company is currently near a cyclical trough or temporary slowdown", why: "A trough is a low point in a business cycle. Look for evidence the weakness is temporary; conditions can keep deteriorating, and identifying a bottom is difficult." },
      { id: "analyst-targets", text: "Analyst price target support is positive: consensus target implies at least 20% upside, or most recent analyst target revisions are mostly upward over the past 3–6 months", why: "Price targets and revisions are analysts' opinions, not probabilities. Record the current reference price, target date, revisions period, and source. A target may not fit your time frame." }
    ]
  },
  {
    id: "market-sponsorship",
    name: "Market Sponsorship & Risk Control",
    items: [
      { id: "institutional-ownership", text: "Institutional ownership is increasing", why: "Review ownership trends and the reporting dates. Institutional holdings may be disclosed with a delay, so note how current the source is." },
      { id: "distribution-days", text: "Fewer than 3 distribution days in the last 4 weeks", why: "This criterion tracks a market-sponsorship indicator rather than a standard company financial statement. Use a consistent definition and record the market-data source and date." }
    ]
  }
];

(function setupFundamentalChecklist() {
  const companyInput = document.getElementById("fundamental-company");
  const loadButton = document.getElementById("fundamental-load");
  const resetButton = document.getElementById("fundamental-reset");
  const status = document.getElementById("fundamental-status");
  const review = document.getElementById("fundamental-review");
  const sectionContainer = document.getElementById("fundamental-sections");
  if (!companyInput || !loadButton || !resetButton || !status || !review || !sectionContainer) return;

  const storageKey = "meridian-fundamental-stock-checklists-v1";
  const totalItems = FUNDAMENTAL_SECTIONS.reduce(function(sum, section) {
    return sum + section.items.length;
  }, 0);
  let records = {};
  let activeKey = "";
  let activeName = "";

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) records = saved;
  } catch (error) {
    records = {};
  }

  function normalizeKey(value) {
    return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function allItems() {
    return FUNDAMENTAL_SECTIONS.flatMap(function(section) { return section.items; });
  }

  function emptyAnswers() {
    const answers = {};
    allItems().forEach(function(item) {
      answers[item.id] = { result: "unreviewed", evidence: "" };
    });
    return answers;
  }

  function currentAnswersFromUI() {
    const answers = {};
    sectionContainer.querySelectorAll("[data-fundamental-result]").forEach(function(select) {
      const itemId = select.dataset.fundamentalResult;
      const note = sectionContainer.querySelector('[data-fundamental-evidence="' + itemId + '"]');
      answers[itemId] = {
        result: select.value,
        evidence: note ? note.value : ""
      };
    });
    return answers;
  }

  function writeStorage() {
    if (!activeKey) return false;
    const old = records[activeKey] && typeof records[activeKey] === "object" ? records[activeKey] : {};
    records[activeKey] = {
      name: activeName,
      answers: currentAnswersFromUI(),
      updatedAt: new Date().toISOString()
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
      document.getElementById("fundamental-save-state").textContent = "Saved in this browser";
      return true;
    } catch (error) {
      document.getElementById("fundamental-save-state").textContent = "Saving unavailable";
      status.textContent = "This browser blocked local storage. The review is available for this visit but may not remain after refresh.";
      records[activeKey] = old;
      return false;
    }
  }

  function getCurrentAnswers() {
    return currentAnswersFromUI();
  }

  function resultFor(passCount) {
    if (passCount >= 37) return "Elite Opportunity";
    if (passCount >= 31) return "Strong Buy";
    if (passCount >= 26) return "Buy / Watchlist";
    if (passCount === 25) return "Minimum Pass / Speculative";
    return "Fail / Avoid";
  }

  function updateSectionCounts() {
    FUNDAMENTAL_SECTIONS.forEach(function(section) {
      const summary = sectionContainer.querySelector('[data-section-count="' + section.id + '"]');
      if (!summary) return;
      let passes = 0;
      let reviewed = 0;
      section.items.forEach(function(item) {
        const select = sectionContainer.querySelector('[data-fundamental-result="' + item.id + '"]');
        if (select && select.value !== "unreviewed") reviewed += 1;
        if (select && select.value === "pass") passes += 1;
      });
      summary.textContent = passes + " passes · " + reviewed + "/" + section.items.length + " reviewed";
    });
  }

  function updateScore() {
    if (!activeKey) return;
    const answers = getCurrentAnswers();
    const passed = Object.values(answers).filter(function(answer) { return answer.result === "pass"; }).length;
    const notMet = Object.values(answers).filter(function(answer) { return answer.result === "not-met"; }).length;
    const unreviewed = totalItems - passed - notMet;
    const reviewed = totalItems - unreviewed;
    document.getElementById("fundamental-passes").textContent = passed + " / " + totalItems;
    document.getElementById("fundamental-not-met").textContent = String(notMet);
    document.getElementById("fundamental-unreviewed").textContent = String(unreviewed);
    document.getElementById("fundamental-reviewed").textContent = reviewed + " / " + totalItems;
    document.getElementById("fundamental-progress").setAttribute("aria-valuenow", String(reviewed));
    document.getElementById("fundamental-progress-fill").style.width = ((reviewed / totalItems) * 100) + "%";
    const rating = document.getElementById("fundamental-rating");
    const range = document.getElementById("fundamental-score-range");
    if (unreviewed > 0) {
      rating.textContent = "PROVISIONAL — " + unreviewed + " checks are not yet verified. The final scoring band will appear after all " + totalItems + " checks are reviewed.";
      range.textContent = "Possible final pass-count range: " + passed + "–" + (passed + unreviewed) + ". Only confirmed passes earn points; unknown checks are not treated as confirmed failures.";
    } else {
      rating.textContent = "Checklist result: " + resultFor(passed) + " · " + passed + " passes out of " + totalItems + ".";
      range.textContent = "All " + totalItems + " checks have a recorded decision. This label summarizes the checklist, not a guaranteed return or personalized recommendation.";
    }
    updateSectionCounts();
  }

  function addLabel(parent, text, className) {
    const label = document.createElement("label");
    label.textContent = text;
    if (className) label.className = className;
    return label;
  }

  function renderChecklist(answers) {
    sectionContainer.replaceChildren();
    FUNDAMENTAL_SECTIONS.forEach(function(section, sectionIndex) {
      const details = document.createElement("details");
      details.className = "fundamental-section";
      if (sectionIndex === 0) details.open = true;

      const summary = document.createElement("summary");
      summary.className = "fundamental-section-summary";
      const name = document.createElement("span");
      name.textContent = (sectionIndex + 1 < 10 ? "0" : "") + (sectionIndex + 1) + "  " + section.name;
      const count = document.createElement("span");
      count.className = "fundamental-section-count";
      count.dataset.sectionCount = section.id;
      summary.append(name, count);
      details.append(summary);

      const body = document.createElement("div");
      body.className = "fundamental-section-body";
      section.items.forEach(function(item, itemIndex) {
        const answer = answers[item.id] || { result: "unreviewed", evidence: "" };
        const row = document.createElement("article");
        row.className = "fundamental-item";
        row.dataset.itemId = item.id;

        const main = document.createElement("div");
        main.className = "fundamental-item-main";
        const index = document.createElement("span");
        index.className = "fundamental-item-index";
        const globalIndex = allItems().findIndex(function(value) { return value.id === item.id; }) + 1;
        index.textContent = String(globalIndex).padStart(2, "0") + " / 42";
        const title = document.createElement("h3");
        title.textContent = item.text;
        main.append(index, title);

        const help = document.createElement("details");
        help.className = "fundamental-item-help";
        const helpSummary = document.createElement("summary");
        helpSummary.textContent = "Meaning and how to check";
        const helpText = document.createElement("p");
        helpText.textContent = item.why;
        help.append(helpSummary, helpText);
        main.append(help);

        const controls = document.createElement("div");
        controls.className = "fundamental-item-controls";
        const selectId = "fundamental-result-" + item.id;
        const resultLabel = addLabel(controls, "Assessment", "fundamental-control-label");
        resultLabel.htmlFor = selectId;
        const select = document.createElement("select");
        select.className = "fundamental-result-select";
        select.id = selectId;
        select.dataset.fundamentalResult = item.id;
        [
          { value: "unreviewed", label: "Not yet verified" },
          { value: "pass", label: "Pass — 1 point" },
          { value: "not-met", label: "Not met — 0 points" }
        ].forEach(function(optionData) {
          const option = document.createElement("option");
          option.value = optionData.value;
          option.textContent = optionData.label;
          select.append(option);
        });
        select.value = answer.result;
        select.addEventListener("change", function() {
          writeStorage();
          updateScore();
          status.textContent = "Saved locally for " + activeName + ".";
        });
        controls.append(select);

        const evidence = document.createElement("details");
        evidence.className = "fundamental-evidence";
        const evidenceSummary = document.createElement("summary");
        evidenceSummary.textContent = answer.evidence ? "Edit evidence / source note" : "Add evidence / source note";
        const noteId = "fundamental-evidence-" + item.id;
        const noteLabel = addLabel(evidence, "Record the evidence, source URL, period, or uncertainty", "fundamental-control-label");
        noteLabel.htmlFor = noteId;
        const textarea = document.createElement("textarea");
        textarea.id = noteId;
        textarea.rows = 3;
        textarea.maxLength = 2000;
        textarea.placeholder = "Example: 2025 annual report, page or metric; link; date checked; what remains uncertain.";
        textarea.dataset.fundamentalEvidence = item.id;
        textarea.value = answer.evidence || "";
        textarea.addEventListener("input", function() {
          evidenceSummary.textContent = textarea.value.trim() ? "Edit evidence / source note" : "Add evidence / source note";
          writeStorage();
          status.textContent = "Evidence note saved locally for " + activeName + ".";
        });
        evidence.append(evidenceSummary, noteLabel, textarea);
        controls.append(evidence);

        row.append(main, controls);
        body.append(row);
      });
      details.append(body);
      sectionContainer.append(details);
    });
    updateScore();
  }

  function loadCompany() {
    const typedName = companyInput.value.trim();
    if (!typedName) {
      status.textContent = "Enter a company name or ticker first.";
      companyInput.focus();
      return;
    }
    const key = normalizeKey(typedName);
    if (!key) {
      status.textContent = "Enter a valid company name or ticker.";
      return;
    }
    if (activeKey) writeStorage();
    activeKey = key;
    activeName = (records[key] && records[key].name) || typedName;
    companyInput.value = activeName;
    const record = records[key];
    const answers = emptyAnswers();
    if (record && record.answers && typeof record.answers === "object") {
      Object.keys(answers).forEach(function(id) {
        const savedAnswer = record.answers[id];
        if (!savedAnswer || typeof savedAnswer !== "object") return;
        if (["unreviewed", "pass", "not-met"].includes(savedAnswer.result)) answers[id].result = savedAnswer.result;
        if (typeof savedAnswer.evidence === "string") answers[id].evidence = savedAnswer.evidence;
      });
    }
    document.getElementById("fundamental-active-company").textContent = activeName;
    review.hidden = false;
    resetButton.hidden = false;
    renderChecklist(answers);
    status.textContent = record ? "Loaded saved review for " + activeName + "." : "Started a new review for " + activeName + ". Your changes save in this browser.";
    writeStorage();
    updateScore();
    review.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  loadButton.addEventListener("click", loadCompany);
  companyInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") loadCompany();
  });
  resetButton.addEventListener("click", function() {
    if (!activeKey) return;
    const confirmed = window.confirm("Reset every assessment and evidence note for " + activeName + "? This cannot be undone.");
    if (!confirmed) return;
    renderChecklist(emptyAnswers());
    writeStorage();
    status.textContent = "Review reset for " + activeName + ". All 42 checks are now not yet verified.";
    updateScore();
  });
})();


/* Financial tools: compound growth calculator and glossary search. */
(function setupCompoundCalculator() {
  const form = document.getElementById("compound-form");
  const results = document.getElementById("compound-results");
  if (!form || !results) return;
  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  }
  form.addEventListener("submit", function(event) {
    event.preventDefault();
    const initial = Number(document.getElementById("initial-balance").value);
    const monthly = Number(document.getElementById("monthly-contribution").value);
    const annualRate = Number(document.getElementById("annual-rate").value);
    const years = Number(document.getElementById("growth-years").value);
    const compoundsPerYear = Number(document.getElementById("compounding-frequency").value);
    const validFrequencies = [1, 2, 4, 12, 365];
    const valid = [initial, monthly, annualRate, years, compoundsPerYear].every(Number.isFinite)
      && initial >= 0 && monthly >= 0 && annualRate >= 0 && annualRate <= 50
      && years >= 1 && years <= 80 && Number.isInteger(years)
      && validFrequencies.includes(compoundsPerYear);
    if (!valid) {
      results.textContent = "Check the values and enter non-negative amounts, an annual rate from 0% to 50%, 1–80 whole years, and a valid compounding frequency.";
      return;
    }

    // Monthly contributions are combined into each selected compounding period.
    // Contributions are added at period-end, matching the ordinary-annuity model
    // commonly used by compound-interest calculators such as Investor.gov.
    const periods = years * compoundsPerYear;
    const periodRate = annualRate / 100 / compoundsPerYear;
    const contributionPerPeriod = monthly * 12 / compoundsPerYear;
    const factor = Math.pow(1 + periodRate, periods);
    const futureInitial = initial * factor;
    const futureContributions = periodRate === 0
      ? monthly * years * 12
      : contributionPerPeriod * ((factor - 1) / periodRate);
    const projected = futureInitial + futureContributions;
    const contributed = initial + monthly * years * 12;
    const frequencyLabels = { 1: "Annually", 2: "Semiannually", 4: "Quarterly", 12: "Monthly", 365: "Daily" };
    const resultsGrid = document.createElement("div");
    resultsGrid.className = "tool-results-grid compound-results-grid";
    [["Estimated future value", money(projected)],["Total contributions", money(contributed)],["Estimated growth", money(projected-contributed)]].forEach(function(item,index) {
      const card = document.createElement("div");
      card.className = "tool-result-card" + (index === 0 ? " primary-result" : "");
      const label = document.createElement("span");
      label.textContent = item[0];
      const value = document.createElement("strong");
      value.textContent = item[1];
      card.append(label,value);
      resultsGrid.append(card);
    });
    const assumptions = document.createElement("p");
    assumptions.className = "muted small compound-assumptions";
    assumptions.textContent = "Compounded " + frequencyLabels[compoundsPerYear].toLowerCase() + "; contributions added at the end of each compounding period.";
    results.replaceChildren(resultsGrid, assumptions);
  });
})();

(function setupGlossarySearch() {
  const search = document.getElementById("glossary-search");
  const list = document.getElementById("glossary-list");
  const count = document.getElementById("glossary-result-count");
  const empty = document.getElementById("glossary-empty");
  if (!search || !list || !count || !empty) return;
  const terms = Array.from(list.querySelectorAll(".glossary-term"));
  function filterTerms() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    terms.forEach(function(term) {
      const match = !query || term.textContent.toLowerCase().includes(query);
      term.hidden = !match;
      if (match) visible += 1;
    });
    count.textContent = "Showing " + visible + " of " + terms.length + " terms";
    empty.hidden = visible > 0;
  }
  search.addEventListener("input", filterTerms);
  filterTerms();
})();

/* Savings Portfolio: goal data is stored locally in the user's browser. */
(function setupSavingsPortfolio() {
  const form = document.getElementById("savings-goal-form");
  const grid = document.getElementById("savings-goals-grid");
  const empty = document.getElementById("savings-empty-state");
  const status = document.getElementById("savings-status");
  const totalSaved = document.getElementById("savings-total-saved");
  const totalTarget = document.getElementById("savings-total-target");
  const goalCount = document.getElementById("savings-goal-count");
  if (!form || !grid || !empty || !status || !totalSaved || !totalTarget || !goalCount) return;
  const storageKey = "meridian-savings-goals-v1";
  let goals = [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(stored)) goals = stored.filter(function(g) {
      return g && typeof g.id === "string" && typeof g.name === "string" && g.name.trim()
        && Number.isFinite(Number(g.targetAmount)) && Number(g.targetAmount)>0
        && Number.isFinite(Number(g.savedAmount)) && Number(g.savedAmount)>=0;
    }).map(function(g) {
      return {id:g.id,name:g.name.slice(0,80),targetAmount:Number(g.targetAmount),savedAmount:Number(g.savedAmount),targetDate:typeof g.targetDate==="string"?g.targetDate:""};
    });
  } catch (error) { /* Continue in memory if local storage is unavailable. */ }

  function currency(value) {
    return new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:2}).format(value);
  }
  function persist() {
    try { window.localStorage.setItem(storageKey,JSON.stringify(goals)); return true; }
    catch (error) { return false; }
  }
  function el(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function render() {
    grid.replaceChildren();
    empty.hidden=goals.length>0;
    totalSaved.textContent=currency(goals.reduce((sum,g)=>sum+g.savedAmount,0));
    totalTarget.textContent=currency(goals.reduce((sum,g)=>sum+g.targetAmount,0));
    goalCount.textContent=String(goals.length);
    goals.forEach(function(goal) {
      const card=el("article","panel savings-goal-card");
      const top=el("div","savings-goal-top");
      const titleWrap=el("div","savings-goal-title-wrap");
      titleWrap.append(el("h3","",goal.name));
      if(goal.targetDate) {
        const d=new Date(goal.targetDate+"T12:00:00");
        titleWrap.append(el("p","muted small",Number.isNaN(d.getTime())?"Target date: "+goal.targetDate:"Target date: "+d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})));
      }
      const percent=Math.min(100,Math.max(0,goal.savedAmount/goal.targetAmount*100));
      top.append(titleWrap,el("span","savings-goal-percent",Math.round(percent)+"%"));
      card.append(top);
      const amounts=el("div","savings-goal-amounts");
      amounts.append(el("strong","",currency(goal.savedAmount)),el("span","muted","of "+currency(goal.targetAmount)));
      card.append(amounts);
      const track=el("div","savings-progress-track");
      track.setAttribute("role","progressbar");
      track.setAttribute("aria-label","Progress for "+goal.name);
      track.setAttribute("aria-valuemin","0"); track.setAttribute("aria-valuemax","100"); track.setAttribute("aria-valuenow",String(Math.round(percent)));
      const fill=el("div","savings-progress-fill"); fill.style.width=percent+"%"; track.append(fill); card.append(track);
      const remaining=Math.max(0,goal.targetAmount-goal.savedAmount);
      card.append(el("p","savings-remaining muted small",remaining===0?"Goal reached — anything extra is a bonus.":currency(remaining)+" left to reach your goal."));
      const update=el("form","goal-update-form");
      const label=el("label","tool-field-label","Update amount saved ($)");
      const input=el("input","goal-amount-input");
      input.type="number"; input.min="0"; input.max="100000000"; input.step="0.01"; input.required=true; input.value=String(goal.savedAmount);
      input.setAttribute("aria-label","Amount saved for "+goal.name); label.append(input);
      const actions=el("div","goal-card-actions");
      const save=el("button","secondary-button","Save progress"); save.type="submit";
      const remove=el("button","goal-delete-button","Remove goal"); remove.type="button";
      actions.append(save,remove); update.append(label,actions);
      update.addEventListener("submit",function(event) {
        event.preventDefault();
        const val=Number(input.value);
        if(!Number.isFinite(val)||val<0||val>100000000) {status.textContent="Enter a valid saved amount from $0 to $100,000,000.";return;}
        goal.savedAmount=val;
        const ok=persist(); render();
        status.textContent=ok?"Savings progress updated.":"Progress updated for this visit, but browser storage is unavailable.";
      });
      remove.addEventListener("click",function() {
        if(!window.confirm("Remove the savings goal “"+goal.name+"”? This cannot be undone."))return;
        goals=goals.filter(function(g){return g.id!==goal.id;});
        const ok=persist(); render();
        status.textContent=ok?"Savings goal removed.":"Goal removed for this visit, but browser storage is unavailable.";
      });
      card.append(update); grid.append(card);
    });
  }

  form.addEventListener("submit",function(event) {
    event.preventDefault();
    const name=document.getElementById("goal-name").value.trim();
    const target=Number(document.getElementById("goal-target").value);
    const saved=Number(document.getElementById("goal-current").value);
    const date=document.getElementById("goal-date").value;
    if(!name||!Number.isFinite(target)||target<=0||target>100000000||!Number.isFinite(saved)||saved<0||saved>100000000) {
      status.textContent="Enter a goal name, a positive target, and a valid current saved amount."; return;
    }
    goals.unshift({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),name:name.slice(0,80),targetAmount:target,savedAmount:saved,targetDate:date});
    const ok=persist(); render(); form.reset(); document.getElementById("goal-current").value="0";
    status.textContent=ok?"Savings goal added.":"Goal added for this visit, but browser storage is unavailable.";
  });
  render();
})();
