(() => {
  // GitHub Pages hosts the frontend; Render hosts the live API and keeps the
  // Big Balls API key server-side. If the Render service is temporarily
  // unreachable, app.js can fall back to the GitHub Pages data snapshot.
  const hostname = window.location.hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const isRender = hostname.endsWith(".onrender.com");

  window.API_BASE_URL = isLocal || isRender
    ? ""
    : "https://cricket-results-dashboard.onrender.com";
})();
