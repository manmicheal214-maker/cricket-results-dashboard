```javascript
let matches = [];
let activeFilter = "all";

const $ = selector =>
  document.querySelector(selector);

const matchesEl = $("#matches");
const messageEl = $("#message");
const emptyEl = $("#empty");
const searchEl = $("#search");
const seriesEl = $("#series");
const modalEl = $("#modal");
const scorecardEl = $("#scorecard");


function value(obj, keys, fallback = "") {

  if (!obj || typeof obj !== "object") {
    return fallback;
  }

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null
    ) {
      return obj[key];
    }
  }

  return fallback;
}


function arrayValue(obj, keys) {

  for (const key of keys) {

    if (Array.isArray(obj?.[key])) {
      return obj[key];
    }

  }

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

  if (typeof team === "string") {
    return team;
  }

  return value(
    team,
    [
      "name",
      "short_name",
      "shortName",
      "title"
    ],
    "Team"
  );
}


function teams(match) {

  const direct =
    arrayValue(match, [
      "teams",
      "participants"
    ]);

  if (direct.length >= 2) {
    return {
      home: direct[0],
      away: direct[1]
    };
  }

  return {
    home:
      value(
        match,
        [
          "home",
          "home_team",
          "team1",
          "teamA"
        ],
        {}
      ),

    away:
      value(
        match,
        [
          "away",
          "away_team",
          "team2",
          "teamB"
        ],
        {}
      )
  };
}


function matchId(match) {

  return value(
    match,
    [
      "id",
      "match_id",
      "matchId",
      "key"
    ],
    ""
  );
}


function status(match) {

  const raw = String(
    value(
      match,
      [
        "status",
        "state",
        "match_status"
      ],
      ""
    )
  ).toLowerCase();

  if (
    raw.includes("live") ||
    raw.includes("progress") ||
    raw.includes("playing")
  ) {
    return "live";
  }

  if (
    raw.includes("complete") ||
    raw.includes("finished") ||
    raw.includes("final") ||
    raw.includes("result")
  ) {
    return "completed";
  }

  return "upcoming";
}


function seriesName(match) {

  const series =
    value(
      match,
      [
        "series",
        "competition",
        "league",
        "tournament"
      ],
      ""
    );

  return typeof series === "string"
    ? series
    : value(
        series,
        ["name", "title"],
        "Cricket"
      );
}


function scoreFor(match, side) {

  const scores =
    value(
      match,
      ["scores", "score"],
      {}
    );

  const score =
    value(
      scores,
      [side],
      ""
    );

  if (typeof score === "object") {

    const runs =
      value(
        score,
        ["runs", "score", "value"],
        ""
      );

    const wickets =
      value(
        score,
        ["wickets", "wkts"],
        ""
      );

    const overs =
      value(
        score,
        ["overs", "over"],
        ""
      );

    if (runs !== "") {

      let result =
        `${runs}/${wickets || 0}`;

      if (overs !== "") {
        result += ` (${overs})`;
      }

      return result;
    }
  }

  return score || "—";
}


function normalized(match) {

  const t = teams(match);

  return {
    id: matchId(match),

    home: teamName(t.home),

    away: teamName(t.away),

    series: seriesName(match),

    status: status(match),

    venue: value(
      match,
      ["venue", "ground", "stadium"],
      ""
    ),

    result: value(
      match,
      ["result", "outcome"],
      ""
    ),

    date: value(
      match,
      [
        "date",
        "start_time",
        "startTime",
        "kickoff_utc"
      ],
      ""
    ),

    homeScore:
      scoreFor(match, "home"),

    awayScore:
      scoreFor(match, "away")
  };
}


async function api(url) {

  const response =
    await fetch(url);

  const body =
    await response.json();

  if (!response.ok || !body.ok) {
    throw new Error(
      body.error ||
      "Request failed"
    );
  }

  return body.data;
}


async function load() {

  messageEl.textContent =
    "Loading cricket matches…";

  try {

    const data =
      await api("/api/matches");

    matches =
      Array.isArray(data)
        ? data
        : arrayValue(
            data,
            [
              "matches",
              "results",
              "items"
            ]
          );

    populateSeries();

    render();

    messageEl.textContent =
      `${matches.length} matches available`;

  } catch (error) {

    console.error(error);

    messageEl.textContent =
      `Unable to load matches: ${error.message}`;

    matches = [];

    render();
  }
}


function populateSeries() {

  const current =
    seriesEl.value;

  const names =
    [
      ...new Set(
        matches
          .map(m => normalized(m).series)
          .filter(Boolean)
      )
    ]
    .sort();

  seriesEl.innerHTML =
    `<option value="">
      All competitions
    </option>`;

  for (const name of names) {

    const option =
      document.createElement("option");

    option.value = name;
    option.textContent = name;

    seriesEl.appendChild(option);
  }

  seriesEl.value = current;
}


function filtered() {

  const query =
    searchEl.value
      .trim()
      .toLowerCase();

  const series =
    seriesEl.value;

  return matches
    .map(normalized)
    .filter(match => {

      const searchText =
        [
          match.home,
          match.away,
          match.series,
          match.venue,
          match.result
        ]
          .join(" ")
          .toLowerCase();

      const searchOk =
        !query ||
        searchText.includes(query);

      const filterOk =
        activeFilter === "all" ||
        match.status === activeFilter;

      const seriesOk =
        !series ||
        match.series === series;

      return (
        searchOk &&
        filterOk &&
        seriesOk
      );
    });
}


function render() {

  const list =
    filtered();

  matchesEl.innerHTML = "";

  emptyEl.classList.toggle(
    "hidden",
    list.length !== 0
  );

  for (const match of list) {

    matchesEl.insertAdjacentHTML(
      "beforeend",
      card(match)
    );
  }
}


function card(match) {

  const label =
    match.status === "live"
      ? "Live"
      : match.status === "completed"
        ? "Completed"
        : "Upcoming";

  const result =
    match.result
      ? escapeHtml(match.result)
      : match.status === "live"
        ? "Match in progress"
        : "";

  return `
    <article class="match">

      <div class="match-top">

        <span class="series-name">
          ${escapeHtml(match.series)}
        </span>

        <span class="badge ${match.status}">
          ${label}
        </span>

      </div>

      <div class="match-body">

        <div class="team-row">

          <div class="team">

            <span class="team-logo">
              🏏
            </span>

            ${escapeHtml(match.home)}

          </div>

          <strong class="score">
            ${escapeHtml(match.homeScore)}
          </strong>

        </div>


        <div class="team-row">

          <div class="team">

            <span class="team-logo">
              🏏
            </span>

            ${escapeHtml(match.away)}

          </div>

          <strong class="score">
            ${escapeHtml(match.awayScore)}
          </strong>

        </div>

        ${
          result
            ? `
              <div class="result">
                ${result}
              </div>
            `
            : ""
        }

      </div>

      <div class="match-bottom">

        <span>
          ${escapeHtml(
            match.venue || "Match details"
          )}
        </span>

        <button
          class="details"
          data-id="${escapeHtml(match.id)}"
        >
          Scorecard
        </button>

      </div>

    </article>
  `;
}


async function openScorecard(id) {

  modalEl.classList.remove("hidden");

  scorecardEl.innerHTML =
    `
      <div style="padding:60px;text-align:center">
        Loading full scorecard…
      </div>
    `;

  try {

    const [details, scorecard] =
      await Promise.all([
        api(
          `/api/matches/${encodeURIComponent(id)}`
        ),
        api(
          `/api/matches/${encodeURIComponent(id)}/scorecard`
        )
      ]);

    renderScorecard(
      details,
      scorecard
    );

  } catch (error) {

    console.error(error);

    scorecardEl.innerHTML =
      `
        <div style="padding:60px;text-align:center">
          <h2>Scorecard unavailable</h2>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
  }
}


