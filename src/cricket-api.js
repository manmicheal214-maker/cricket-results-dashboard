```javascript
const BASE_URL = "https://api.bigballsdata.com/v1/cricket";

function headers() {
  const key = process.env.BBS_API_KEY;

  if (!key) {
    throw new Error("BBS_API_KEY is not configured");
  }

  return {
    Accept: "application/json",
    Authorization: `Bearer ${key}`
  };
}

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: headers()
  });

  const text = await response.text();

  let body;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text };
  }

  if (!response.ok) {
    const message =
      body?.error?.message ||
      body?.error ||
      body?.message ||
      `Cricket API returned ${response.status}`;

    throw new Error(message);
  }

  return body;
}

function unwrap(payload) {
  return payload?.data ?? payload;
}

async function getMatches() {
  return request("/matches");
}

async function getMatch(id) {
  return request(`/matches/${encodeURIComponent(id)}`);
}

async function getScorecard(id) {
  return request(
    `/matches/${encodeURIComponent(id)}/scorecard`
  );
}

async function getSeries() {
  return request("/series");
}

module.exports = {
  request,
  unwrap,
  getMatches,
  getMatch,
  getScorecard,
  getSeries
};
```
