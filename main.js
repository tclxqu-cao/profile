(function portfolioTerminal() {
  "use strict";

  const core = window.PortfolioCore;
  if (!core) throw new Error("PortfolioCore is unavailable");
  const commandLabels = Object.freeze({
    "/help": "Command guide", "/whoami": "Profile", "/works": "Projects",
    "/jobs": "Open roles", "/timeline": "Experience", "/contact": "Contact",
  });
  const COMMANDS = Object.freeze(core.PUBLIC_COMMANDS.map((entry) => ({
    ...entry, label: commandLabels[entry.command] || entry.label,
  })));
  const COMMAND_INDEX = new Map();
  for (const entry of COMMANDS) {
    COMMAND_INDEX.set(entry.command, entry);
  }
  const toneClasses = Object.freeze({
    success: "tone-success", warning: "tone-warning", error: "tone-error",
    meta: "tone-meta", muted: "tone-muted",
  });
  const THEMES = Object.freeze({
    carbon: { label: "Carbon", color: "#0b0d10" },
    matrix: { label: "Matrix", color: "#030705" },
    amber: { label: "Amber", color: "#0e0902" },
    solarized: { label: "Solarized", color: "#002b36" },
  });
  const THEME_STORAGE_KEY = "portfolio-terminal-theme";

  const config = window.PORTFOLIO_CONFIG || {};
  const mediaMap = window.PORTFOLIO_MEDIA || {};
  const snapshot = window.PORTFOLIO_SNAPSHOT || {};
  const pageSessionId = core.createPageSessionId(window.crypto);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const output = document.getElementById("terminal-output");
  const terminal = document.getElementById("terminal");
  const form = document.getElementById("command-form");
  const input = document.getElementById("command-input");
  const status = document.getElementById("terminal-status");
  const commandQueue = document.getElementById("command-queue");
  const palette = document.getElementById("slash-palette");
  const paletteOptions = document.getElementById("slash-options");
  const skillsMenu = document.getElementById("skills-menu");
  const skillsTrigger = document.getElementById("skills-trigger");
  const skillsPopover = skillsMenu.querySelector(".skills-popover");
  const themePicker = document.getElementById("theme-picker");
  const themeTrigger = document.getElementById("theme-trigger");
  const themeMenu = document.getElementById("theme-menu");
  const themeButtons = [...themeMenu.querySelectorAll("[data-theme-option]")];
  const themeColor = document.querySelector('meta[name="theme-color"]');

  let paletteEntries = [];
  let paletteCursor = 0;
  let requestController = null;
  let activeStream = null;
  let activeDemoTyping = null;
  let demoInputValue = "";
  let activeRun = Promise.resolve();
  let activeExecutionCount = 0;
  let autoDemo = config.autoDemo !== false;
  let skillsPinned = false;

  function normalizeCommand(value) {
    return core.normalizeCommand(value);
  }

  function expectedSkillForInput(value) {
    return core.skillForInput(value);
  }

  function isSafeUrl(value, kind = "link") {
    const source = String(value || "").trim();
    if (!source) return false;
    if (/^(?:\/?assets\/)[a-z0-9_./-]+$/i.test(source) && !source.split("/").includes("..")) return true;
    let parsed;
    try { parsed = new URL(source, window.location.href); } catch { return false; }
    if (kind === "link" && parsed.protocol === "mailto:") return true;
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (kind === "link") return true;
    const assetBase = config.assetBaseUrl ? new URL(config.assetBaseUrl, window.location.href).origin : "";
    return parsed.origin === window.location.origin || parsed.hostname === "localhost"
      || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".vercel.app")
      || Boolean(assetBase && parsed.origin === assetBase);
  }

  function validateArtifact(value, expectedSkill) {
    return core.validateArtifact(value, expectedSkill || undefined);
  }

  function sanitizeArtifactHtml(raw) {
    return core.sanitizeHtmlToFragment(raw, document);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readStoredTheme() {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return THEMES[stored] ? stored : "carbon";
    } catch {
      return "carbon";
    }
  }

  function applyTheme(theme, persist = false) {
    const selected = THEMES[theme] ? theme : "carbon";
    const details = THEMES[selected];
    document.documentElement.dataset.theme = selected;
    themeColor?.setAttribute("content", details.color);
    themeTrigger.setAttribute("aria-label", `Choose terminal theme. Current: ${details.label}`);
    themeTrigger.title = `Terminal theme: ${details.label}`;
    for (const button of themeButtons) {
      button.setAttribute("aria-checked", String(button.dataset.themeOption === selected));
    }
    if (persist) {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, selected); } catch { /* Storage may be blocked. */ }
    }
    return selected;
  }

  function setThemeMenuOpen(open) {
    themePicker.classList.toggle("is-open", open);
    themeTrigger.setAttribute("aria-expanded", String(open));
    themeMenu.setAttribute("aria-hidden", String(!open));
  }

  function clearDemoInput() {
    if (input.value === demoInputValue) input.value = "";
    demoInputValue = "";
  }

  function typeDemoCommand(command) {
    const value = String(command || "");
    if (!autoDemo || !value) return Promise.resolve(false);
    activeDemoTyping?.cancel();
    clearDemoInput();
    if (reducedMotion) {
      demoInputValue = value;
      input.value = value;
      return Promise.resolve(true);
    }

    let frame = 0;
    let done = false;
    let resolveDone;
    const duration = Math.max(360, value.length * 58);
    const started = performance.now();
    const promise = new Promise((resolve) => { resolveDone = resolve; });
    const settle = (completed) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      if (!completed) clearDemoInput();
      if (activeDemoTyping?.cancel === cancel) activeDemoTyping = null;
      resolveDone(completed);
    };
    const cancel = () => settle(false);
    const tick = (now) => {
      const count = Math.min(value.length, Math.floor(value.length * (now - started) / duration));
      demoInputValue = value.slice(0, count);
      input.value = demoInputValue;
      if (count >= value.length) settle(true);
      else frame = requestAnimationFrame(tick);
    };
    activeDemoTyping = { cancel };
    frame = requestAnimationFrame(tick);
    return promise;
  }

  function finishActiveStream() {
    if (activeStream) activeStream.finish();
  }

  function streamText(node, text, duration = 850) {
    const value = String(text || "");
    if (!value || reducedMotion) {
      node.textContent = value;
      return Promise.resolve();
    }
    finishActiveStream();
    node.classList.add("is-streaming");
    const reserve = element("span", "stream-reserve", value);
    reserve.setAttribute("aria-hidden", "true");
    const live = element("span", "stream-progress");
    const caret = element("span", "stream-caret", "_");
    live.append(caret);
    node.replaceChildren(reserve, live);
    let frame = 0;
    let done = false;
    let resolveDone;
    const promise = new Promise((resolve) => { resolveDone = resolve; });
    const started = performance.now();
    const complete = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      node.classList.remove("is-streaming");
      node.textContent = value;
      if (activeStream?.finish === complete) activeStream = null;
      resolveDone();
    };
    const tick = (now) => {
      const count = Math.min(value.length, Math.floor(value.length * (now - started) / duration));
      live.textContent = value.slice(0, count);
      live.append(caret);
      if (count >= value.length) complete();
      else frame = requestAnimationFrame(tick);
    };
    activeStream = { finish: complete };
    frame = requestAnimationFrame(tick);
    return promise;
  }

  function projectIdForArtifact(artifact) {
    if (typeof artifact.projectId === "string") return artifact.projectId;
    return artifact.skill.startsWith("portfolio-project-")
      ? artifact.skill.slice("portfolio-project-".length) : "";
  }

  function fallbackMediaBlock(artifact) {
    const mapping = mediaMap[projectIdForArtifact(artifact)];
    if (!mapping) return null;
    if (mapping.video) return { type: "video", src: mapping.video, poster: mapping.image || "", alt: mapping.alt || artifact.title };
    if (mapping.image) return { type: "image", src: mapping.image, alt: mapping.alt || artifact.title };
    if (mapping.diagram) return { type: "image", src: mapping.diagram, alt: mapping.alt || `${artifact.title} flow diagram`, mediaRole: "diagram" };
    return null;
  }

  function openLightbox(media) {
    const backdrop = element("div", "lightbox");
    backdrop.tabIndex = -1;
    const close = element("button", "lightbox-close", "Close");
    close.type = "button";
    const clone = media.cloneNode(true);
    clone.removeAttribute("tabindex");
    if (clone.tagName === "VIDEO") clone.controls = true;
    backdrop.append(close, clone);
    const dismiss = () => { backdrop.remove(); media.focus(); };
    close.addEventListener("click", dismiss);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) dismiss(); });
    backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") dismiss(); });
    document.body.append(backdrop);
    backdrop.focus();
  }

  function renderMedia(block) {
    const figure = element("figure", `artifact-media${block.mediaRole === "diagram" ? " is-diagram" : ""}`);
    let media;
    if (block.type === "video") {
      media = document.createElement("video");
      media.controls = true;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = "metadata";
      if (block.poster && isSafeUrl(block.poster, "media")) media.poster = block.poster;
    } else {
      media = document.createElement("img");
      media.loading = "lazy";
    }
    media.src = core.resolveAssetUrl(block.src, config.assetBaseUrl);
    media.alt = block.alt || "";
    media.tabIndex = 0;
    media.setAttribute("role", "button");
    media.setAttribute("aria-label", `Open ${block.alt || "media"}`);
    media.addEventListener("click", () => openLightbox(media));
    media.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openLightbox(media); }
    });
    figure.append(media);
    if (block.caption) figure.append(element("figcaption", "artifact-caption", block.caption));
    return figure;
  }

  function createCommandLine(command) {
    const commandLine = element("p", "echo-line");
    commandLine.append(element("span", "prompt", "caoqu@portfolio:~$"), document.createTextNode(` ${command}`));
    return commandLine;
  }

  function createPendingResult(command) {
    const shell = element("article", "command-result is-pending");
    shell.setAttribute("aria-busy", "true");
    const thinking = element("p", "thinking-status");
    const spinner = element("span", "thinking-spinner");
    spinner.setAttribute("aria-hidden", "true");
    thinking.setAttribute("role", "status");
    thinking.setAttribute("aria-live", "polite");
    thinking.setAttribute("aria-label", "小熊正在思考中");
    thinking.append(
      document.createTextNode("小熊正在思考中"),
      spinner,
    );
    shell.append(createCommandLine(command), thinking);
    output.append(shell);
    scrollToLatest();
    return shell;
  }

  async function renderArtifact(artifact, command, source, existingShell = null) {
    const shell = existingShell || element("article", "command-result");
    shell.replaceChildren();
    shell.classList.remove("is-pending");
    shell.setAttribute("aria-busy", "false");
    shell.dataset.skill = artifact.skill;
    const commandLine = createCommandLine(command);
    const heading = element("h2", "artifact-title");
    const route = `HOMEPAGE-MAIN / ${artifact.skill.toUpperCase()}`;
    const sourceLabel = source === "live"
      ? `LIVE / ${route}`
      : source === "cached"
        ? `CACHE / LAST SUCCESS / ${route}`
      : source === "snapshot"
        ? `SNAPSHOT / LAST SUCCESS / ${route}`
        : `ERROR / ${route}`;
    const meta = element("p", "artifact-meta", sourceLabel);
    shell.append(commandLine, heading, meta);
    if (!existingShell) output.append(shell);
    await streamText(heading, artifact.title, 420);
    if (artifact.summary) {
      const summary = element("p", "artifact-summary");
      shell.append(summary);
      await streamText(summary, artifact.summary, 620);
    }
    const blocks = [...artifact.blocks];
    if (!blocks.some((block) => block.type === "image" || block.type === "video")) {
      const mapped = fallbackMediaBlock(artifact);
      if (mapped) blocks.push(mapped);
    }
    for (const block of blocks) {
      if (block.type === "text") {
        const node = element("p", `artifact-text ${toneClasses[block.tone] || ""}`.trim());
        shell.append(node);
        await streamText(node, block.text, Math.min(1200, Math.max(360, block.text.length * 9)));
      } else if (block.type === "html") {
        const node = element("div", "artifact-html");
        node.append(sanitizeArtifactHtml(block.html));
        shell.append(node);
      } else {
        shell.append(renderMedia(block));
      }
      scrollToLatest();
    }
    if (Array.isArray(artifact.suggestions) && artifact.suggestions.length) {
      const suggestions = element("div", "artifact-suggestions");
      for (const suggestion of artifact.suggestions.slice(0, 8)) {
        const button = element("button", "suggestion", suggestion);
        button.type = "button";
        button.dataset.command = suggestion;
        suggestions.append(button);
      }
      shell.append(suggestions);
    }
    scrollToLatest();
  }

  function scrollToLatest() {
    output.scrollTo({ top: output.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function snapshotArtifact(expectedSkill) {
    return core.snapshotArtifact(snapshot, expectedSkill);
  }

  async function fetchArtifact(message, expectedSkill) {
    requestController?.abort();
    requestController = new AbortController();
    const timeout = window.setTimeout(() => requestController.abort(), Number(config.timeoutMs || 15000));
    try {
      const response = await fetch(config.mainFlowUrl || "/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: pageSessionId }),
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error("flow_unavailable");
      const artifact = validateArtifact(await response.json(), expectedSkill);
      if (!artifact) throw new Error("invalid_artifact");
      const source = artifact.fallback
        ? "snapshot"
        : artifact.cached ? "cached" : "live";
      return { artifact, source };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function errorArtifact(skill) {
    return {
      schemaVersion: 1,
      skill,
      title: "Content is temporarily unavailable",
      blocks: [{ type: "text", tone: "warning", text: "The live response is temporarily unavailable. Please try again." }],
      suggestions: ["/help", "/works", "/contact"],
      generatedAt: new Date().toISOString(),
    };
  }

  async function executeCommand(value, options = {}) {
    const command = normalizeCommand(value);
    if (!command) return;
    try {
      activeExecutionCount += 1;
      closePalette();
      const expectedSkill = expectedSkillForInput(command);
      status.textContent = "running homepage-main";
      const pendingResult = createPendingResult(command);
      let artifact;
      let source = "live";
      try {
        ({ artifact, source } = await fetchArtifact(command, expectedSkill));
      } catch (error) {
        if (options.auto && !autoDemo && error?.name === "AbortError") {
          pendingResult.remove();
          return;
        }
        const fallbackSkill = expectedSkill || "portfolio-chat";
        const cached = expectedSkill ? snapshotArtifact(expectedSkill) : null;
        artifact = cached || errorArtifact(fallbackSkill);
        source = cached ? "snapshot" : "error";
      }
      await renderArtifact(artifact, command, source, pendingResult);
      status.textContent = source === "live"
        ? "flow online"
        : source === "cached"
          ? "cache hit"
          : source === "snapshot" ? "snapshot fallback" : "flow error";
      if (!options.auto) input.focus({ preventScroll: true });
    } finally {
      activeExecutionCount = Math.max(0, activeExecutionCount - 1);
    }
  }

  function stopAutoCycle() {
    const wasRunning = autoDemo;
    autoDemo = false;
    activeDemoTyping?.cancel();
    clearDemoInput();
    finishActiveStream();
    if (wasRunning) {
      status.textContent = "ready";
      requestController?.abort();
    }
  }

  function updateCommandQueue() {
    const rows = [...commandQueue.children];
    rows.forEach((row, index) => {
      row.querySelector(".queue-position").textContent = `排队 ${index + 1}`;
    });
    commandQueue.hidden = rows.length === 0;
  }

  function createQueuedCommand(command) {
    const row = element("li", "queued-command");
    row.append(
      element("span", "queue-position", "排队"),
      element("span", "queue-message", command),
    );
    commandQueue.append(row);
    updateCommandQueue();
    return row;
  }

  function queueManualCommand(value) {
    const command = normalizeCommand(value);
    if (!command) return activeRun;
    stopAutoCycle();
    const queuedRow = activeExecutionCount > 0 || commandQueue.children.length > 0
      ? createQueuedCommand(command)
      : null;
    activeRun = activeRun.catch(() => {}).then(() => {
      queuedRow?.remove();
      updateCommandQueue();
      return executeCommand(command);
    });
    return activeRun;
  }

  function openPalette() {
    const query = input.value.toLowerCase();
    paletteEntries = COMMANDS.filter((item) => item.command.startsWith(query));
    if (!paletteEntries.length) { closePalette(); return; }
    paletteCursor = Math.min(paletteCursor, paletteEntries.length - 1);
    paletteOptions.replaceChildren(...paletteEntries.map((entry, index) => {
      const button = element("button", index === paletteCursor ? "is-active" : "");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === paletteCursor ? "true" : "false");
      button.dataset.paletteCommand = entry.command;
      button.append(element("span", "palette-command", entry.command), element("span", "palette-description", entry.label));
      return button;
    }));
    palette.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closePalette() {
    palette.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  function choosePalette(entry) {
    if (!entry) return;
    input.value = entry.command;
    closePalette();
    input.focus();
  }

  function setSkillsOpen(open) {
    skillsMenu.classList.toggle("is-open", open);
    skillsTrigger.setAttribute("aria-expanded", String(open));
    skillsPopover.setAttribute("aria-hidden", String(!open));
  }

  applyTheme(readStoredTheme());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    queueManualCommand(value);
  });

  input.addEventListener("input", () => {
    stopAutoCycle();
    if (input.value.startsWith("/")) openPalette();
    else closePalette();
  });
  input.addEventListener("keydown", (event) => {
    stopAutoCycle();
    if (!palette.hidden && ["ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"].includes(event.key)) {
      if (event.key === "Escape") { event.preventDefault(); closePalette(); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        paletteCursor = (paletteCursor + delta + paletteEntries.length) % paletteEntries.length;
        openPalette();
        return;
      }
      if (event.key === "Tab") { event.preventDefault(); choosePalette(paletteEntries[paletteCursor]); return; }
      if (event.key === "Enter" && input.value.startsWith("/") && paletteEntries[paletteCursor]) {
        event.preventDefault();
        const command = paletteEntries[paletteCursor].command;
        input.value = "";
        closePalette();
        queueManualCommand(command);
      }
    }
  });

  paletteOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-palette-command]");
    if (button) choosePalette(COMMAND_INDEX.get(button.dataset.paletteCommand));
  });
  document.addEventListener("click", (event) => {
    const command = event.target.closest("[data-command]")?.dataset.command;
    if (command) {
      queueManualCommand(command);
      if (event.target.closest("#skills-menu")) {
        skillsPinned = false;
        setSkillsOpen(false);
      }
    }
    if (!event.target.closest("#skills-menu")) {
      skillsPinned = false;
      setSkillsOpen(false);
    }
    if (!event.target.closest("#theme-picker")) setThemeMenuOpen(false);
  });
  themeTrigger.addEventListener("click", () => {
    setThemeMenuOpen(themeTrigger.getAttribute("aria-expanded") !== "true");
  });
  themeMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-option]");
    if (!button) return;
    applyTheme(button.dataset.themeOption, true);
    setThemeMenuOpen(false);
    themeTrigger.focus({ preventScroll: true });
  });
  themePicker.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setThemeMenuOpen(false);
    themeTrigger.focus({ preventScroll: true });
  });
  themePicker.addEventListener("focusout", (event) => {
    if (!themePicker.contains(event.relatedTarget)) setThemeMenuOpen(false);
  });
  skillsTrigger.addEventListener("click", () => {
    skillsPinned = !skillsPinned;
    setSkillsOpen(skillsPinned);
  });
  skillsMenu.addEventListener("pointerenter", () => setSkillsOpen(true));
  skillsMenu.addEventListener("pointerleave", () => {
    if (!skillsPinned && !skillsMenu.contains(document.activeElement)) setSkillsOpen(false);
  });
  skillsMenu.addEventListener("focusin", () => setSkillsOpen(true));
  skillsMenu.addEventListener("focusout", (event) => {
    if (!skillsPinned && !skillsMenu.contains(event.relatedTarget)) setSkillsOpen(false);
  });

  document.querySelector(".window-actions").addEventListener("click", (event) => {
    const action = event.target.closest("[data-window-action]")?.dataset.windowAction;
    if (!action) return;
    stopAutoCycle();
    if (action === "clear") output.replaceChildren();
    terminal.classList.toggle("is-collapsed", action === "collapse");
    if (action === "expand") terminal.classList.remove("is-collapsed");
  });
  output.addEventListener("wheel", stopAutoCycle, { passive: true });
  output.addEventListener("touchmove", stopAutoCycle, { passive: true });
  output.addEventListener("pointerdown", stopAutoCycle, { passive: true });
  input.addEventListener("focus", stopAutoCycle, { once: true });
  document.addEventListener("keydown", stopAutoCycle, { once: true, capture: true });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#theme-picker")) stopAutoCycle();
  }, { capture: true });
  document.addEventListener("focusin", (event) => {
    if (!event.target.closest("#theme-picker")) stopAutoCycle();
  }, { capture: true });

  async function autoCycle() {
    if (!autoDemo) {
      status.textContent = "ready";
      return;
    }
    status.textContent = "querying public skills";
    for (const entry of COMMANDS) {
      if (!autoDemo) break;
      status.textContent = `typing ${entry.command}`;
      const typed = await typeDemoCommand(entry.command);
      if (!typed || !autoDemo) break;
      await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 140));
      if (!autoDemo) break;
      clearDemoInput();
      activeRun = executeCommand(entry.command, { auto: true });
      await activeRun.catch(() => {});
      if (!autoDemo) break;
      await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 280));
    }
    clearDemoInput();
    if (autoDemo) status.textContent = "flow online";
  }

  window.__PORTFOLIO_TEST__ = Object.freeze({
    COMMANDS, pageSessionId, normalizeCommand, expectedSkillForInput, validateArtifact,
    isSafeUrl, sanitizeArtifactHtml, applyTheme, typeDemoCommand,
  });

  autoCycle();
})();
