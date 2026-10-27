const DEFAULT_ALLOWED_ORIGINS = [
  "https://mic1214.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];
const ANNUAL_FORMS = new Set(["10-K", "20-F", "40-F"]);
const rateWindows = new Map();

function json(data, status = 200, origin = "", allowed = false) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff"
  };
  return new Response(JSON.stringify(data), { status, headers });
}


function rateLimited(request, bucket = "default", maxRequests = 12) {
  // Cloudflare supplies this header on deployed Worker requests. If it is
  // missing, do not put every visitor into one shared "unknown" rate bucket.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return false;

  const key = bucket + ":" + ip;
  const now = Date.now();
  const prior = rateWindows.get(key);
  if (prior && now - prior.start < 60_000 && prior.count >= maxRequests) return true;
  if (!prior || now - prior.start >= 60_000) rateWindows.set(key, { start: now, count: 1 });
  else prior.count += 1;

  if (rateWindows.size > 2000) {
    for (const [entryKey, value] of rateWindows) {
      if (now - value.start > 60_000) rateWindows.delete(entryKey);
    }
  }
  return false;
}

async function secResponse(url, env) {
  const userAgent = (env.SEC_USER_AGENT || "").trim();
  if (!userAgent || !/^\S+\s+\([^)]*@[^)]*\)$/.test(userAgent)) {
    throw new Error("The SEC_USER_AGENT setting is missing or incomplete. Set it to the app name followed by a contact email in parentheses.");
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": "application/json"
    },
    cf: { cacheTtl: 3600, cacheEverything: true }
  });
  if (!response.ok) {
    const error = new Error("The SEC returned HTTP " + response.status + ".");
    error.status = 502;
    throw error;
  }
  return response;
}

async function secJson(url, env) {
  const response = await secResponse(url, env);
  return response.json();
}

const MARKET_ALLOWED_SYMBOLS = new Set(["SPY", "QQQ", "DIA", "AAPL"]);

/*
 * Alpha Vantage's standard free API provides end-of-day data, not live US quotes.
 * Keep the API key on the Worker, cache by symbol for 24 hours, and allow only
 * a small fixed watchlist so the public endpoint cannot request arbitrary symbols.
 */
