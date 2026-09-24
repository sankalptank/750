// AI summary endpoint for /750 — runs on Cloudflare Workers (free tier is plenty).
// Secrets to set:  ANTHROPIC_API_KEY, FIREBASE_API_KEY (same "apiKey" as in index.html), ALLOWED_EMAILS (comma-separated)
// Vars to set:     ALLOWED_ORIGIN = https://sankalptank.com
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    // 1. Verify the Firebase ID token with Google (no key parsing needed).
    const idToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!idToken) return new Response("Missing token", { status: 401, headers: cors });
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    if (!v.ok) return new Response("Bad token", { status: 401, headers: cors });
    const { users } = await v.json();
    const email = users?.[0]?.email;
    const allowed = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!email || (allowed.length && !allowed.includes(email))) return new Response("Not allowed", { status: 403, headers: cors });

    // 2. Summarize.
    const { text, date } = await req.json();
    if (!text || text.length > 60000) return new Response("Bad input", { status: 400, headers: cors });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-4-6",
        max_tokens: 600,
        system: "You summarize a private daily free-writing entry for the person who wrote it. Write 3-6 sentences in second person, plain and warm, no headers or bullet points. Name the main threads, the mood, and anything they seemed to decide or resolve. Do not moralize or give advice unless they asked themselves a question, in which case you may reflect it back.",
        messages: [{ role: "user", content: `Entry from ${date}:\n\n${text}` }],
      }),
    });
    if (!r.ok) return new Response("Model error: " + (await r.text()), { status: 502, headers: cors });
    const data = await r.json();
    const summary = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return new Response(JSON.stringify({ summary }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
