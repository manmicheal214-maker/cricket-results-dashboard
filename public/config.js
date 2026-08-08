(() => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (!url.startsWith("/api/") && !url.startsWith("./api/")) {
      return originalFetch(input, init);
    }

    const path = url.replace(/^\.\//, "");
    const response = await originalFetch("./data/matches.json", init);
    const payload = await response.json();

    if (path === "api/matches") {
      return new Response(JSON.stringify(payload), {
        status: response.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const match = path.match(/^api\/matches\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const items = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.matches)
          ? payload.data.matches
          : [];
      const found = items.find(item => String(item.id ?? item.match_id ?? item.matchId ?? item.key) === id);

      return new Response(JSON.stringify({ ok: Boolean(found), data: found ?? null, error: found ? undefined : "Match not found" }), {
        status: found ? 200 : 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (path.match(/^api\/matches\/[^/]+\/scorecard$/)) {
      return new Response(JSON.stringify({ ok: false, error: "Scorecards are not included in the static GitHub Pages dataset yet." }), {
        status: 501,
        headers: { "Content-Type": "application/json" }
      });
    }

    return originalFetch(input, init);
  };
})();
