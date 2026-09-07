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
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "cricket-results-dashboard", timestamp: new Date().toISOString() });
});

function matchArray(payload) {
  const value = unwrap(payload);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.matches)) return value.matches;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function matchId(match) {
  return match?.id || match?.match_id || match?.matchId || match?.key || "";
}

function matchKey(match) {
  const home = String(match?.home?.name || match?.homeTeam?.name || match?.team1?.name || match?.teamA?.name || match?.home || "").trim().toLowerCase();
  const away = String(match?.away?.name || match?.awayTeam?.name || match?.team2?.name || match?.teamB?.name || match?.away || "").trim().toLowerCase();
  const date = String(match?.kickoff_utc || match?.date || match?.startTime || match?.startDate || "").slice(0, 10);
  return `${matchId(match)}|${home}|${away}|${date}`;
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

/*
 * Big Balls' bare cricket match list is intentionally weighted toward scheduled
 * and recent fixtures. Fetch each lifecycle explicitly so Results and Live do
 * not disappear simply because Upcoming fills the default limit.
 */
app.get("/api/matches", async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit) || 200;
    const limit = Math.min(Math.max(requestedLimit, 1), 200);

    const [scheduledPayload, livePayload, finishedPayload] = await Promise.all([
      getMatches({ limit }),
      getMatches({ status: "live", limit }),
      getMatches({ status: "finished", limit })
    ]);

    const data = mergeMatches([
      matchArray(scheduledPayload),
      matchArray(livePayload),
      matchArray(finishedPayload)
    ]);

    res.json({
      ok: true,
      data,
      count: data.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/series", async (req, res) => {
  try {
    const payload = await getSeries();
    res.json({ ok: true, data: unwrap(payload) });
  } catch (error) {
    console.error(error);
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/matches/:id", async (req, res) => {
  try {
    const payload = await getMatch(req.params.id);
    res.json({ ok: true, data: unwrap(payload) });
  } catch (error) {
    console.error(error);
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/matches/:id/scorecard", async (req, res) => {
  try {
    const payload = await getScorecard(req.params.id);
    res.json({ ok: true, data: unwrap(payload) });
  } catch (error) {
    console.error(error);
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cricket dashboard running on port ${PORT}`);
});
