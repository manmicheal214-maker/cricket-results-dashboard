const fs = require("fs");
const path = require("path");

const BASE_URL = "https://api.bigballsdata.com/v1/cricket";

function extractMatches(payload) {
  const candidates = [
    payload?.data,
    payload?.data?.matches,
    payload?.data?.results,
    payload?.data?.items,
    payload?.matches,
    payload?.results,
    payload?.items
  ];
  return candidates.find(Array.isArray) || [];
}

function text(value) {
  return String(value ?? "").trim();
}

function teamName(team) {
  if (typeof team === "string") return text(team);
  return text(team?.name || team?.teamName || team?.short_name || team?.shortName);
}

function getHome(match) {
  return match?.home || match?.homeTeam || match?.team1 || match?.teamA;
}

function getAway(match) {
  return match?.away || match?.awayTeam || match?.team2 || match?.teamB;
}

function competition(match) {
  return text(match?.league || match?.seriesName || match?.series || match?.competition || match?.tournament || "Other");
}

function kickoff(match) {
  return match?.kickoff_utc || match?.date || match?.startTime || match?.startDate || "";
}

function normalize(value) {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

/*
 * The API can return the same fixture more than once with different IDs.
 * UUID/id is therefore NOT a safe deduplication key. A real fixture is
 * identified by the two teams, competition, and calendar date.
 */
function fixtureKey(match) {
  const home = normalize(teamName(getHome(match)));
  const away = normalize(teamName(getAway(match)));
  const comp = normalize(competition(match));
  const rawDate = kickoff(match);
  let day = normalize(rawDate).slice(0, 10);

  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) day = parsed.toISOString().slice(0, 10);
  }

  return `${home}|${away}|${day}|${comp}`;
}

function recordQuality(match) {
  const status = normalize(match?.status || match?.state || match?.matchStatus);
  let score = 0;
  if (status.includes("live") || status.includes("progress") || status.includes("in play")) score += 10000;
  else if (status.includes("complete") || status.includes("result") || status.includes("finish")) score += 5000;
  if (match?.score) score += 1000;
  if (match?.venue || match?.stadium || match?.ground) score += 100;
  if (match?.kickoff_utc || match?.date || match?.startTime || match?.startDate) score += 50;
  score += Object.keys(match || {}).length;
  return score;
}

function dedupeMatches(matches) {
  const unique = new Map();
  for (const match of matches) {
    const key = fixtureKey(match);
    if (!key || key.startsWith("|||")) continue;
    const existing = unique.get(key);
    if (!existing || recordQuality(match) > recordQuality(existing)) unique.set(key, match);
  }
  return [...unique.values()];
}

async function main() {
  const key = process.env.BBS_API_KEY;
  if (!key) throw new Error("BBS_API_KEY is required");

  const response = await fetch(`${BASE_URL}/matches`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${key}` }
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Cricket API returned non-JSON (${response.status}): ${responseText.slice(0, 300)}`);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?.message || `Cricket API returned ${response.status}`;
    throw new Error(String(message));
  }

  const matches = extractMatches(payload);
  const uniqueMatches = dedupeMatches(matches);
  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    sourceCount: matches.length,
    count: uniqueMatches.length,
    data: uniqueMatches
  };

  const outputPath = path.join(__dirname, "..", "public", "data", "matches.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`Fetched ${matches.length} cricket records`);
  console.log(`Deduplicated to ${uniqueMatches.length} unique fixtures`);
  console.log(`Wrote cricket data to ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
