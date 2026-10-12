# Meridian SEC data bridge setup

This tiny Cloudflare Worker lets the GitHub Pages site request public SEC filing data without calling the SEC API directly from the browser. It does not use a market-price provider or fabricate prices.

## One-time deployment

1. Create/sign in to a Cloudflare account and open a terminal with Node.js installed.
2. Download the repository or clone it, then enter the `worker` directory.
3. Run `npx wrangler login`.
4. Set a real contact identity for automated SEC requests:
   ```sh
   npx wrangler secret put SEC_USER_AGENT
   ```
   Enter a value like `MeridianResearch/1.0 (contact: your-real-email@example.com)`, replacing the example with an email address you can receive messages at. Do not commit this contact string to the public repository.
5. Deploy:
   ```sh
   npx wrangler deploy
   ```
6. Cloudflare prints a URL ending in `.workers.dev`. In Meridian, open **Settings → SEC data connection**, paste that base URL, and choose **Save & test connection**. The URL is saved only in that browser.

Cloudflare's Workers Free plan currently includes up to 100,000 requests per day and 10 ms CPU time per request. A free plan should be sufficient for light educational testing, but a large SEC response or plan changes could still trigger limits. Source: https://developers.cloudflare.com/workers/platform/limits/

## API

- `GET /api/health` reports whether the SEC request identity is configured.
- `GET /api/company?query=MSFT` resolves a ticker/company name and returns its CIK and primary-source links.
- `GET /api/facts?cik=0000320193` streams that company's SEC XBRL company-facts JSON; the browser extracts the supported annual metrics, keeping the Worker lightweight.
- `ALLOWED_ORIGINS` is preconfigured for this site's GitHub Pages origin and common local development ports.

The Worker contains a lightweight per-edge request guard and caches SEC fetches when supported by Cloudflare. This guard is not a full authentication system, and CORS is not authentication; the data itself is public. Keep this endpoint dedicated to Meridian and monitor its request usage. The Worker does not handle private brokerage data and contains no market-price API key.

## Data notes

Metrics are sourced from SEC company tickers and XBRL company-facts endpoints. Revenue, net income, and operating cash flow use annual filing periods; assets, liabilities, cash, and equity use the most recent eligible annual filing's instant facts. Issuers use different taxonomies and labels, so unavailable fields appear as unavailable rather than zero. Figures are as reported and are not adjusted or turned into a valuation recommendation.

Primary sources:
- SEC API documentation: https://www.sec.gov/edgar/sec-api-documentation
- SEC developer and fair-access guidance: https://www.sec.gov/developer
- SEC company tickers directory: https://www.sec.gov/files/company_tickers.json
