require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  unwrap,
  getMatches
} = require("../src/cricket-api");

async function main() {
  if (!process.env.BBS_API_KEY) {
    throw new Error("BBS_API_KEY is required");
  }

  const payload = await getMatches();
  const data = unwrap(payload);

  const output = {
    ok: true,
    updatedAt: new Date().toISOString(),
    data
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

  console.log(`Wrote cricket data to ${outputPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