function scorecardInnings(data) {

  return arrayValue(
    data,
    [
      "innings",
      "inningses",
      "scorecard",
      "cards"
    ]
  );
}


function battingRows(innings) {

  return arrayValue(
    innings,
    [
      "batting",
      "batters",
      "batsmen",
      "batter"
    ]
  );
}


function bowlingRows(innings) {

  return arrayValue(
    innings,
    [
      "bowling",
      "bowlers",
      "bowler"
    ]
  );
}


function playerName(row) {

  const player =
    value(
      row,
      [
        "player",
        "batter",
        "bowler"
      ],
      ""
    );

  if (typeof player === "string") {
    return player;
  }

  return value(
    player,
    [
      "name",
      "full_name",
      "fullName"
    ],
    value(
      row,
      ["name"],
      "Player"
    )
  );
}


function battingTable(rows) {

  if (!rows.length) {
    return "";
  }

  const html =
    rows.map(row => {

      const name =
        playerName(row);

      const dismissal =
        value(
          row,
          [
            "dismissal",
            "how_out",
            "howOut"
          ],
          ""
        );

      const runs =
        value(
          row,
          ["runs", "r"],
          "—"
        );

      const balls =
        value(
          row,
          ["balls", "b"],
          "—"
        );

      const fours =
        value(
          row,
          ["fours", "4s"],
          "—"
        );

      const sixes =
        value(
          row,
          ["sixes", "6s"],
          "—"
        );

      const sr =
        value(
          row,
          [
            "strike_rate",
            "strikeRate",
            "sr"
          ],
          "—"
        );

      return `
        <tr>

          <td>
            <span class="player">
              ${escapeHtml(name)}
            </span>

            ${
              dismissal
                ? `
                  <span class="dismissal">
                    ${escapeHtml(dismissal)}
                  </span>
                `
                : ""
            }
          </td>

          <td>${escapeHtml(runs)}</td>
          <td>${escapeHtml(balls)}</td>
          <td>${escapeHtml(fours)}</td>
          <td>${escapeHtml(sixes)}</td>
          <td>${escapeHtml(sr)}</td>

        </tr>
      `;

    }).join("");

  return `
    <div class="section-label">
      Batting
    </div>

    <div class="table-wrap">

      <table class="score-table">

        <thead>
          <tr>
            <th>Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>

        <tbody>
          ${html}
        </tbody>

      </table>

    </div>
  `;
}


