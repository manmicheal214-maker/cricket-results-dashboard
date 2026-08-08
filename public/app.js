let matches = [];
let activeFilter = "all";

const $ = selector => document.querySelector(selector);
const matchesEl = $("#matches");
const messageEl = $("#message");
const emptyEl = $("#empty");
const searchEl = $("#search");
const seriesEl = $("#series");

function value(obj, keys, fallback = "") {
  if (!obj || typeof obj !== "object") return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

function arrayValue(obj, keys) {
  for (const key of keys) if (Array.isArray(obj?.[key])) return obj[key];
  return [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function teamName(team) {
  if (typeof team === "string") return team;
  return value(team, ["name", "short_name", "shortName", "title"], "Team");
}

function teams(match) {
  const direct = arrayValue(match, ["teams", "participants"]);
  if (direct.length >= 2) return { home: direct[0], away: direct[1] };
  return {
    home: value(match, ["home", "home_team", "team1", "teamA"], {}),
    away: value(match, ["away", "away_team", "team2", "teamB"], {})
  };
}

function status(match) {
  const raw = String(value(match, ["status", "state", "match_status"], "")).toLowerCase();
  if (raw.includes("live") || raw.includes("progress") || raw.includes("playing")) return "live";
  if (raw.includes("complete") || raw.includes("finished") || raw.includes("final") || raw.includes("result")) return "completed";
  return "upcoming";
}

function seriesName(match) {
  const series = value(match, ["series", "competition", "league", "tournament"], "Cricket");
  return typeof series === "string" ? series : value(series, ["name", "title"], "Cricket");
}

function scoreFor(match, side) {
  const scores = value(match, ["scores", "score"], {});
  const score = value(scores, [side], "");
  if (typeof score === "object") {
    const runs = value(score, ["runs", "score", "value"], "");
    const wickets = value(score, ["wickets", "wkts"], "");
    const overs = value(score, ["overs", "over"], "");
    if (runs !== "") return `${runs}/${wickets || 0}${overs !== "" ? ` (${overs})` : ""}`;
  }
  return score || "—";
}

function normalized(match) {
  const t = teams(match);
  return {
    raw: match,
    id: value(match, ["id", "match_id", "matchId", "key"], crypto.randomUUID?.() || String(Math.random())),
    home: teamName(t.home),
    away: teamName(t.away),
    series: seriesName(match),
    status: status(match),
    venue: value(match, ["venue", "ground", "stadium"], ""),
    result: value(match, ["result", "outcome", "status_text"], ""),
    date: value(match, ["date", "start_time", "startTime", "kickoff_utc", "scheduled_at"], ""),
    homeScore: scoreFor(match, "home"),
    awayScore: scoreFor(match, "away")
  };
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? String(date) : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

async function api(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error || "Request failed");
  return body.data;
}

function populateSeries() {
  if (!seriesEl) return;
  const names = [...new Set(matches.map(m => m.series).filter(Boolean))].sort();
  seriesEl.innerHTML = '<option value="">All competitions</option>' + names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}

function render() {
  const query = (searchEl?.value || "").trim().toLowerCase();
  const series = seriesEl?.value || "";
  const filtered = matches.filter(match => {
    if (activeFilter !== "all" && match.status !== activeFilter) return false;
    if (series && match.series !== series) return false;
    if (query) {
      const haystack = [match.home, match.away, match.series, match.venue, match.result].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  if (!matchesEl) return;
  matchesEl.innerHTML = filtered.map(match => `
    <article class="match-card">
      <div class="match-meta">
        <span>${escapeHtml(match.series)}</span>
        <span class="status ${escapeHtml(match.status)}">${escapeHtml(match.status)}</span>
      </div>
      <div class="teams">
        <div><strong>${escapeHtml(match.home)}</strong><b>${escapeHtml(match.homeScore)}</b></div>
        <div><strong>${escapeHtml(match.away)}</strong><b>${escapeHtml(match.awayScore)}</b></div>
      </div>
      ${match.result ? `<div class="result">${escapeHtml(match.result)}</div>` : ""}
      ${match.venue || match.date ? `<div class="match-details">${escapeHtml(match.venue)}${match.venue && match.date ? " · " : ""}${escapeHtml(formatDate(match.date))}</div>` : ""}
    </article>
  `).join("");

  if (emptyEl) emptyEl.classList.toggle("hidden", filtered.length !== 0);
}

async function load() {
  messageEl.textContent = "Loading cricket matches…";
  try {
    const data = await api("/api/matches");
    const items = Array.isArray(data) ? data : arrayValue(data, ["matches", "results", "items"]);
    matches = items.map(normalized);
    populateSeries();
    render();
    messageEl.textContent = `${matches.length} matches available`;
  } catch (error) {
    console.error(error);
    matches = [];
    render();
    messageEl.textContent = `Unable to load matches: ${error.message}`;
  }
}

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
    render();
  });
});
searchEl?.addEventListener("input", render);
seriesEl?.addEventListener("change", render);
$("#refresh")?.addEventListener("click", load);

load();
