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
