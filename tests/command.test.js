const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/command.js");

const originalFetch = global.fetch;
const originalEndpoint = process.env.HOMEPAGE_FLOW_URL;
const originalToken = process.env.FLOW_HOMEPAGE_TOKEN;

function artifact(overrides = {}) {
  return {
    schemaVersion: 1,
    skill: "portfolio-works",
    title: "Works",
    blocks: [{ type: "text", text: "public result" }],
    generatedAt: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    HOMEPAGE_FLOW_URL: originalEndpoint,
    FLOW_HOMEPAGE_TOKEN: originalToken,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function request(body = { message: "/works" }, method = "POST") {
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await handler({ method, body, headers: { authorization: "Bearer visitor" } }, res);
  return res;
}

function configure(endpoint = "https://flow.example.com/api/homepage/command") {
  process.env.HOMEPAGE_FLOW_URL = endpoint;
  process.env.FLOW_HOMEPAGE_TOKEN = "server-only-token";
}

test("forwards only the message, page session and server credential to the configured Flow", async () => {
  configure();
  const upstream = artifact();
  global.fetch = async (url, options) => {
    assert.equal(url.href, process.env.HOMEPAGE_FLOW_URL);
    assert.equal(options.headers.Authorization, "Bearer server-only-token");
    assert.deepEqual(JSON.parse(options.body), {
      message: "/works", sessionId: "1234567890abcdef1234567890abcdef",
    });
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify(upstream));
  };
  const res = await request({
    message: "/works",
    sessionId: "1234567890abcdef1234567890abcdef",
    flow_id: "private-flow",
    token: "visitor",
  });
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body, upstream);
});

test("fails closed without config and rejects nonlocal insecure URLs", async () => {
  global.fetch = () => { throw new Error("must not fetch"); };
  delete process.env.FLOW_HOMEPAGE_TOKEN;
  assert.equal((await request()).code, 503);
  configure("http://flow.example.com/api/homepage/command");
  assert.equal((await request()).code, 503);
});

test("rejects unsupported methods and invalid input before calling upstream", async () => {
  configure();
  global.fetch = () => { throw new Error("must not fetch"); };
  assert.equal((await request({}, "GET")).code, 405);
  for (const message of ["", "  ", "x".repeat(2001), 42]) {
    assert.equal((await request({ message })).code, 400);
  }
  for (const sessionId of ["", "not-hex", "a".repeat(31), "A".repeat(32), 42]) {
    assert.equal((await request({ message: "/works", sessionId })).code, 400);
  }
  assert.equal((await request("{malformed")).code, 400);
});

test("HTTP errors, malformed JSON, invalid artifacts and aborts stay generic", async () => {
  configure("http://127.0.0.1:8788/api/homepage/command");
  const responses = [
    () => new Response("private details", { status: 500 }),
    () => new Response("private details", { status: 200 }),
    () => new Response(JSON.stringify({ type: "text", text: "legacy" })),
    () => { throw new DOMException("private details", "TimeoutError"); },
  ];
  for (const response of responses) {
    global.fetch = async () => response();
    const res = await request();
    assert.equal(res.code, 502);
    assert.deepEqual(res.body, { error: "flow_unavailable" });
  }
});

test("artifact validation covers text, image, video and sanitized HTML", () => {
  assert.equal(handler.validArtifact(artifact({ blocks: [
    { type: "text", text: "hello" },
    { type: "image", src: "assets/flows/agentroam.svg" },
    { type: "video", src: "assets/work-flow.mp4", poster: "assets/work-flow.jpg" },
    { type: "html", html: "<section><strong>safe</strong></section>" },
  ] })), true);
  assert.equal(handler.validArtifact(artifact({
    blocks: [{ type: "html", html: "<img src=x onerror=alert(1)>" }],
  })), false);
  assert.equal(handler.validArtifact(artifact({
    blocks: [{ type: "image", src: "assets/../secret.png" }],
  })), false);
});
