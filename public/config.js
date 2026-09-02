(() => {
  // GitHub Pages hosts the frontend; Render hosts the API and keeps the
  // Big Balls API key server-side. Local/Render-hosted pages use same-origin.
  const hostname = window.location.hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const isRender = hostname.endsWith(".onrender.com");

  window.API_BASE_URL = isLocal || isRender
    ? ""
    : "https://cricket-results-dashboard.onrender.com";
})();
