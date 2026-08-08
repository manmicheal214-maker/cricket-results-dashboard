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

async function main() {
  const key = process.env.BBS_API_KEY;
  if (!key) throw new Error("BBS_API_KEY is required");

  const response = await fetch(`${BASE_URL}/matches`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${key}`
    }
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Cricket API returned non-JSON (${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?.message || `Cricket API returned ${response.status}`;
    throw new Error(String(message));
  }

  const matches = extractMatches(payload);
  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    count: matches.length,
    data: matches
  };

  const outputPath = path.join(__dirname, "..", "public", "data", "matches.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`Fetched ${matches.length} cricket matches`);
  console.log(`Wrote cricket data to ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