function bowlingTable(rows) {

  if (!rows.length) {
    return "";
  }

  const html =
    rows.map(row => {

      const name =
        playerName(row);

      const overs =
        value(
          row,
          ["overs", "o"],
          "—"
        );

      const maidens =
        value(
          row,
          ["maidens", "m"],
          "—"
        );

      const runs =
        value(
          row,
          ["runs", "r"],
          "—"
        );

      const wickets =
        value(
          row,
          ["wickets", "w", "wkts"],
          "—"
        );

      const economy =
        value(
          row,
          ["economy", "econ"],
          "—"
        );

      return `
        <tr>

          <td>
            <span class="player">
              ${escapeHtml(name)}
            </span>
          </td>

          <td>${escapeHtml(overs)}</td>
          <td>${escapeHtml(maidens)}</td>
          <td>${escapeHtml(runs)}</td>
          <td>${escapeHtml(wickets)}</td>
          <td>${escapeHtml(economy)}</td>

        </tr>
      `;

    }).join("");

  return `
    <div class="section-label">
      Bowling
    </div>

    <div class="table-wrap">

      <table class="score-table">

        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>

        <tbody>
          ${html}
        </tbody>

      </table>

    </div>
  `;
}


function renderScorecard(
  details,
  data
) {

  const match =
    normalized(details || {});

  const innings =
    scorecardInnings(data);

  const title =
    match.home && match.away
      ? `${match.home} vs ${match.away}`
      : "Cricket Match";

  let inningsHtml = "";

  if (!innings.length) {

    inningsHtml =
      `
        <div class="innings">

          <div
            style="
              padding:35px;
              text-align:center;
              color:#5f6368
            "
          >
            The API did not return innings
            details for this match.
          </div>

        </div>
      `;

  } else {

    inningsHtml =
      innings.map(
        (inning, index) => {

          const team =
            value(
              inning,
              [
                "team",
                "batting_team",
                "battingTeam"
              ],
              {}
            );

          const teamLabel =
            typeof team === "string"
              ? team
              : value(
                  team,
                  ["name", "short_name"],
                  `Innings ${index + 1}`
                );

          const total =
            value(
              inning,
              [
                "total",
                "score",
                "runs"
              ],
              ""
            );

          const wickets =
            value(
              inning,
              [
                "wickets",
                "wkts"
              ],
              ""
            );

          const overs =
            value(
              inning,
              ["overs", "over"],
              ""
            );

          const extras =
            value(
              inning,
              ["extras"],
              ""
            );

          return `
            <section class="innings">

              <div class="innings-title">

                <span>
                  ${escapeHtml(teamLabel)}
                </span>

                <span>
                  ${escapeHtml(total)}
                  ${
                    wickets !== ""
                      ? `/${escapeHtml(wickets)}`
                      : ""
                  }
                  ${
                    overs !== ""
                      ? ` (${escapeHtml(overs)})`
                      : ""
                  }
                </span>

              </div>

              ${battingTable(
                battingRows(inning)
              )}

              ${
                extras !== ""
                  ? `
                    <div class="section-label">
                      Extras
                    </div>

                    <div
                      style="
                        padding:0 18px 18px;
                        color:#5f6368;
                        font-size:13px
                      "
                    >
                      ${escapeHtml(
                        typeof extras === "object"
                          ? JSON.stringify(extras)
                          : extras
                      )}
                    </div>
                  `
                  : ""
              }

              ${bowlingTable(
                bowlingRows(inning)
              )}

            </section>
          `;
        }
      ).join("");
  }

  scorecardEl.innerHTML =
    `
      <header class="score-header">

        <div class="competition">
          ${escapeHtml(match.series)}
        </div>

        <h2>
          ${escapeHtml(title)}
        </h2>

        ${
          match.venue
            ? `
              <p>
                📍 ${escapeHtml(match.venue)}
              </p>
            `
            : ""
        }

        ${
          match.result
            ? `
              <div class="score-result">
                ${escapeHtml(match.result)}
              </div>
            `
            : ""
        }

      </header>

      ${inningsHtml}
    `;
}


/* Navigation */

document
  .querySelectorAll(".nav-button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".nav-button")
          .forEach(
            b => b.classList.remove("active")
          );

        button.classList.add("active");

        activeFilter =
          button.dataset.filter;

        render();
      }
    );

  });


/* Search */

searchEl.addEventListener(
  "input",
  render
);


/* Series */

seriesEl.addEventListener(
  "change",
  render
);


/* Refresh */

$("#refresh").addEventListener(
  "click",
  load
);


/* Scorecard buttons */

matchesEl.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-id]"
      );

    if (!button) {
      return;
    }

    openScorecard(
      button.dataset.id
    );
  }
);


/* Close */

$("#close").addEventListener(
  "click",
  () => {
    modalEl.classList.add("hidden");
  }
);


modalEl.addEventListener(
  "click",
  event => {

    if (event.target === modalEl) {
      modalEl.classList.add("hidden");
    }

  }
);


document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {
      modalEl.classList.add("hidden");
    }

  }
);


/* Initial load */

load();


/* Automatic refresh every 2 minutes */

setInterval(
  load,
  120000
);
```
