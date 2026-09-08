const BASE_URL = "https://api.bigballsdata.com/v1/cricket";
const STORED_URL = "https://api.bigballsdata.com/v1/stored/matches";

function headers() {
  const key = process.env.BBS_API_KEY;
  if (!key) throw new Error("BBS_API_KEY is not configured");
  return { Accept: "application/json", Authorization: `Bearer ${key}` };
}
async function request(path, base = BASE_URL) {
  const response = await fetch(`${base}${path}`, { headers: headers() });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) throw new Error(String(body?.error?.message || body?.error || body?.message || `Cricket API returned ${response.status}`));
  return body;
}
function unwrap(payload) { return payload?.data ?? payload; }
async function getMatches({ status, limit = 50 } = {}) {
  const params = new URLSearchParams(); if (status) params.set("status", status); params.set("limit", String(Math.min(Math.max(limit, 1), 200))); return request(`/matches?${params.toString()}`);
}
async function getStoredMatches({ status, limit = 200, date } = {}) {
  const params = new URLSearchParams({ sport: "cricket", limit: String(Math.min(Math.max(limit, 1), 200)) }); if (status) params.set("status", status); if (date) params.set("date", date); return request(`?${params.toString()}`, STORED_URL);
}
async function getMatch(id) { return request(`/matches/${encodeURIComponent(id)}`); }
async function getScorecard(id) { return request(`/matches/${encodeURIComponent(id)}/scorecard`); }
async function getSeries() { return request("/series"); }
module.exports = { request, unwrap, getMatches, getStoredMatches, getMatch, getScorecard, getSeries };
