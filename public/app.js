const state = { matches: [], filter: "all", query: "", competition: "all" };
const $ = (selector) => document.querySelector(selector);

async function load() {
  const message = $("#message"), container = $("#matches"), empty = $("#empty");
  message.textContent = "Loading matches…"; container.innerHTML = ""; empty.classList.add("hidden");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
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
    clearTimeout(timeout); console.error(error);
    message.textContent = error.name === "AbortError" ? "Unable to load matches: request timed out" : `Unable to load matches: ${error.message}`;
    container.innerHTML = ""; empty.classList.remove("hidden");
    empty.querySelector("h2").textContent = "Unable to load matches";
    empty.querySelector("p").textContent = "Check the GitHub Actions data update and try Refresh.";
  }
}

function normalize(value) { return String(value ?? "").toLowerCase(); }
function matchText(match) { return normalize(JSON.stringify(match)); }
function statusOf(match) {
  const value = normalize(match.status || match.state || match.matchStatus);
  if (value.includes("live") || value.includes("progress")) return "live";
  if (value.includes("complete") || value.includes("result") || value.includes("finish")) return "completed";
  return "upcoming";
}
function teamName(team) { return typeof team === "string" ? team : team?.name || team?.teamName || team?.short_name || team?.shortName || "Team"; }
function scoreText(match) {
  if (match.score == null) return match.status || "Scheduled";
  if (typeof match.score === "object") {
    const h = match.score.home, a = match.score.away;
    return `${h ?? "-"} – ${a ?? "-"}`;
  }
  return String(match.score);
}
function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

function render() {
  const filtered = state.matches.filter(match => {
    const status = statusOf(match);
    const competition = match.league || match.seriesName || match.series || match.competition || match.tournament || "Other";
    return (state.filter === "all" || status === state.filter) &&
      (state.competition === "all" || competition === state.competition) &&
      (!state.query || matchText(match).includes(normalize(state.query)));
  });
  $("#message").textContent = `${filtered.length} match${filtered.length === 1 ? "" : "es"}`;
  const container = $("#matches"), empty = $("#empty");
  if (filtered.length) { container.innerHTML = filtered.map(renderMatch).join(""); empty.classList.add("hidden"); }
  else { container.innerHTML = ""; empty.classList.remove("hidden"); empty.querySelector("h2").textContent = "No matches found"; empty.querySelector("p").textContent = "Try another search or filter."; }
  const competitions = [...new Set(state.matches.map(m => m.league || m.seriesName || m.series || m.competition || m.tournament).filter(Boolean))].sort();
  const select = $("#series");
  if (select) { const current = select.value; select.innerHTML = '<option value="all">All competitions</option>' + competitions.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(""); select.value = competitions.includes(current) ? current : "all"; }
}

function renderMatch(match) {
  const home = match.home || match.homeTeam || match.team1 || match.teamA;
  const away = match.away || match.awayTeam || match.team2 || match.teamB;
  const competition = match.league || match.seriesName || match.series || match.competition || match.tournament || "Cricket";
  const date = match.kickoff_utc || match.date || match.startTime || match.startDate;
  const status = match.status || "scheduled";
  const score = scoreText(match);
  const homeLogo = typeof home === "object" ? home.logo_url : "";
  const awayLogo = typeof away === "object" ? away.logo_url : "";
  return `<article class="match-card"><div class="match-meta"><span>${escapeHtml(competition)}</span><span>${escapeHtml(status)}</span>${date ? `<span>${escapeHtml(formatDate(date))}</span>` : ""}</div><div class="teams"><div class="team">${homeLogo ? `<img src="${escapeHtml(homeLogo)}" alt="">` : ""}<strong>${escapeHtml(teamName(home))}</strong></div><span>vs</span><div class="team">${awayLogo ? `<img src="${escapeHtml(awayLogo)}" alt="">` : ""}<strong>${escapeHtml(teamName(away))}</strong></div></div><div class="score">${escapeHtml(score)}</div></article>`;
}

$("#refresh")?.addEventListener("click", load);
$("#search")?.addEventListener("input", e => { state.query = e.target.value; render(); });
$("#series")?.addEventListener("change", e => { state.competition = e.target.value; render(); });
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { state.filter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button)); render(); }));
load();
