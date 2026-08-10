(() => {
  const originalFetch = window.fetch.bind(window);

  async function staticMatches() {
    const url = new URL("data/matches.json", document.baseURI);
    url.searchParams.set("v", Date.now().toString());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await originalFetch(url.href, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Unable to load match data (${response.status})`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.startsWith("/api/") && !url.startsWith("./api/")) return originalFetch(input, init);
    const path = url.replace(/^\.\//, "");

    if (path === "api/matches") {
      try {
        const payload = await staticMatches();
        return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error.name === "AbortError" ? "Match data request timed out" : error.message }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }

    const match = path.match(/^api\/matches\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]); const payload = await staticMatches();
      const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.matches) ? payload.data.matches : [];
      const found = items.find(item => String(item.id ?? item.match_id ?? item.matchId ?? item.key) === id);
      return new Response(JSON.stringify({ ok: Boolean(found), data: found ?? null, error: found ? undefined : "Match not found" }), { status: found ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }

    const scorecard = path.match(/^api\/matches\/([^/]+)\/scorecard$/);
    if (scorecard) {
      const id = decodeURIComponent(scorecard[1]);
      const url = new URL(`data/scorecards/${encodeURIComponent(id)}.json`, document.baseURI);
      url.searchParams.set("v", Date.now().toString());
      try {
        const response = await originalFetch(url.href, { cache: "no-store" });
        if (!response.ok) return new Response(JSON.stringify({ ok: false, error: "Scorecard is not available for this match yet." }), { status: 404, headers: { "Content-Type": "application/json" } });
        return response;
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 502, headers: { "Content-Type": "application/json" } });
      }
    }

    return originalFetch(input, init);
  };
})();
