require("dotenv").config();

const express = require("express");
const path = require("path");

const { unwrap, getMatches, getMatch, getScorecard, getSeries } = require("./src/cricket-api");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === "https://manmicheal214-maker.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "cricket-results-dashboard", timestamp: new Date().toISOString() }));

function matchArray(payload) {
  const value = unwrap(payload);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.matches)) return value.matches;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function matchId(match) { return match?.id || match?.match_id || match?.matchId || match?.key || ""; }
function matchKey(match) {
  const h = String(match?.home?.name || match?.homeTeam?.name || match?.team1?.name || match?.teamA?.name || match?.home || "").trim().toLowerCase();
  const a = String(match?.away?.name || match?.awayTeam?.name || match?.team2?.name || match?.teamB?.name || match?.away || "").trim().toLowerCase();
  const d = String(match?.kickoff_utc || match?.date || match?.startTime || match?.startDate || "").slice(0, 10);
  return `${matchId(match)}|${h}|${a}|${d}`;
}
function mergeMatches(groups) {
  const map = new Map();
  for (const match of groups.flat()) {
    const key = matchKey(match);
    if (!key || key === "|||") continue;
    const old = map.get(key);
    if (!old || Object.keys(match).length > Object.keys(old).length) map.set(key, match);
  }
  return [...map.values()];
}

let matchesCache = { data: null, expiresAt: 0 };
const CACHE_MS = 60 * 1000;

/*
 * The provider's bare cricket list is recent-first and includes scheduled plus
 * recent results. We also explicitly ask for live and finished rows because a
 * 50-row default can be dominated by future fixtures. Individual lifecycle
 * failures must NOT blank the whole dashboard: the bare list remains a valid
 * fallback, and each successful lifecycle response is merged into it.
 */
app.get("/api/matches", async (req, res) => {
  if (matchesCache.data && Date.now() < matchesCache.expiresAt) {
    return res.json({ ok: true, data: matchesCache.data, count: matchesCache.data.length, cached: true, updatedAt: new Date().toISOString() });
  }

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 200);
    const results = await Promise.allSettled([
      getMatches({ limit }),
      getMatches({ status: "live", limit }),
      getMatches({ status: "finished", limit })
    ]);

    const groups = results.filter(r => r.status === "fulfilled").map(r => matchArray(r.value));
    const data = mergeMatches(groups);

    if (!data.length) {
      const errors = results.filter(r => r.status === "rejected").map(r => r.reason?.message).filter(Boolean);
      throw new Error(errors.join("; ") || "Cricket API returned no matches");
    }

    matchesCache = { data, expiresAt: Date.now() + CACHE_MS };
    res.json({
      ok: true,
      data,
      count: data.length,
      partial: results.some(r => r.status === "rejected"),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    if (matchesCache.data) return res.json({ ok: true, data: matchesCache.data, count: matchesCache.data.length, cached: true, stale: true, updatedAt: new Date().toISOString() });
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/series", async (req, res) => {
  try { const payload = await getSeries(); res.json({ ok: true, data: unwrap(payload) }); }
  catch (error) { console.error(error); res.status(502).json({ ok: false, error: error.message }); }
});

app.get("/api/matches/:id", async (req, res) => {
  try { const payload = await getMatch(req.params.id); res.json({ ok: true, data: unwrap(payload) }); }
  catch (error) { console.error(error); res.status(502).json({ ok: false, error: error.message }); }
});

app.get("/api/matches/:id/scorecard", async (req, res) => {
  try { const payload = await getScorecard(req.params.id); res.json({ ok: true, data: unwrap(payload) }); }
  catch (error) { console.error(error); res.status(502).json({ ok: false, error: error.message }); }
});

app.get("/{*splat}", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`Cricket dashboard running on port ${PORT}`));
