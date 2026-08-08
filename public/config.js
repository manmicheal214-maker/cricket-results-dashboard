/*
 * GitHub Pages is static, so API requests need to go to the
 * separately deployed Render backend.
 */
const API_BASE = "https://cricket-results-dashboard.onrender.com";

const originalFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;

  if (url.startsWith("/api/")) {
    const target = `${API_BASE}${url}`;

    if (typeof input === "string") {
      return originalFetch(target, init);
    }

    return originalFetch(
      new Request(target, input),
      init
    );
  }

  return originalFetch(input, init);
};
