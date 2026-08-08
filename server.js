```javascript
require("dotenv").config();

const express = require("express");
const path = require("path");

const {
  unwrap,
  getMatches,
  getMatch,
  getScorecard,
  getSeries
} = require("./src/cricket-api");

const app = express();

const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public"),
    {
      maxAge: process.env.NODE_ENV === "production"
        ? "1h"
        : 0
    }
  )
);


/* Health */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "cricket-results-dashboard",
    timestamp: new Date().toISOString()
  });
});


/* Matches */

app.get("/api/matches", async (req, res) => {
  try {
    const payload = await getMatches();

    res.json({
      ok: true,
      data: unwrap(payload)
    });
  } catch (error) {
    console.error(error);

    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});


/* Series */

app.get("/api/series", async (req, res) => {
  try {
    const payload = await getSeries();

    res.json({
      ok: true,
      data: unwrap(payload)
    });
  } catch (error) {
    console.error(error);

    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});


/* Match detail */

app.get("/api/matches/:id", async (req, res) => {
  try {
    const payload =
      await getMatch(req.params.id);

    res.json({
      ok: true,
      data: unwrap(payload)
    });
  } catch (error) {
    console.error(error);

    res.status(502).json({
      ok: false,
      error: error.message
    });
  }
});


/* Full scorecard */

app.get(
  "/api/matches/:id/scorecard",
  async (req, res) => {
    try {
      const payload =
        await getScorecard(req.params.id);

      res.json({
        ok: true,
        data: unwrap(payload)
      });
    } catch (error) {
      console.error(error);

      res.status(502).json({
        ok: false,
        error: error.message
      });
    }
  }
);


/* Frontend fallback */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Cricket dashboard running on port ${PORT}`
  );
});
```
