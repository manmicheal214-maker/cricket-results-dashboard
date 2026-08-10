const fs = require("fs");
const path = require("path");

const BASE_URL = "https://api.bigballsdata.com/v1/cricket";

function extractMatches(payload) {
  const candidates = [payload?.data, payload?.data?.matches, payload?.data?.results, payload?.data?.items, payload?.matches, payload?.results, payload?.items];
  return candidates.find(Array.isArray) || [];
}
function text(value) { return String(value ?? "").trim(); }
function teamName(team) { return typeof team === "string" ? text(team) : text(team?.name || team?.teamName || team?.short_name || team?.shortName); }
function getHome(match) { return match?.home || match?.homeTeam || match?.team1 || match?.teamA; }
function getAway(match) { return match?.away || match?.awayTeam || match?.team2 || match?.teamB; }
function competition(match) { return text(match?.league || match?.seriesName || match?.series || match?.competition || match?.tournament || "Other"); }
function kickoff(match) { return match?.kickoff_utc || match?.date || match?.startTime || match?.startDate || ""; }
function normalize(value) { return text(value).toLowerCase().replace(/\s+/g, " "); }
function fixtureKey(match) {
  const home = normalize(teamName(getHome(match))), away = normalize(teamName(getAway(match))), comp = normalize(competition(match));
  const rawDate = kickoff(match); let day = normalize(rawDate).slice(0, 10);
  if (rawDate) { const parsed = new Date(rawDate); if (!Number.isNaN(parsed.getTime())) day = parsed.toISOString().slice(0, 10); }
  return `${home}|${away}|${day}|${comp}`;
}
function recordQuality(match) {
  const status = normalize(match?.status || match?.state || match?.matchStatus); let score = 0;
  if (status.includes("live") || status.includes("progress") || status.includes("in play")) score += 10000;
  else if (status.includes("complete") || status.includes("result") || status.includes("finish")) score += 5000;
  if (match?.score) score += 1000; if (match?.venue || match?.stadium || match?.ground) score += 100; if (kickoff(match)) score += 50;
  return score + Object.keys(match || {}).length;
}
function dedupeMatches(matches) {
  const unique = new Map();
  for (const match of matches) { const key = fixtureKey(match); if (!key || key.startsWith("|||")) continue; const existing = unique.get(key); if (!existing || recordQuality(match) > recordQuality(existing)) unique.set(key, match); }
  return [...unique.values()];
}
async function apiRequest(pathname, key) {
  const response = await fetch(`${BASE_URL}${pathname}`, { headers: { Accept: "application/json", Authorization: `Bearer ${key}` } });
  const bodyText = await response.text(); let payload;
  try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch { throw new Error(`Cricket API returned non-JSON (${response.status})`); }
  if (!response.ok) { const message = payload?.error?.message || payload?.error || payload?.message || `Cricket API returned ${response.status}`; throw new Error(String(message)); }
  return payload;
}
function unwrap(payload) { return payload?.data ?? payload; }
function hasInnings(data) { return Array.isArray(data?.innings) && data.innings.length > 0; }

async function fetchScorecards(matches, key) {
  const directory = path.join(__dirname, "..", "public", "data", "scorecards");
  fs.mkdirSync(directory, { recursive: true });
  const indexPath = path.join(directory, "index.json");
  const index = {};
  const now = Date.now();
  const candidates = matches.filter(m => {
    const status = normalize(m?.status || m?.state || m?.matchStatus);
    const live = status.includes("live") || status.includes("progress") || status.includes("in play");
    const finished = status.includes("complete") || status.includes("result") || status.includes("finish");
    const t = new Date(kickoff(m)).getTime();
    const recent = Number.isFinite(t) && now - t <= 72 * 60 * 60 * 1000;
    return live || (finished && recent);
  }).slice(0, 12);

  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const match = candidates[cursor++]; const id = match?.id || match?.match_id || match?.matchId || match?.key;
      if (!id) continue;
      try {
        const payload = await apiRequest(`/matches/${encodeURIComponent(id)}/scorecard`, key);
        const data = unwrap(payload);
        const updatedAt = new Date().toISOString();
        const available = hasInnings(data);
        fs.writeFileSync(path.join(directory, `${encodeURIComponent(String(id))}.json`), JSON.stringify({ ok: available, id, data, updatedAt }, null, 2) + "\n");
        index[id] = { available, innings: Array.isArray(data?.innings) ? data.innings.length : 0, updatedAt };
        console.log(`${available ? "Fetched" : "No innings yet for"} scorecard ${id}`);
      } catch (error) {
        index[id] = { available: false, error: error.message, updatedAt: new Date().toISOString() };
        fs.writeFileSync(path.join(directory, `${encodeURIComponent(String(id))}.json`), JSON.stringify({ ok: false, id, error: error.message, updatedAt: new Date().toISOString() }, null, 2) + "\n");
        console.log(`Scorecard unavailable for ${id}: ${error.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(indexPath, JSON.stringify({ updatedAt: new Date().toISOString(), matches: index }, null, 2) + "\n", "utf8");
  console.log(`Scorecard refresh attempted for ${candidates.length} matches`);
}

async function main() {
  const key = process.env.BBS_API_KEY; if (!key) throw new Error("BBS_API_KEY is required");
  const payload = await apiRequest("/matches", key);
  const matches = extractMatches(payload); const uniqueMatches = dedupeMatches(matches);
  const output = { ok: true, updatedAt: new Date().toISOString(), sourceCount: matches.length, count: uniqueMatches.length, data: uniqueMatches };
  const outputPath = path.join(__dirname, "..", "public", "data", "matches.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  await fetchScorecards(uniqueMatches, key);
  console.log(`Fetched ${matches.length} cricket records`); console.log(`Deduplicated to ${uniqueMatches.length} unique fixtures`); console.log(`Wrote cricket data to ${outputPath}`);
}
main().catch(error => { console.error(error); process.exit(1); });
