# Natural-Language Artifact Contract Implementation Plan

> **For the main agent:** Implement this plan directly in the current session. Do not dispatch implementation or code-review subagents. After all development tasks are complete, run the affected unit tests and fix any failures before reporting completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Customer Agent choose the final `portfolio-*` artifact for natural-language requests while preserving strict Skill matching for Slash commands.

**Architecture:** The browser derives an expected Skill only for Slash commands. Natural-language responses still pass the same schema, media, and HTML safety validation, but the browser does not override Customer Agent's intent routing. Snapshot fallback remains limited to deterministic Slash commands.

**Tech Stack:** Browser JavaScript, Node.js built-in test runner, static portfolio assets.

## Global Constraints

- Customer Agent remains the only owner of natural-language intent routing.
- Flow Studio and the homepage gateway continue validating `PortfolioArtifactV1` structure and public safety.
- Slash commands retain exact Skill matching and snapshot fallback.
- Natural-language failures never fall back to a deterministic command snapshot.

---

### Task 1: Separate Natural-Language Routing From Slash Skill Validation

**Files:**
- Modify: `portfolio-core.js`
- Modify: `main.js`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: normalized visitor input and a `PortfolioArtifactV1` object.
- Produces: `skillForInput(value): string | null`; exact Skill IDs for Slash commands and `null` for natural language.

- [x] **Step 1: Change natural-language expected Skill resolution**

Return `null` from `skillForInput` when input does not begin with `/`, while preserving direct command, project, and unknown-command behavior.

- [x] **Step 2: Keep natural-language failure handling snapshot-free**

Use `portfolio-chat` only as the error artifact label when no expected Skill exists. Read snapshots only when an exact Slash Skill exists.

- [x] **Step 3: Preserve generic artifact safety validation**

Require every artifact Skill to match `^portfolio-[a-z0-9-]+$`; apply exact equality only when an expected Slash Skill is supplied.

- [x] **Step 4: Add focused contract tests**

Assert natural-language inputs resolve to `null`, natural-language validation accepts `portfolio-whoami` and `portfolio-jobs`, invalid Skill IDs are rejected, and `/jobs` still rejects a mismatched Skill.

### Task 2: Document And Activate The Contract

**Files:**
- Modify: `README.md`
- Modify: `index.html`
- Unit tests: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes: the browser contract from Task 1.
- Produces: documented behavior and cache-busted static asset references.

- [x] **Step 1: Document routing ownership**

State that Slash commands have a fixed expected Skill and natural language accepts the valid `portfolio-*` branch selected by Customer Agent.

- [x] **Step 2: Bump modified asset query versions**

Update the `portfolio-core.js` and `main.js` query strings in `index.html` and their corresponding UI contract assertions.

## Final Unit Test Verification

- [x] **Main agent: run affected unit tests after development is complete**

Run: `node --test tests/*.test.js`
Expected: PASS

If a test fails, fix the implementation or test and rerun this command until it passes. Report the command and result in the final response.
