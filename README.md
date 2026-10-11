# Northstar Stock Research

Northstar is a beginner-friendly stock research and learning website, developed in small, testable stages.

## Current stage
- Responsive dark-mode interface with six sections
- Learning Center with 18 beginner lessons, source links, search, topic filters, progress marks stored locally in the browser, and a Start lessons button that jumps to the next unfinished lesson
- Accessible navigation and mobile-friendly layouts
- No live market data connected yet; the prototype does not fabricate prices, headlines, returns, company examples, or scores
- Live prices, company listings, and market headlines are intentionally withheld until the owner approves finishing the small interface refinements; an example ticker appears only as placeholder text in the unconnected search field

## Run locally
Open `index.html` in a modern browser. No build step or API key is required.

## Hosting
The site is published through GitHub Pages. The workflow in `.github/workflows/pages.yml` redeploys the current files after changes are pushed to `main`. Deployment status is available in the repository's Actions tab.

## Roadmap
1. Finish small interface refinements and educational lessons.
2. Agree on the research features and verify suitable, legitimate financial-data sources before adding any market data.
3. Add company research, financial statements, and explained metrics with source links and timestamps.
4. Add transparent analysis checklists with uncertainty and limitations.
5. Add portfolio and retirement-account tracking, keeping contributions separate from investment returns.
6. Add researched daily reports only if reliable data and scheduling are available.

## Accuracy and safety
This website is educational and is not investment advice. Data providers may have limits or paid tiers; verify their current terms before integrating them. Never add passwords, private account information, or secret API keys to this public repository.
