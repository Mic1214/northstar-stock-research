# Meridian Financial Research

Meridian is a beginner-friendly financial research and learning website, developed in small, testable stages.

## Current stage
- Responsive dark-mode app interface with three navigation sections: Overview, Learning Center, and Settings
- Learning Center with 18 beginner lessons, source links, search, topic filters, progress marks stored locally in the browser, and a Start lessons button that jumps to the next unfinished lesson
- Accessible navigation and mobile-friendly layouts
- Market watch uses Alpha Vantage's standard free end-of-day quote endpoint once an API key is set as a Cloudflare Worker secret; this is delayed daily data, not live intraday quotes, and the free API has a 25-request-per-day limit
- Learning Center includes the interactive 42-point Fundamental Stock Checklist; reviews are saved separately per company in the current browser, only explicit passes earn points, and the overall label remains provisional while criteria are unverified
- Market data is optional and delayed; no paid market-data plan is required

## Run locally
Open `index.html` in a modern browser. No build step or API key is required.

## Hosting
The site is published through GitHub Pages. The workflow in `.github/workflows/pages.yml` redeploys the current files after changes are pushed to `main`. Deployment status is available in the repository's Actions tab.

## Roadmap
1. Finish small interface refinements and educational lessons.
2. Keep the owner's 42-point Fundamental Stock Checklist inside the Learning Center, including its nine sections, plain-language guidance, official score bands, evidence notes, and saved company reviews.
3. Add a searchable financial glossary, compound-growth calculator, savings goals, and the Money Experiment Lab.
4. Build the Home screen around the learning and planning tools that matter most.

## Accuracy and safety
This website is educational and is not investment advice. Market quotes use only Alpha Vantage's free standard tier. Daily prices are not real-time. Do not enable paid provider features; if free API limits are reached, data may temporarily be unavailable. Never add passwords, private account information, or secret API keys to this public repository.
