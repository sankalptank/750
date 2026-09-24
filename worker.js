// AI summary endpoint for /750 — runs on Cloudflare Workers (free tier is plenty).
// Secrets to set:  ANTHROPIC_API_KEY, FIREBASE_API_KEY (same "apiKey" as in index.html), ALLOWED_EMAILS (comma-separated)
// Vars to set:     ALLOWED_ORIGIN = https://sankalptank.com  (comma-separate several; www. is accepted automatically)
export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowedOrigins = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const originOk = !allowedOrigins.length || allowedOrigins.some((o) => origin === o || origin === o.replace("://", "://www."));
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin || "*" : allowedOrigins[0],
      "Vary": "Origin",
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

    // 2. Summarize one day, or a week/month of entries.
    const body = await req.json();
    let { kind = "day", label = "", entries } = body;
    if (!entries && body.text) entries = [{ date: body.date, text: body.text }]; // older page versions
    if (!Array.isArray(entries) || !entries.length) return new Response("Bad input", { status: 400, headers: cors });
    const total = entries.reduce((a, e) => a + (e.text || "").length, 0);
    if (total > 400000) return new Response("Too much text for one summary", { status: 400, headers: cors });

    const SYSTEM = {
      day: "You summarize a private daily free-writing entry for the person who wrote it. Write 3-6 sentences in second person, plain and warm, no headers or bullet points. Name the main threads, the mood, and anything they seemed to decide or resolve. Do not moralize or give advice unless they asked themselves a question, in which case you may reflect it back.",
      week: "You summarize a week of private daily free-writing for the person who wrote it. Write two or three short paragraphs in second person, plain and warm, no headers or bullet points. Cover: the threads that came up more than once, how the mood moved across the week, anything they decided, started, or dropped, and one question or tension that was still open by the end. Refer to days by weekday name when it helps. Do not moralize or give advice.",
      month: "You summarize a month of private daily free-writing for the person who wrote it. Write three or four short paragraphs in second person, plain and warm, no headers or bullet points. Cover: the two or three things that dominated the month, how they changed from the start to the end, what got resolved and what didn't, recurring people or places, and the overall arc of mood. Mention rough dates ('early in the month', 'around the 20th') rather than listing days. Do not moralize or give advice.",
    }[kind] || null;
    if (!SYSTEM) return new Response("Bad kind", { status: 400, headers: cors });

    const content = entries.map((e) => `=== ${e.date} ===\n${e.text}`).join("\n\n");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-4-6",
        max_tokens: kind === "day" ? 600 : 1400,
        system: SYSTEM,
        messages: [{ role: "user", content: `${label ? label + "\n\n" : ""}${content}` }],
      }),
    });
    if (!r.ok) return new Response("Model error: " + (await r.text()), { status: 502, headers: cors });
    const data = await r.json();
    const summary = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return new Response(JSON.stringify({ summary }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
