# Meridian Financial Research

Meridian is a beginner-friendly financial research and learning website, developed in small, testable stages.

## Current stage
- Responsive dark-mode interface with seven sections
- Learning Center with 18 beginner lessons, source links, search, topic filters, progress marks stored locally in the browser, and a Start lessons button that jumps to the next unfinished lesson
- Accessible navigation and mobile-friendly layouts
- No stock-price or headline feed is connected; the app does not fabricate prices, headlines, returns, company examples, or scores
- Stock Research can display annual SEC XBRL facts once the optional Cloudflare Worker is deployed and its URL is configured in Settings
- Official SEC EDGAR search is linked directly; in-app facts require the one-time setup in [SEC_DATA_SETUP.md](SEC_DATA_SETUP.md). Market prices and headlines remain excluded until a suitable licensed provider is chosen

## Run locally
Open `index.html` in a modern browser. No build step or API key is required.

## Hosting
The site is published through GitHub Pages. The workflow in `.github/workflows/pages.yml` redeploys the current files after changes are pushed to `main`. Deployment status is available in the repository's Actions tab.

## Roadmap
1. Finish small interface refinements and educational lessons.
2. Deploy the optional SEC bridge using [SEC_DATA_SETUP.md](SEC_DATA_SETUP.md), then test in-app company financial facts and source links.
3. Improve financial-statement coverage and add plain-language explanations for each reported metric.
4. Add transparent analysis checklists with uncertainty and limitations.
5. Add portfolio and retirement-account tracking, keeping contributions separate from investment returns.
6. Add researched daily reports only if reliable data and scheduling are available.

## Accuracy and safety
This website is educational and is not investment advice. Data providers may have limits or paid tiers; verify their current terms before integrating them. Never add passwords, private account information, or secret API keys to this public repository.
