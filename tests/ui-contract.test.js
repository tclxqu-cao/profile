const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../portfolio-core.js");

const root = path.resolve(__dirname, "..");

test("public registry keeps skills as a group over works and jobs", () => {
  assert.deepEqual(core.PUBLIC_COMMANDS.map((item) => item.command), [
    "/help", "/whoami", "/works", "/jobs", "/timeline", "/contact",
  ]);
  assert.deepEqual(core.SKILLS_COMMANDS, ["/works", "/jobs"]);
  assert.equal(core.PUBLIC_COMMANDS.some((item) => item.command === "/skills"), false);
});

test("page session ids are random UUID-shaped values kept by the page runtime", () => {
  const first = core.createPageSessionId({
    getRandomValues(bytes) { bytes.fill(0); return bytes; },
  });
  const second = core.createPageSessionId({
    getRandomValues(bytes) { bytes.fill(255); return bytes; },
  });
  assert.equal(first, "00000000000040008000000000000000");
  assert.equal(second, "ffffffffffff4fffbfffffffffffffff");
  assert.notEqual(first, second);
});

test("normalizes aliases and resolves only deterministic slash skills", () => {
  assert.equal(core.normalizeCommand(" /JOB "), "/jobs");
  assert.equal(core.normalizeCommand(" /JOB 生成一个表格吧 "), "/jobs 生成一个表格吧");
  assert.equal(core.normalizeCommand("/project AgentRoam"), "/project agentroam");
  assert.equal(core.skillForInput("/jobs 生成一个表格吧"), "portfolio-jobs");
  assert.equal(core.skillForInput("/works 按技术栈分组"), "portfolio-works");
  assert.equal(core.skillForInput("工作"), null);
  assert.equal(core.skillForInput("最近有什么招聘岗位"), null);
  assert.equal(core.skillForInput("经理工作经验"), null);
  assert.equal(core.skillForInput("GitHub 联系方式"), null);
  assert.equal(core.skillForInput("介绍一下 Flow Studio"), null);
  assert.equal(core.skillForInput("我靠"), null);
  assert.equal(core.skillForInput("今天天气怎么样"), null);
  assert.equal(core.skillForInput("/not-a-command"), "portfolio-help");
  assert.equal(core.skillForInput("/not-a-command 工作"), "portfolio-help");
});

test("validates every artifact block type and rejects unsafe media", () => {
  const value = core.validateArtifact({
    schemaVersion: 1,
    skill: "portfolio-project-flow-studio",
    title: "Flow Studio",
    blocks: [
      { type: "text", text: "Visible flow branches", tone: "lead" },
      { type: "image", src: "assets/flows/agentroam.svg", alt: "diagram", caption: "AgentRoam flow" },
      { type: "video", src: "https://assets.example.com/demo.mp4", poster: "assets/work-flow.jpg", caption: "Flow demo" },
      { type: "html", html: "<section><strong>safe</strong></section>" },
    ],
    suggestions: ["/works", "bad"],
    cached: true,
  }, "portfolio-project-flow-studio");
  assert.ok(value);
  assert.deepEqual(value.blocks.map((block) => block.type), ["text", "image", "video", "html"]);
  assert.deepEqual(value.blocks.slice(1, 3).map((block) => block.caption), ["AgentRoam flow", "Flow demo"]);
  assert.deepEqual(value.suggestions, ["/works"]);
  assert.equal(value.cached, true);
  assert.ok(core.validateArtifact({ ...value, skill: "portfolio-whoami" }));
  assert.ok(core.validateArtifact({ ...value, skill: "portfolio-jobs" }));
  assert.equal(core.validateArtifact({ ...value, skill: "portfolio-whoami" }, "portfolio-jobs"), null);
  assert.equal(core.validateArtifact({ ...value, skill: "not-public" }), null);
  assert.equal(core.validateArtifact({ ...value, blocks: [{ type: "image", src: "javascript:alert(1)" }] }), null);
});

test("allows only public project commands inside generated artifact HTML", () => {
  assert.equal(core.isSafeArtifactCommand("/project agentroam"), true);
  assert.equal(core.isSafeArtifactCommand("/works"), true);
  assert.equal(core.isSafeArtifactCommand("/admin"), false);
  assert.equal(core.isSafeArtifactCommand("javascript:alert(1)"), false);
});

test("snapshot fallback returns only a matching valid artifact", () => {
  const works = {
    schemaVersion: 1, skill: "portfolio-works", title: "Works",
    blocks: [{ type: "text", text: "Generated" }],
  };
  const snapshot = { artifacts: { "portfolio-works": works } };
  assert.equal(core.snapshotArtifact(snapshot, "portfolio-works").title, "Works");
  assert.equal(core.snapshotArtifact(snapshot, "portfolio-contact"), null);
});

test("terminal shell has no authoritative content templates or legacy commands", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal(html.includes("<template"), false);
  assert.equal(html.includes("真实录屏 · 静音循环"), false);
  assert.match(html, /id="skills-trigger"/);
  assert.match(html, /id="theme-trigger"/);
  for (const theme of ["carbon", "matrix", "amber", "solarized"]) {
    assert.match(html, new RegExp(`data-theme-option="${theme}"`));
  }
  assert.match(html, /content-snapshot\.js[\s\S]*portfolio-core\.js[\s\S]*main\.js/);
  assert.match(html, /id="command-queue"[\s\S]*id="command-form"/);
  assert.match(html, /class="command-input-shell"[\s\S]*id="command-input"[\s\S]*class="idle-caret"/);
  assert.match(html, /style\.css\?v=20260924-2/);
  assert.match(html, /portfolio-core\.js\?v=20260924-4/);
  assert.match(html, /main\.js\?v=20260924-2/);
});

