# Homepage Bear Thinking Loading Implementation Plan

> **For the main agent:** Implement this plan directly in the current session. Do not dispatch implementation or code-review subagents. After all development tasks are complete, run the affected unit tests and fix any failures before reporting completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `小熊正在思考中` with a compact loading icon for the active homepage command, display later submissions in an ordered queue above the input, and keep a blinking caret visible when the input is empty and unfocused.

**Architecture:** `executeCommand()` creates one pending `.command-result` before calling the API. `renderArtifact()` reuses and clears that same element for the final artifact, while cancelled automatic runs remove it. Manual submissions continue through the existing Promise chain; submissions made while another execution is active get a queue row above the form, which is removed when that command starts. CSS supplies a theme-aware spinner, queue states, and a simulated idle caret that yields to the browser's native caret on focus.

**Tech Stack:** Browser DOM APIs, CSS animations, Node.js built-in test runner, ego-browser.

## Global Constraints

- Keep `homepage-main`, Agent IDs, API requests, routing, snapshot policy, and artifact validation unchanged.
- The visible pending copy is exactly `小熊正在思考中`, followed by an `aria-hidden` loading icon.
- The pending row must be accessible through `role="status"`, `aria-live="polite"`, and `aria-busy`.
- Reuse the pending result container so the command is not rendered twice and the output does not jump.
- Disable spinner and simulated-caret animation under `prefers-reduced-motion: reduce`.
- Show the simulated caret only while the input is empty and unfocused; focused inputs use the native caret.
- Keep the input enabled while a request runs; later submissions execute in original submission order.
- Show queued commands above the input and remove each row when its execution starts.

---

### Task 1: Pending Result Lifecycle

**Files:**
- Modify: `main.js`
- Modify: `style.css`
- Modify: `index.html`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: `element(tag, className, text)`, `output`, `scrollToLatest()`, `fetchArtifact()`, and `renderArtifact()`.
- Produces: `createPendingResult(command): HTMLElement` and `renderArtifact(artifact, command, source, shell?)`.

- [ ] **Step 1: Add the pending DOM factory**

Create an `article.command-result.is-pending` containing the existing command echo and a status paragraph whose text is `小熊正在思考中`, followed by an `aria-hidden` spinner. Set `role="status"`, `aria-live="polite"`, and `aria-busy="true"`, append it to `output`, and scroll it into view.

- [ ] **Step 2: Reuse the pending container for final output**

Allow `renderArtifact()` to receive the pending article. Before rendering the artifact, clear it, remove the pending class, set `aria-busy="false"`, and append the final command echo, title, metadata, blocks, and suggestions as before.

- [ ] **Step 3: Connect request and cancellation lifecycle**

Create the pending result immediately before `fetchArtifact()`. Pass it to `renderArtifact()` for both live and error artifacts. When an automatic demo request is aborted after user takeover, remove its pending result before returning.

- [ ] **Step 4: Add theme-aware motion and reduced-motion handling**

Style the status as quiet terminal feedback using existing color tokens. Rotate the loading icon and remove animation in the existing reduced-motion media query.

- [ ] **Step 5: Extend UI contract coverage**

Assert the exact Chinese copy, pending factory, container reuse, cancellation cleanup, `aria-live`/`aria-busy`, CSS animation, reduced-motion override, and updated static resource versions.

### Task 3: Persistent Empty Input Caret

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Unit tests: `tests/ui-contract.test.js`

- [ ] **Step 1: Add the idle caret layer**

Wrap `#command-input` in `.command-input-shell` and place an `aria-hidden` `.idle-caret` beside it.

- [ ] **Step 2: Coordinate simulated and native carets**

Show the simulated caret only for an empty, unfocused input. Hide it on focus or when text is present so it never competes with the browser's native caret.

- [ ] **Step 3: Verify desktop and mobile rendering**

Assert the DOM and CSS state contract, then verify both idle and focused states in ego-browser.

### Task 2: Visible Manual Command Queue

**Files:**
- Modify: `index.html`
- Modify: `main.js`
- Modify: `style.css`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: the existing `activeRun` Promise chain and `queueManualCommand(value)` entry point.
- Produces: `createQueuedCommand(value): HTMLElement` and an accessible `#command-queue` list above the form.

- [ ] **Step 1: Add the queue region**

Insert a hidden `role="status"` region immediately before `#command-form`. Keep its height content-driven with a bounded scroll area so queued commands cannot push the terminal output off screen.

- [ ] **Step 2: Render ordered queue rows**

When `queueManualCommand()` runs while `executeCommand()` is active, append a row containing `排队中` and the normalized command. Renumber visible rows after every add or remove.

- [ ] **Step 3: Promote queued commands into execution**

Preserve the existing Promise chain. Remove a command's queue row immediately before its `executeCommand()` call, then let the active pending result take over in the output area.

- [ ] **Step 4: Cover queue contracts and browser behavior**

Assert the queue region, active execution counter, row lifecycle, and queue styling. In ego-browser, submit two messages before the first response, verify the second appears above the input, then verify both responses complete in submission order and the queue clears.

## Final Unit Test Verification

- [ ] **Main agent: run affected unit tests after development is complete**

Run: `node --test tests/ui-contract.test.js tests/command.test.js`

Expected: PASS

Then use ego-browser at `http://127.0.0.1:8801/` to verify the pending text is visible before the response, the second submission queues above the input, both responses complete in order, and the queue clears.
