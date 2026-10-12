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
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
  if (origin && allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  const configured = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",").map(value => value.trim()).filter(Boolean);
  return configured.includes(origin);
}

function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const prior = rateWindows.get(ip);
  if (prior && now - prior.start < 60_000 && prior.count >= 12) return true;
  if (!prior || now - prior.start >= 60_000) rateWindows.set(ip, { start: now, count: 1 });
  else prior.count += 1;
  if (rateWindows.size > 2000) {
    for (const [key, value] of rateWindows) {
      if (now - value.start > 60_000) rateWindows.delete(key);
    }
  }
  return false;
}

async function secJson(url, env) {
  const userAgent = (env.SEC_USER_AGENT || "").trim();
  if (!userAgent || !/\S+\s+\([^)]*\)/.test(userAgent)) {
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
  return response.json();
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

function latestAnnualFact(usGaap, tags, instant = false) {
  for (const tag of tags) {
    const fact = usGaap[tag];
    if (!fact || !fact.units || !fact.units.USD) continue;
    const rows = fact.units.USD.filter(item => {
      if (!ANNUAL_FORMS.has(item.form)) return false;
      if (!item.end || (item.fp && item.fp !== "FY")) return false;
      if (instant) return !item.start;
      if (!item.start) return false;
      const duration = (Date.parse(item.end) - Date.parse(item.start)) / 86_400_000;
      return duration >= 300 && duration <= 400;
    }).sort((a, b) =>
      String(b.end).localeCompare(String(a.end)) ||
      String(b.filed || "").localeCompare(String(a.filed || ""))
    );
    if (rows.length) {
      const row = rows[0];
      return {
        value: row.val,
        periodEnd: row.end,
        filed: row.filed || null,
        form: row.form,
        fiscalYear: row.fy || null,
        tag
      };
    }
  }
  return null;
}

function buildFinancials(companyFacts) {
  const gaap = companyFacts.facts && companyFacts.facts["us-gaap"];
  if (!gaap) return [];
  const definitions = [
    { key: "revenue", label: "Revenue", tags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "Revenues", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueGoodsNet"] },
    { key: "netIncome", label: "Net income", tags: ["NetIncomeLoss", "ProfitLoss"] },
    { key: "operatingCashFlow", label: "Operating cash flow", tags: ["NetCashProvidedByUsedInOperatingActivities"] },
    { key: "assets", label: "Total assets", instant: true, tags: ["Assets"] },
    { key: "liabilities", label: "Total liabilities", instant: true, tags: ["Liabilities"] },
    { key: "cash", label: "Cash and equivalents", instant: true, tags: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "CashCashEquivalentsAndShortTermInvestments"] },
    { key: "equity", label: "Stockholders' equity", instant: true, tags: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"] }
  ];
  return definitions.map(def => ({
    key: def.key,
    label: def.label,
    ...latestAnnualFact(gaap, def.tags, Boolean(def.instant))
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = isAllowedOrigin(origin, env);

    if (request.method === "OPTIONS") {
      if (origin && !allowed) return json({ ok: false, error: "Origin not allowed." }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || "null",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (request.method !== "GET") {
      return json({ ok: false, error: "Only GET requests are supported." }, 405, origin, allowed);
    }
    if (!allowed) return json({ ok: false, error: "Origin not allowed." }, 403);

    if (url.pathname === "/api/health") {
      const configured = Boolean((env.SEC_USER_AGENT || "").trim());
      return json({
        ok: true,
        service: "Meridian SEC research bridge",
        configured,
        message: configured ? "SEC request identity is configured." : "Set SEC_USER_AGENT before requesting data."
      }, 200, origin, allowed);
    }

    if (url.pathname !== "/api/company") {
      return json({ ok: false, error: "Endpoint not found. Use /api/health or /api/company?query=MSFT." }, 404, origin, allowed);
    }

    if (rateLimited(request)) {
      return json({ ok: false, error: "This bridge allows up to 12 research requests per minute per edge instance. Please wait a minute and try again." }, 429, origin, allowed);
    }

    if (!(env.SEC_USER_AGENT || "").trim()) {
      return json({
        ok: false,
        error: "The SEC data bridge has not been configured yet. Add SEC_USER_AGENT to the Worker settings."
      }, 503, origin, allowed);
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
      const facts = await secJson(factsUrl, env);
      const filingUrl = "https://www.sec.gov/edgar/browse/?CIK=" + cik + "&owner=exclude";
      const financials = buildFinancials(facts);

      return json({
        ok: true,
        company: {
          name: selected.title,
          ticker: selected.ticker,
          cik,
          sicDescription: facts.entityName || selected.title
        },
        financials,
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
