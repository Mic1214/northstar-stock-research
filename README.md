# Meridian Financial Research

Meridian is a beginner-friendly financial research and learning website, developed in small, testable stages.

## Current stage
- Responsive dark-mode interface with six sections
- Learning Center with 18 beginner lessons, source links, search, topic filters, progress marks stored locally in the browser, and a Start lessons button that jumps to the next unfinished lesson
- Accessible navigation and mobile-friendly layouts
- Market watch uses Alpha Vantage's standard free end-of-day quote endpoint once an API key is set as a Cloudflare Worker secret; this is delayed daily data, not live intraday quotes, and the free API has a 25-request-per-day limit
- Stock Research can display annual SEC XBRL facts once the optional Cloudflare Worker is deployed and its URL is configured in Settings
- Fundamental Stock Checklist reviews are saved separately per company in the current browser; only explicit passes earn points, and an overall rating remains provisional while criteria are unverified
- Official SEC EDGAR search is linked directly; in-app facts require the one-time setup in [SEC_DATA_SETUP.md](SEC_DATA_SETUP.md). No paid market-data plan is required; do not enable a paid provider subscription

## Run locally
Open `index.html` in a modern browser. No build step or API key is required.

## Hosting
The site is published through GitHub Pages. The workflow in `.github/workflows/pages.yml` redeploys the current files after changes are pushed to `main`. Deployment status is available in the repository's Actions tab.

## Roadmap
1. Finish small interface refinements and educational lessons.
2. Deploy the optional SEC bridge using [SEC_DATA_SETUP.md](SEC_DATA_SETUP.md), then test in-app company financial facts and source links.
3. Improve financial-statement coverage and add plain-language explanations for each reported metric.
4. Keep Meridian's core Analysis Lab aligned with the owner's 42-point Fundamental Stock Checklist, including its nine sections, supplied glossary, official score bands, evidence notes, and saved company reviews.
5. Add a financial glossary, compound-growth calculator, savings goals, and the Money Experiment Lab.
6. Add researched daily reports only if reliable data and scheduling are available.

## Accuracy and safety
This website is educational and is not investment advice. Market quotes use only Alpha Vantage's free standard tier. Daily prices are not real-time. Do not enable paid provider features; if free API limits are reached, data may temporarily be unavailable. Never add passwords, private account information, or secret API keys to this public repository. Never add passwords, private account information, or secret API keys to this public repository.