async function alphaVantageQuote(symbol, env) {
  const apiKey = (env.ALPHA_VANTAGE_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("Market data is not configured yet. Add ALPHA_VANTAGE_API_KEY as a Cloudflare Worker secret. No paid plan is required.");
    error.status = 503;
    throw error;
  }

  // Cache only validated, usable quotes. Do not cache provider limit/error
  // messages, which could otherwise persist after the daily quota resets.
  const cacheKey = new Request(
    "https://meridian-sec-data.micahnorris.workers.dev/__cache/market/" + encodeURIComponent(symbol)
  );
  try {
    const cachedResponse = await caches.default.match(cacheKey);
    if (cachedResponse) {
      const cachedQuote = await cachedResponse.json();
      if (cachedQuote && cachedQuote.symbol === symbol && Number.isFinite(Number(cachedQuote.close))) {
        return cachedQuote;
      }
    }
  } catch (error) {
    // Cache is an optimization; a cache miss/failure should not block the feed.
  }

  const endpoint = new URL("https://www.alphavantage.co/query");
  endpoint.searchParams.set("function", "GLOBAL_QUOTE");
  endpoint.searchParams.set("symbol", symbol);
  endpoint.searchParams.set("apikey", apiKey);

  // Avoid caching the provider's raw response here: Alpha Vantage may return
  // an informational/quota message instead of quote data.
  const response = await fetch(endpoint.toString(), {
    headers: { "Accept": "application/json" }
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  const providerMessage = payload["Error Message"] || payload.Note || payload.Information;
  if (!response.ok || providerMessage) {
    const providerText = String(providerMessage || "");
    const dailyLimit = /25 requests per day|standard API (?:call )?frequency|daily rate limit|requests per day|call frequency|rate limit/i.test(providerText);
    const invalidKey = /invalid.*API key|API key.*invalid|invalid.*apikey/i.test(providerText);
    const message = dailyLimit
      ? "Alpha Vantage's free daily request allowance may have been reached (25 requests/day). No paid plan is required; wait for the provider's limit to reset before testing again."
      : (invalidKey
        ? "Alpha Vantage rejected the API key. Check that ALPHA_VANTAGE_API_KEY contains the actual key from your Alpha Vantage account."
        : "Alpha Vantage returned no usable quote. Check the API key and free-tier availability, then try again later.");
    const error = new Error(message);
    error.status = dailyLimit ? 429 : (response.status >= 500 ? 502 : 400);
    throw error;
  }

  const record = payload["Global Quote"];
  const price = Number(record && record["05. price"]);
  if (!record || !Number.isFinite(price) || price <= 0) {
    const error = new Error("Alpha Vantage returned no end-of-day price for " + symbol + ". This may be a provider limit or an unavailable symbol.");
    error.status = 502;
    throw error;
  }

  const numberField = function(key) {
    const n = Number(record[key]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const open = numberField("02. open");
  const previousClose = numberField("08. previous close");
  const changeRaw = String(record["10. change percent"] || "").replace("%", "").trim();
  const reportedChange = Number(changeRaw);
  const changeFromPrevClosePct = Number.isFinite(reportedChange)
    ? reportedChange
    : (previousClose && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null);

  const quote = {
    symbol: String(record["01. symbol"] || symbol).toUpperCase(),
    date: record["07. latest trading day"] || null,
    exchange: null,
    open,
    high: numberField("03. high"),
    low: numberField("04. low"),
    close: price,
    previousClose,
    volume: numberField("06. volume"),
    changeFromPrevClosePct,
    changeLabel: "vs. prior close"
  };

  // Save only a good, normalized quote for 24 hours. Never persist provider
  // errors or any message that might echo the API key.
  try {
    await caches.default.put(cacheKey, new Response(JSON.stringify(quote), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=86400"
      }
    }));
  } catch (error) {
    // A failed cache write should not make a valid quote fail.
  }

  return quote;
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function chooseCompany(query, rows) {
  const q = query.trim().toLowerCase();
  const exactTicker = rows.filter(row => String(row.ticker || "").toLowerCase() === q);
  if (exactTicker.length === 1) return { company: exactTicker[0] };
  const exactName = rows.filter(row => String(row.title || "").toLowerCase() === q);
  if (exactName.length === 1) return { company: exactName[0] };

  const normalized = normalizeName(q);
  if (normalized.length < 3) return { error: "Enter a full ticker or at least three letters of a company name." };
  const matches = rows.filter(row =>
    normalizeName(row.title).includes(normalized) ||
    String(row.ticker || "").toLowerCase().includes(q)
  );
  if (matches.length === 1) return { company: matches[0] };
  if (matches.length > 1) {
    const sorted = matches.sort((a, b) => {
      const at = String(a.ticker || "").toLowerCase() === q ? 0 : 1;
      const bt = String(b.ticker || "").toLowerCase() === q ? 0 : 1;
      return at - bt || String(a.title).localeCompare(String(b.title));
    });
    return {
      error: "More than one company matched. Search by ticker for a precise result.",
      matches: sorted.slice(0, 8).map(row => ({
        ticker: row.ticker,
        name: row.title,
        cik: String(row.cik_str).padStart(10, "0")
      }))
    };
  }
  return { error: "No SEC-listed company matched that search. Check the spelling or try its ticker." };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    // SEC information is public. The bridge permits browser requests from Meridian
    // without relying on CORS as an authentication mechanism.
    const allowed = true;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "GET") {
      return json({ ok: false, error: "Only GET requests are supported." }, 405, origin, allowed);
    }

    const secIdentityConfigured = /^\S+\s+\([^)]*@[^)]*\)$/.test((env.SEC_USER_AGENT || "").trim());

    if (url.pathname === "/") {
      const statusText = secIdentityConfigured
        ? "SEC contact setting: configured"
        : "SEC contact setting: not configured yet";
      const marketStatusText = (env.ALPHA_VANTAGE_API_KEY || "").trim()
        ? "Alpha Vantage data key: configured"
        : "Alpha Vantage data key: not configured yet";
      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meridian SEC Bridge Status</title>
<style>
body{font:16px/1.6 system-ui,-apple-system,sans-serif;background:#0b1020;color:#edf2fb;margin:0;padding:32px}
main{max-width:650px;margin:10vh auto;background:#111a2c;border:1px solid #2b3b59;border-radius:16px;padding:28px}
h1{font-size:26px;margin:0 0 8px}p{color:#b9c6dc} .status{padding:12px;border:1px solid #34527c;border-radius:10px;background:#17243a}a{color:#9bd8ff}
</style>
</head>
<body><main>
<h1>Meridian SEC Bridge</h1>
<p>If you can read this page, the Worker is responding.</p>
<p class="status">${statusText}</p>
<p class="status">${marketStatusText}</p>
<p>Open <a href="/api/health">/api/health</a> for machine-readable status, or <a href="/api/market">/api/market</a> to test the end-of-day market feed.</p>
<p>Market prices are end-of-day only on the standard free provider tier, not live intraday quotes.</p>
</main></body></html>`;
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    if (url.pathname === "/api/health") {
      const health = {
        ok: true,
        service: "Meridian data bridge",
        build: "alphavantage-eod-2026-10-24",
        configured: secIdentityConfigured,
        marketConfigured: Boolean((env.ALPHA_VANTAGE_API_KEY || "").trim()),
        message: secIdentityConfigured ? "SEC request identity is configured." : "Set SEC_USER_AGENT before requesting SEC data."
      };
      const accept = request.headers.get("Accept") || "";
      if (accept.includes("text/html") && !accept.includes("application/json")) {
        const configuredLabel = secIdentityConfigured ? "Configured" : "Not configured yet";
        const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meridian SEC Bridge Health</title><style>
:root{color-scheme:dark}body{margin:0;padding:28px;background:#0b1020;color:#edf2fb;font:16px/1.6 system-ui,sans-serif}
main{max-width:640px;margin:8vh auto;padding:26px;background:#111a2c;border:1px solid #2b3b59;border-radius:16px}
h1{margin:0 0 8px;font-size:25px}.status{padding:12px;border:1px solid #34527c;background:#17243a;border-radius:10px}
a{color:#9bd8ff}small{color:#91a0b8}
</style></head><body><main><h1>Meridian SEC Bridge</h1>
<p class="status">Worker response: <strong>OK</strong></p>
<p>SEC contact setting: <strong>${configuredLabel}</strong></p>
<p>Build: <code>alphavantage-eod-2026-10-24</code></p>
<p><a href="/">Open bridge homepage</a> · <a href="/api/health?format=json">Request JSON status</a></p>
<small>This bridge retrieves public SEC company information and does not provide stock prices.</small>
</main></body></html>`;
        return new Response(page, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }
      return json(health, 200, origin, allowed);
    }

    if (url.pathname === "/api/market") {
      // Missing-key and invalid-symbol requests must not consume the short-term
      // request allowance; otherwise a setup check can lock out the test button.
      if (!(env.ALPHA_VANTAGE_API_KEY || "").trim()) {
        return json({
          ok: false,
          configured: false,
          provider: "Alpha Vantage",
          error: "Market data is not configured yet. Add ALPHA_VANTAGE_API_KEY as a Cloudflare Worker secret. No paid plan is required."
        }, 503, origin, allowed);
      }

      const rawSymbols = (url.searchParams.get("symbols") || "SPY,QQQ,DIA")
        .split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
      const symbols = Array.from(new Set(rawSymbols));
      if (!symbols.length || symbols.length > 3 || symbols.some(symbol => !MARKET_ALLOWED_SYMBOLS.has(symbol))) {
        return json({
          ok: false,
          error: "For now, the market snapshot supports SPY, QQQ, and DIA. AAPL is allowed for connection testing. Request no more than three symbols."
        }, 400, origin, allowed);
      }

      // Separate rate windows keep SEC research requests from blocking market
      // requests. Alpha Vantage's upstream free-tier quota is enforced separately.
      if (rateLimited(request, "market", 12)) {
        return json({
          ok: false,
          error: "Meridian temporarily paused repeated market requests from this connection. Wait one minute and retry once. This is Meridian's short-term limit, not a paid-plan notice."
        }, 429, origin, allowed);
      }

      const quotes = [];
      const errors = [];
      for (const symbol of symbols) {
        try {
          quotes.push(await alphaVantageQuote(symbol, env));
        } catch (error) {
          errors.push({ symbol, error: error.message, status: Number.isInteger(error.status) ? error.status : null });
          // A daily quota response applies to the whole provider key. Do not
          // spend more calls trying the remaining symbols in this snapshot.
          if (error.status === 429) break;
        }
      }

      const responseStatus = quotes.length > 0
        ? 200
        : (errors.some(item => item.status === 429) ? 429 : 502);

      return json({
        ok: quotes.length > 0,
        configured: true,
        provider: "Alpha Vantage",
        dataType: "End-of-day quote data",
        checkedAt: new Date().toISOString(),
        source: "https://www.alphavantage.co/",
        quotes,
        errors,
        disclaimer: "These are the latest available end-of-day quotes, not live intraday prices. SPY, QQQ, and DIA are ETF proxies, not official index values. Daily movement is measured against the previous close."
      }, responseStatus, origin, allowed);
    }

    if (!["/api/company", "/api/facts"].includes(url.pathname)) {
      return json({ ok: false, error: "Endpoint not found. Use /api/health, /api/market, or /api/company?query=MSFT." }, 404, origin, allowed);
    }

    if (rateLimited(request, "sec-research", 12)) {
      return json({ ok: false, error: "This bridge allows up to 12 SEC research requests per minute per connection. Please wait a minute and try again." }, 429, origin, allowed);
    }

    if (!(env.SEC_USER_AGENT || "").trim()) {
      return json({
        ok: false,
        error: "The SEC data bridge has not been configured yet. Add SEC_USER_AGENT to the Worker settings."
      }, 503, origin, allowed);
    }

    if (url.pathname === "/api/facts") {
      const cik = (url.searchParams.get("cik") || "").trim();
      if (!/^\d{10}$/.test(cik)) {
        return json({ ok: false, error: "CIK must contain exactly 10 digits." }, 400, origin, allowed);
      }
      try {
        const upstream = await secResponse("https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json", env);
        const headers = new Headers({
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Vary": "Origin",
          "X-Content-Type-Options": "nosniff"
        });
        if (origin && allowed) {
          headers.set("Access-Control-Allow-Origin", origin);
          headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
          headers.set("Access-Control-Allow-Headers", "Content-Type");
        }
        return new Response(upstream.body, { status: 200, headers });
      } catch (error) {
        const status = Number.isInteger(error.status) ? error.status : 502;
        return json({
          ok: false,
          error: status === 502 && !error.status
            ? "Could not retrieve SEC facts right now. Please try again later."
            : error.message
        }, status, origin, allowed);
      }
    }

    const query = (url.searchParams.get("query") || "").trim();
    if (!query || query.length > 100 || /[<>\u0000-\u001f]/.test(query)) {
      return json({ ok: false, error: "Enter a company name or ticker up to 100 characters long." }, 400, origin, allowed);
    }

    try {
      const directory = await secJson("https://www.sec.gov/files/company_tickers.json", env);
      const rows = Object.values(directory);
      const selection = chooseCompany(query, rows);
      if (!selection.company) {
        const status = selection.matches ? 409 : 404;
        return json({ ok: false, error: selection.error, matches: selection.matches || [] }, status, origin, allowed);
      }

      const selected = selection.company;
      const cik = String(selected.cik_str).padStart(10, "0");
      const factsUrl = "https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json";
      const filingUrl = "https://www.sec.gov/edgar/browse/?CIK=" + cik + "&owner=exclude";

      return json({
        ok: true,
        company: {
          name: selected.title,
          ticker: selected.ticker,
          cik
        },
        checkedAt: new Date().toISOString(),
        sources: {
          filings: filingUrl,
          companyFacts: factsUrl,
          tickerDirectory: "https://www.sec.gov/files/company_tickers.json"
        },
        disclaimer: "Figures are annual values as reported in SEC XBRL filings. Tags and availability vary by company. Missing values are not zero. This is educational research, not investment advice."
      }, 200, origin, allowed);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 502;
      return json({
        ok: false,
        error: status === 502 && !error.status
          ? "Could not retrieve SEC data right now. Please try again later or use the official SEC filing link."
          : error.message
      }, status, origin, allowed);
    }
  }
};
