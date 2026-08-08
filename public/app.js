const state = { matches: [], filter: "all", query: "", competition: "all" };
const $ = (selector) => document.querySelector(selector);

async function load() {
  const message = $("#message");
  const container = $("#matches");
  const empty = $("#empty");
  message.textContent = "Loading matches…";
  container.innerHTML = "";
  empty.classList.add("hidden");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL("data/matches.json?t=" + Date.now(), document.baseURI).href;
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Data request failed (${response.status})`);

    const text = await response.text();
    if (text.trim().startsWith("<")) throw new Error("The data URL returned HTML instead of JSON");

    const payload = JSON.parse(text);
    state.matches = Array.isArray(payload.data) ? payload.data : [];
    render();
  } catch (error) {
    clearTimeout(timeout);
    console.error(error);
    message.textContent = error.name === "AbortError"
      ? "Unable to load matches: request timed out"
      : `Unable to load matches: ${error.message}`;
    container.innerHTML = "";
    empty.classList.remove("hidden");
    empty.querySelector("h2").textContent = "Unable to load matches";
    empty.querySelector("p").textContent = "Check the GitHub Actions data update and try Refresh.";
  }
}

function normalize(value) { return String(value ?? "").toLowerCase(); }
function matchText(match) { return normalize(JSON.stringify(match)); }
function statusOf(match) {
  const value = normalize(match.status || match.state || match.matchStatus);
  if (value.includes("live") || value.includes("progress")) return "live";
  if (value.includes("complete") || value.includes("result") || value.includes("finished")) return "completed";
  return "upcoming";
}

function render() {
  const filtered = state.matches.filter((match) => {
    const status = statusOf(match);
    const competition = match.seriesName || match.series || match.competition || match.tournament || "Other";
    return (state.filter === "all" || status === state.filter) &&
      (state.competition === "all" || competition === state.competition) &&
      (!state.query || matchText(match).includes(normalize(state.query)));
  });

  $("#message").textContent = `${filtered.length} match${filtered.length === 1 ? "" : "es"}`;
  const container = $("#matches");
  const empty = $("#empty");

  if (filtered.length) {
    container.innerHTML = filtered.map(renderMatch).join("");
    empty.classList.add("hidden");
  } else {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    empty.querySelector("h2").textContent = "No matches found";
    empty.querySelector("p").textContent = "Try another search or filter.";
  }

  const competitions = [...new Set(state.matches.map(m => m.seriesName || m.series || m.competition || m.tournament).filter(Boolean))].sort();
  const select = $("#series");
  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="all">All competitions</option>' + competitions.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    select.value = competitions.includes(current) ? current : "all";
  }
}

function renderMatch(match) {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const home = match.homeTeam || teams[0] || match.team1 || match.teamA || "Team 1";
  const away = match.awayTeam || teams[1] || match.team2 || match.teamB || "Team 2";
  const score = match.score || match.result || match.status || "";
  const competition = match.seriesName || match.series || match.competition || match.tournament || "";
  const date = match.date || match.startTime || match.startDate || "";
  return `<article class="match-card"><div class="match-meta">${escapeHtml(competition)}${date ? ` · ${escapeHtml(formatDate(date))}` : ""}</div><div class="teams"><strong>${escapeHtml(teamName(home))}</strong><span>vs</span><strong>${escapeHtml(teamName(away))}</strong></div><div class="score">${escapeHtml(typeof score === "object" ? JSON.stringify(score) : score)}</div></article>`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function teamName(team) { return typeof team === "string" ? team : team?.name || team?.teamName || team?.shortName || "Team"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

$("#refresh")?.addEventListener("click", load);
$("#search")?.addEventListener("input", e => { state.query = e.target.value; render(); });
$("#series")?.addEventListener("change", e => { state.competition = e.target.value; render(); });
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
  render();
}));

load();