test("browser sanitizer and interaction contracts are present", () => {
  const coreSource = fs.readFileSync(path.join(root, "portfolio-core.js"), "utf8");
  const mainSource = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.match(mainSource, /const pageSessionId = core\.createPageSessionId\(window\.crypto\)/);
  assert.match(mainSource, /JSON\.stringify\(\{ message, sessionId: pageSessionId \}\)/);
  assert.match(mainSource, /COMMANDS, pageSessionId, normalizeCommand/);
  assert.match(coreSource, /new globalScope\.DOMParser\(\)/);
  assert.equal(/\.innerHTML\s*=/.test(`${coreSource}\n${mainSource}`), false);
  assert.match(mainSource, /async function autoCycle\(\)/);
  assert.match(mainSource, /addEventListener\("wheel", stopAutoCycle/);
  assert.match(mainSource, /addEventListener\("touchmove", stopAutoCycle/);
  assert.match(mainSource, /finishActiveStream\(\)/);
  assert.match(mainSource, /let skillsPinned = false/);
  assert.match(mainSource, /addEventListener\("pointerenter"/);
  assert.match(mainSource, /skillsPinned = !skillsPinned/);
  assert.match(mainSource, /portfolio-terminal-theme/);
  assert.match(mainSource, /function applyTheme\(theme, persist = false\)/);
  assert.match(mainSource, /function typeDemoCommand\(command\)/);
  assert.match(mainSource, /await typeDemoCommand\(entry\.command\)/);
  assert.match(mainSource, /status\.textContent = "ready"/);
  assert.match(mainSource, /artifact\.cached \? "cached" : "live"/);
  assert.match(mainSource, /`CACHE \/ LAST SUCCESS \/ \$\{route\}`/);
  assert.match(mainSource, /"cache hit"/);
  assert.match(mainSource, /const fallbackSkill = expectedSkill \|\| "portfolio-chat"/);
  assert.match(mainSource, /const cached = expectedSkill \? snapshotArtifact\(expectedSkill\) : null/);
  assert.match(mainSource, /`ERROR \/ \$\{route\}`/);
  assert.match(mainSource, /function createPendingResult\(command\)/);
  assert.match(mainSource, /aria-busy", "true"/);
  assert.match(mainSource, /aria-live", "polite"/);
  assert.match(mainSource, /aria-label", "小熊正在思考中"/);
  assert.match(mainSource, /"thinking-spinner"/);
  assert.match(mainSource, /aria-hidden", "true"/);
  assert.doesNotMatch(mainSource, /thinking-dots|小熊正在思考中。。。/);
  assert.match(mainSource, /pendingResult\.remove\(\)/);
  assert.match(mainSource, /renderArtifact\(artifact, command, source, pendingResult\)/);
  assert.match(mainSource, /activeExecutionCount > 0 \|\| commandQueue\.children\.length > 0/);
  assert.match(mainSource, /function createQueuedCommand\(command\)/);
  assert.match(mainSource, /queuedRow\?\.remove\(\)/);
  assert.ok(
    mainSource.indexOf("await typeDemoCommand(entry.command)")
      < mainSource.indexOf("activeRun = executeCommand(entry.command, { auto: true })"),
  );
});

test("terminal themes use tokens and command results have no decorative rules", () => {
  const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
  for (const theme of ["matrix", "amber", "solarized"]) {
    assert.match(css, new RegExp(`:root\\[data-theme="${theme}"\\]`));
  }
  const resultRule = css.match(/\.command-result\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(resultRule, /border:\s*0/);
  assert.doesNotMatch(resultRule, /border-(?:left|bottom)/);
  assert.match(css, /grid-template-columns:\s*76px minmax\(0, 1fr\) 76px/);
  assert.match(css, /\.terminal-title\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.terminal-tools\s*\{[^}]*grid-column:\s*3;[^}]*justify-self:\s*center/s);
  assert.match(css, /\.thinking-spinner\s*\{[^}]*animation:\s*spinner-rotate/s);
  assert.match(css, /@keyframes spinner-rotate/);
  assert.match(css, /\.command-input-shell\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.idle-caret\s*\{[^}]*opacity:\s*0/s);
  assert.match(css, /\.command-input-shell:has\(input:not\(:focus\):placeholder-shown\) \.idle-caret\s*\{[^}]*animation:\s*blink/s);
  assert.match(css, /\.command-queue\s*\{[^}]*max-height:\s*96px/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.thinking-spinner,[\s\S]*\.idle-caret\s*\{[^}]*animation:\s*none/s);
  assert.doesNotMatch(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.thinking-spinner,[\s\S]*\.idle-caret\s*\{[^}]*opacity:/s);
});

test("media catalog maps every project to video, image or diagram", () => {
  const source = fs.readFileSync(path.join(root, "media-map.js"), "utf8");
  for (const project of [
    "agentroam", "knowledge-base", "smart-refund", "agent-swarms", "quality-platform",
    "customer-service", "flow-studio", "meitu-web", "vibe-works", "kid-earth",
  ]) {
    assert.match(source, new RegExp(`"${project}"\\s*:`));
  }
  assert.match(source, /work-flow\.mp4/);
  assert.match(source, /flows\/knowledge-base\.svg/);
});
