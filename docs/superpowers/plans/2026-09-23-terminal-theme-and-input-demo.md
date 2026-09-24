# Terminal Theme and Input Demo Implementation Plan

> **For the main agent:** Implement this plan directly in the current session. Do not dispatch implementation or code-review subagents. After all development tasks are complete, run the affected unit tests and fix any failures before reporting completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage behave like a real terminal by typing the startup Slash commands into the actual input, removing decorative result separators, and adding persistent classic terminal themes.

**Architecture:** Keep the zero-dependency static application and existing Flow/Skill contracts unchanged. Theme selection is a `data-theme` attribute backed by CSS variables and local storage; the startup demo owns a cancellable requestAnimationFrame input animation before calling the existing command executor.

**Tech Stack:** HTML, CSS custom properties, browser JavaScript, Node test runner.

## Global Constraints

- Keep Carbon as the default theme.
- Offer Carbon, Matrix, Amber, and Solarized Dark from the top-right title bar.
- Run one startup pass through the existing public Slash commands, then leave the input empty for the visitor.
- Any visitor keyboard, pointer, focus, wheel, or touch interaction stops the demo immediately.
- Preserve the public Flow endpoint, Skill mapping, Artifact schema, sanitization, snapshot fallback, media mapping, and zero-dependency architecture.
- Respect `prefers-reduced-motion` by filling demo commands immediately.

---

### Task 1: Theme Control and Terminal Tokens

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: existing title-bar status and CSS color variables.
- Produces: `#theme-trigger`, `#theme-menu`, `[data-theme-option]`, and `html[data-theme]` token overrides.

- [x] **Step 1: Add the title-bar control**

Add a compact swatch trigger beside the runtime status and a four-option menu:

```html
<div class="terminal-tools">
  <p class="terminal-status" id="terminal-status" aria-live="polite">booting</p>
  <div class="theme-picker" id="theme-picker">
    <button id="theme-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Choose terminal theme"></button>
    <div id="theme-menu" role="menu" aria-hidden="true">
      <button data-theme-option="carbon" role="menuitemradio">Carbon</button>
      <button data-theme-option="matrix" role="menuitemradio">Matrix</button>
      <button data-theme-option="amber" role="menuitemradio">Amber</button>
      <button data-theme-option="solarized" role="menuitemradio">Solarized</button>
    </div>
  </div>
</div>
```

- [x] **Step 2: Define theme tokens and responsive menu styling**

Keep component rules on semantic variables and override only variables per theme:

```css
:root[data-theme="matrix"] { --bg: #050806; --text: #b7ffbf; --green: #39ff6f; }
:root[data-theme="amber"] { --bg: #100b02; --text: #ffd58a; --green: #ffb000; }
:root[data-theme="solarized"] { --bg: #002b36; --text: #eee8d5; --green: #859900; }
```

The menu opens below the top-right trigger, remains inside a 390px viewport, shows a color swatch for each option, and exposes visible keyboard focus.

- [x] **Step 3: Add static UI contracts**

Assert that the four theme options, versioned assets, `data-theme` selectors, and accessibility attributes exist.

### Task 2: Persistent Theme State and Cancellable Input Demo

**Files:**
- Modify: `main.js`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `COMMANDS`, `executeCommand(value, options)`, `input`, `reducedMotion`.
- Produces: `applyTheme(theme, persist)`, `setThemeMenuOpen(open)`, `typeDemoCommand(command)`, and `stopAutoCycle()` cancellation of both input and output animation.

- [x] **Step 1: Implement validated theme persistence**

Use a fixed allowlist and fail back to Carbon when storage is missing, blocked, or contains an unknown value:

```js
const THEMES = Object.freeze(["carbon", "matrix", "amber", "solarized"]);
const THEME_STORAGE_KEY = "portfolio-terminal-theme";
```

`applyTheme` updates `document.documentElement.dataset.theme`, the selected menu item's `aria-checked`, the trigger tooltip, and the document theme-color meta tag. Theme clicks must not stop the startup demo.

- [x] **Step 2: Implement absolute-time input animation**

Use requestAnimationFrame and elapsed time, not per-frame rounded increments:

```js
const count = Math.min(command.length, Math.floor(command.length * (now - started) / duration));
input.value = command.slice(0, count);
```

The returned promise resolves on completion or cancellation. Cancellation clears only text owned by the demo and never erases visitor input.

- [x] **Step 3: Put command typing before command execution**

For each item in `COMMANDS`, await `typeDemoCommand(entry.command)`, pause briefly, clear the demo input, then await `executeCommand(entry.command, { auto: true })`. After the one pass, leave the input empty and set status to `flow online`.

- [x] **Step 4: Preserve manual ownership and menu behavior**

Keyboard, input, pointer, focus, wheel, and touch takeover calls `stopAutoCycle()`. Theme-picker interactions are excluded from the global pointer/focus takeover so visitors can change color while the demo continues. Escape and outside click close the theme menu.

- [x] **Step 5: Add static interaction contracts**

Assert the fixed theme allowlist, storage key, elapsed-time demo typing, theme picker listeners, and call ordering `typeDemoCommand` before `executeCommand`.

### Task 3: Undecorated Terminal Output and Cache Refresh

**Files:**
- Modify: `style.css`
- Modify: `index.html`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `.command-result` and existing output layout.
- Produces: whitespace-only result separation and a new static asset version.

- [x] **Step 1: Remove result decoration**

Replace the left and bottom borders with natural terminal spacing:

```css
.command-result {
  padding: 0 0 22px;
  margin: 0 0 18px;
  border: 0;
}
```

Do not remove borders inside tables, media, code blocks, menus, or the terminal frame because those encode real component boundaries.

- [x] **Step 2: Bump static asset versions**

Update local CSS and JavaScript query versions together so an already-open browser loads the new interaction and theme styles after refresh.

- [x] **Step 3: Extend the UI contract test**

Assert the current asset version and verify `.command-result` has no left or bottom border declarations.

## Final Unit Test Verification

- [x] **Main agent: run affected unit tests after development is complete**

Run: `node --test tests/*.test.js`

Expected: all tests pass.

Then verify `http://127.0.0.1:8801/` at desktop and 390x844: the input visibly types commands before results, the output has no decorative separators, all four themes persist after reload, menus stay within the viewport, and no page-level overflow appears.
