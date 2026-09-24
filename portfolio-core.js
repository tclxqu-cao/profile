(function initPortfolioCore(globalScope) {
  "use strict";

  const PUBLIC_COMMANDS = Object.freeze([
    { command: "/help", skill: "portfolio-help", label: "help" },
    { command: "/whoami", skill: "portfolio-whoami", label: "whoami" },
    { command: "/works", skill: "portfolio-works", label: "works" },
    { command: "/jobs", skill: "portfolio-jobs", label: "jobs" },
    { command: "/timeline", skill: "portfolio-timeline", label: "timeline" },
    { command: "/contact", skill: "portfolio-contact", label: "contact" },
  ]);

  const SKILLS_COMMANDS = Object.freeze(["/works", "/jobs"]);
  const COMMAND_SKILLS = Object.freeze(Object.fromEntries(
    PUBLIC_COMMANDS.map(({ command, skill }) => [command, skill]),
  ));
  const BLOCK_TYPES = new Set(["text", "image", "video", "html"]);
  const ALLOWED_HTML_TAGS = new Set([
    "ARTICLE", "SECTION", "DIV", "P", "H2", "H3", "H4", "UL", "OL", "LI",
    "DL", "DT", "DD", "STRONG", "EM", "B", "I", "CODE", "PRE", "A", "SPAN",
    "FIGURE", "FIGCAPTION", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "BR", "BUTTON",
  ]);
  const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM"]);
  const ALLOWED_HTML_CLASSES = new Set([
    "artifact", "artifact-grid", "artifact-flow", "artifact-flow-step", "artifact-flow-arrow",
    "artifact-kicker", "artifact-title", "artifact-meta", "artifact-list", "artifact-links",
    "t-lead", "t-dim", "t-hl", "t-out", "t-note", "t-quote", "t-ul", "t-cols", "t-tl",
    "t-year", "t-run", "t-group", "t-pipeline",
  ]);

  function createPageSessionId(randomSource) {
    if (!randomSource || typeof randomSource.getRandomValues !== "function") {
      throw new Error("Secure random values are required for a page session");
    }
    const bytes = new Uint8Array(16);
    randomSource.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function normalizeCommand(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const collapsed = raw.replace(/\s+/g, " ");
    const lowered = collapsed.toLowerCase();
    if (lowered === "/job" || lowered === "job") return "/jobs";
    if (lowered.startsWith("/project ")) {
      return `/project ${lowered.slice(9).trim().replace(/[^a-z0-9-]/g, "")}`;
    }
    if (lowered.startsWith("/")) {
      const separator = collapsed.indexOf(" ");
      const commandToken = separator < 0 ? lowered : lowered.slice(0, separator);
      const command = commandToken === "/job" ? "/jobs" : commandToken;
      const argumentsText = separator < 0 ? "" : collapsed.slice(separator + 1);
      return argumentsText ? `${command} ${argumentsText}` : command;
    }
    return collapsed;
  }

  function skillForInput(value) {
    const normalized = normalizeCommand(value);
    const command = normalized.split(" ", 1)[0];
    if (COMMAND_SKILLS[command]) return COMMAND_SKILLS[command];
    if (normalized.startsWith("/project ")) {
      const projectId = normalized.slice(9);
      return projectId ? `portfolio-project-${projectId}` : "";
    }
    if (normalized.startsWith("/")) return "portfolio-help";
    return null;
  }

  function isSafeMediaUrl(value) {
    if (typeof value !== "string" || !value || value.includes("\\")) return false;
    if (/^https:\/\//i.test(value)) return true;
    if (/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i.test(value)) return true;
    return /^(?:\/)?assets\/[a-zA-Z0-9_./-]+$/.test(value)
      && !value.split("/").includes("..");
  }

  function isSafeLink(value) {
    if (typeof value !== "string") return false;
    const href = value.trim();
    return /^(?:https?:\/\/|mailto:|#|\/)/i.test(href)
      && !/^(?:javascript|data|vbscript):/i.test(href);
  }

  function isSafeArtifactCommand(value) {
    return typeof value === "string"
      && /^\/(?:help|whoami|works|jobs|timeline|contact|project [a-z0-9-]+)$/i.test(value);
  }

  function validateArtifact(value, expectedSkill) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (value.schemaVersion !== 1 || typeof value.skill !== "string") return null;
    if (!/^portfolio-[a-z0-9-]+$/.test(value.skill)) return null;
    if (expectedSkill && value.skill !== expectedSkill) return null;
    if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160) return null;
    if (!Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > 24) return null;

    const blocks = [];
    for (const item of value.blocks) {
      if (!item || typeof item !== "object" || !BLOCK_TYPES.has(item.type)) return null;
      if (item.type === "text") {
        if (typeof item.text !== "string" || !item.text || item.text.length > 24000) return null;
        blocks.push({ type: "text", text: item.text, tone: String(item.tone || "body") });
        continue;
      }
      if (item.type === "html") {
        if (typeof item.html !== "string" || !item.html || item.html.length > 80000) return null;
        blocks.push({ type: "html", html: item.html });
        continue;
      }
      if (!isSafeMediaUrl(item.src)) return null;
      const media = { type: item.type, src: item.src, alt: String(item.alt || value.title) };
      if (item.type === "video" && item.poster && isSafeMediaUrl(item.poster)) media.poster = item.poster;
      if (typeof item.caption === "string" && item.caption.trim()) media.caption = item.caption.trim().slice(0, 500);
      blocks.push(media);
    }

    return {
      schemaVersion: 1,
      skill: value.skill,
      title: value.title.trim(),
      summary: typeof value.summary === "string" ? value.summary : "",
      blocks,
      suggestions: Array.isArray(value.suggestions)
        ? value.suggestions.filter((item) => typeof item === "string" && item.startsWith("/")).slice(0, 8)
        : [],
      sources: Array.isArray(value.sources)
        ? value.sources.filter((item) => typeof item === "string").slice(0, 12)
        : [],
      generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
      fallback: value.fallback === true,
      cached: value.cached === true,
      notice: typeof value.notice === "string" ? value.notice : "",
      flow_id: typeof value.flow_id === "string" ? value.flow_id : "homepage-main",
    };
  }

  function snapshotArtifact(snapshot, skill) {
    const artifacts = snapshot && typeof snapshot === "object"
      ? (snapshot.artifacts || snapshot)
      : {};
    return validateArtifact(artifacts[skill], skill);
  }

  function resolveAssetUrl(value, assetBaseUrl) {
    if (!value || /^https?:\/\//i.test(value)) return value;
    const base = String(assetBaseUrl || "").replace(/\/$/, "");
    const path = String(value).replace(/^\//, "");
    return base ? `${base}/${path}` : path;
  }

  function sanitizeHtmlToFragment(html, ownerDocument) {
    const documentRef = ownerDocument || globalScope.document;
    if (!documentRef || typeof globalScope.DOMParser !== "function") {
      throw new Error("DOMParser is required to sanitize HTML");
    }
    const parsed = new globalScope.DOMParser().parseFromString(String(html || ""), "text/html");
    const output = documentRef.createDocumentFragment();

    function cleanNode(node, destination) {
      if (node.nodeType === 3) {
        destination.appendChild(documentRef.createTextNode(node.nodeValue || ""));
        return;
      }
      if (node.nodeType !== 1 || DROP_WITH_CONTENT.has(node.tagName)) return;
      if (!ALLOWED_HTML_TAGS.has(node.tagName)) {
        Array.from(node.childNodes).forEach((child) => cleanNode(child, destination));
        return;
      }
      const clean = documentRef.createElement(node.tagName.toLowerCase());
      const classes = (node.getAttribute("class") || "").split(/\s+/)
        .filter((name) => ALLOWED_HTML_CLASSES.has(name));
      if (classes.length) clean.setAttribute("class", classes.join(" "));
      if (node.tagName === "A") {
        const href = node.getAttribute("href") || "";
        if (isSafeLink(href)) clean.setAttribute("href", href);
        clean.setAttribute("target", "_blank");
        clean.setAttribute("rel", "noopener noreferrer");
      }
      if (node.tagName === "BUTTON") {
        const command = node.getAttribute("data-command") || "";
        if (!isSafeArtifactCommand(command)) return;
        clean.setAttribute("type", "button");
        clean.setAttribute("data-command", command);
        const label = node.getAttribute("aria-label");
        if (label) clean.setAttribute("aria-label", label.slice(0, 200));
      }
      const title = node.getAttribute("title");
      if (title) clean.setAttribute("title", title.slice(0, 200));
      Array.from(node.childNodes).forEach((child) => cleanNode(child, clean));
      destination.appendChild(clean);
    }

    Array.from(parsed.body.childNodes).forEach((node) => cleanNode(node, output));
    return output;
  }

  const api = Object.freeze({
    PUBLIC_COMMANDS,
    SKILLS_COMMANDS,
    COMMAND_SKILLS,
    createPageSessionId,
    normalizeCommand,
    skillForInput,
    isSafeMediaUrl,
    isSafeLink,
    isSafeArtifactCommand,
    validateArtifact,
    snapshotArtifact,
    resolveAssetUrl,
    sanitizeHtmlToFragment,
  });

  globalScope.PortfolioCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
