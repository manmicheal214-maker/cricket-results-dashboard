const state = {
  matches: [],
  filter: "all",
  query: "",
  competition: "all"
};

const $ = (selector) => document.querySelector(selector);

function siteBase() {
  const path = window.location.pathname;
  const marker = "/cricket-results-dashboard/";
  const index = path.indexOf(marker);
  return index >= 0 ? path.slice(0, index + marker.length) : "/";
}

async function load() {
  const status = $("#status");
  const container = $("#matches");

  status.textContent = "Loading matches…";
  container.innerHTML = "";

  try {
    const url = `${siteBase()}data/matches.json?t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Data request failed (${response.status})`);
    }

    const text = await response.text();
    if (text.trim().startsWith("<")) {
      throw new Error(`Data file not found at ${url}`);
    }

    const payload = JSON.parse(text);
    state.matches = Array.isArray(payload.data) ? payload.data : [];

    render();
  } catch (error) {
    console.error(error);
    status.textContent = `Unable to load matches: ${error.message}`;
    container.innerHTML = "<div class=\"empty\">Check the GitHub Actions data update and try Refresh.</div>";
  }
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function matchText(match) {
  return normalize(JSON.stringify(match));
}

function statusOf(match) {
  const value = normalize(match.status || match.state || match.matchStatus);
  if (value.includes("live") || value.includes("progress")) return "live";
  if (value.includes("complete") || value.includes("result") || value.includes("finished")) return "result";
  return "upcoming";
}

function render() {
  const filtered = state.matches.filter((match) => {
    const status = statusOf(match);
    const competition = match.seriesName || match.series || match.competition || match.tournament || "Other";
    const matchesCompetition = state.competition === "all" || competition === state.competition;
    const matchesFilter = state.filter === "all" || status === state.filter;
    const matchesQuery = !state.query || matchText(match).includes(normalize(state.query));
    return matchesCompetition && matchesFilter && matchesQuery;
  });

  $("#status").textContent = `${filtered.length} match${filtered.length === 1 ? "" : "es"}`;
  $("#matches").innerHTML = filtered.length
    ? filtered.map(renderMatch).join("")
    : '<div class="empty">No matches found.</div>';

  const competitions = [...new Set(state.matches.map(m => m.seriesName || m.series || m.competition || m.tournament).filter(Boolean))].sort();
  const select = $("#competition");
  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="all">All competitions</option>' + competitions.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    select.value = competitions.includes(current) ? current : "all";
  }
}

function renderMatch(match) {
  const teams = match.teams || [];
  const home = match.homeTeam || teams[0] || match.team1 || match.teamA || "Team 1";
  const away = match.awayTeam || teams[1] || match.team2 || match.teamB || "Team 2";
  const score = match.score || match.result || match.status || "";
  const competition = match.seriesName || match.series || match.competition || match.tournament || "";
  const date = match.date || match.startTime || match.startDate || "";

  return `<article class="match-card">
    <div class="match-meta">${escapeHtml(competition)}${date ? ` · ${escapeHtml(new Date(date).toLocaleString())}` : ""}</div>
    <div class="teams"><strong>${escapeHtml(teamName(home))}</strong><span>vs</span><strong>${escapeHtml(teamName(away))}</strong></div>
    <div class="score">${escapeHtml(typeof score === "object" ? JSON.stringify(score) : score)}</div>
  </article>`;
}

function teamName(team) {
  if (typeof team === "string") return team;
  return team?.name || team?.teamName || team?.shortName || "Team";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

$("#refresh")?.addEventListener("click", load);
$("#search")?.addEventListener("input", e => { state.query = e.target.value; render(); });
$("#competition")?.addEventListener("change", e => { state.competition = e.target.value; render(); });

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
    render();
  });
});

load();
