require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  getMatches
} = require("../src/cricket-api");

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

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

async function main() {
  if (!process.env.BBS_API_KEY) {
    throw new Error("BBS_API_KEY is required");
  }

  const payload = await getMatches();
  const matches = extractMatches(payload);

  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    count: matches.length,
    data: matches
  };

  const outputPath = path.join(
    __dirname,
    "..",
    "public",
    "data",
    "matches.json"
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );

  console.log(`Fetched ${matches.length} cricket matches`);
  console.log(`Wrote cricket data to ${outputPath}`);

  if (matches.length === 0) {
    console.warn("The cricket API returned no match records.");
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
