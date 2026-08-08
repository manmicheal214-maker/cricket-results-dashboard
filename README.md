# 🏏 Cricket Results Dashboard

A Google-style cricket match centre with:

* Match results
* Live matches
* Upcoming matches
* Team search
* Competition filtering
* Full scorecards
* Batting statistics
* Bowling statistics
* Extras
* Innings totals
* Responsive mobile design
* Automatic refresh
* Server-side API-key protection
* Render one-click deployment
* Docker support

## Architecture

```text
                   ┌───────────────────┐
                   │      Browser      │
                   │  Cricket Dashboard│
                   └─────────┬─────────┘
                             │
                             ▼
                   ┌───────────────────┐
                   │   Node / Express  │
                   │      Backend      │
                   └─────────┬─────────┘
                             │
                       Bearer API Key
                             │
                             ▼
                   ┌───────────────────┐
                   │ Big Balls Cricket │
                   │       API         │
                   └───────────────────┘
```

The API key never reaches the browser.

## Requirements

* Node.js 18+
* A Big Balls Sports Data API key

The cricket API provides series, matches, individual match details and full innings scorecards. The advertised free tier is 1,000 requests/day, or 2,000/day with GitHub.

## Local installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/cricket-results-dashboard.git
```

Enter the project:

```bash
cd cricket-results-dashboard
```

Install dependencies:

```bash
npm install
```

Copy the environment file:

```bash
cp .env.example .env
```

Windows:

```cmd
copy .env.example .env
```

Edit `.env`:

```env
BBS_API_KEY=your_real_api_key
PORT=3000
```

Start:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Development

```bash
npm run dev
```

## GitHub

Create a repository named:

```text
cricket-results-dashboard
```

Then:

```bash
git init
git add .
git commit -m "Initial cricket results dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cricket-results-dashboard.git
git push -u origin main
```

Never commit `.env`.

The `.gitignore` file already excludes it.

## Deploy to Render

The repository contains:

```text
render.yaml
```

This allows Render to create the Node web service from the Blueprint.

In Render:

1. Create a new Blueprint.
2. Connect your GitHub repository.
3. Select `cricket-results-dashboard`.
4. Render reads `render.yaml`.
5. Enter your `BBS_API_KEY` when prompted.
6. Deploy.

The API key should remain a Render environment variable rather than being written into `render.yaml`. Render specifically recommends environment variables for secret credentials and supports `sync: false` for secrets in Blueprints.

## Health check

After deployment:

```text
/api/health
```

should return:

```json
{
  "ok": true,
  "service": "cricket-results-dashboard"
}
```

## API routes

```text
GET /api/health

GET /api/matches

GET /api/series

GET /api/matches/:id

GET /api/matches/:id/scorecard
```

## Scorecard

Selecting **Scorecard** on a match retrieves:

```text
Match
├── Competition
├── Venue
├── Result
│
├── Innings 1
│   ├── Batting
│   │   ├── Batter
│   │   ├── Runs
│   │   ├── Balls
│   │   ├── 4s
│   │   ├── 6s
│   │   └── Strike Rate
│   │
│   ├── Extras
│   └── Bowling
│       ├── Bowler
│       ├── Overs
│       ├── Maidens
│       ├── Runs
│       ├── Wickets
│       └── Economy
│
└── Innings 2
    └── ...
```

The cricket provider documents `/v1/cricket/matches/:id/scorecard` specifically as its full-innings scorecard endpoint.

## Security

Never put this in frontend code:

```javascript
const API_KEY = "bbs_live_...";
```

Instead:

```text
Browser
   ↓
/api/matches
   ↓
Express
   ↓
process.env.BBS_API_KEY
   ↓
Cricket API
```

API credentials are therefore kept server-side.

## Docker

Build:

```bash
docker build -t cricket-results-dashboard .
```

Run:

```bash
docker run \
  -p 3000:3000 \
  -e BBS_API_KEY=your_api_key \
  cricket-results-dashboard
```

Open:

```text
http://localhost:3000
```

## Future upgrades

The architecture is ready for:

* Team pages
* Player profiles
* Series pages
* Tournament pages
* Live ball-by-ball updates
* Points tables
* Team logos
* Player photos
* Favorites
* Dark mode
* PWA/mobile installation
* Push notifications
* Match sharing
* SEO-friendly match pages
* Cricket World Cup / IPL / BBL / PSL filters

## License

MIT

```
```
