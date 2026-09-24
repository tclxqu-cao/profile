/* Vercel Node function. Both values are server-side environment variables. */
function safeMediaUrl(value) {
  return typeof value === "string" && (
    /^https:\/\//i.test(value)
    || (/^(?:\/)?assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split("/").includes(".."))
  );
}

const PAGE_SESSION_ID = /^[a-f0-9]{32}$/;
const FLOW_TIMEOUT_MS = 300000;

function validArtifact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.schemaVersion !== 1 || typeof value.skill !== "string") return false;
  if (!/^portfolio-[a-z0-9-]+$/.test(value.skill)) return false;
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160) return false;
  if (!Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > 24) return false;
  return value.blocks.every((block) => {
    if (!block || typeof block !== "object") return false;
    if (block.type === "text") return typeof block.text === "string" && block.text.length > 0 && block.text.length <= 24000;
    if (block.type === "html") {
      return typeof block.html === "string" && block.html.length > 0 && block.html.length <= 80000
        && !/<\s*(?:script|iframe|object|embed|form|style|link|meta)\b|\son\w+\s*=|javascript:/i.test(block.html);
    }
    if (block.type === "image") return safeMediaUrl(block.src);
    if (block.type === "video") return safeMediaUrl(block.src) && (!block.poster || safeMediaUrl(block.poster));
    return false;
  });
}

module.exports = async function command(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const endpoint = process.env.HOMEPAGE_FLOW_URL;
  const token = process.env.FLOW_HOMEPAGE_TOKEN;
  if (!endpoint || !token) return res.status(503).json({ error: "flow_not_configured" });
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: "invalid_message" }); }
  if (typeof body?.message !== "string" || !body.message.trim() || body.message.length > 2000) {
    return res.status(400).json({ error: "invalid_message" });
  }
  if (body.sessionId !== undefined
      && (typeof body.sessionId !== "string" || !PAGE_SESSION_ID.test(body.sessionId))) {
    return res.status(400).json({ error: "invalid_session" });
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) {
      return res.status(503).json({ error: "invalid_flow_url" });
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        message: body.message,
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      }),
      signal: AbortSignal.timeout(FLOW_TIMEOUT_MS),
      redirect: "error",
    });
    if (!response.ok) return res.status(502).json({ error: "flow_unavailable" });
    const data = await response.json();
    if (!validArtifact(data)) return res.status(502).json({ error: "flow_unavailable" });
    return res.status(200).json(data);
  } catch {
    return res.status(502).json({ error: "flow_unavailable" });
  }
};

module.exports.validArtifact = validArtifact;
