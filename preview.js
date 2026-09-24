/* Local equivalent of the Vercel static site + /api/command function. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const command = require("./api/command.js");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4",
  ".svg": "image/svg+xml; charset=utf-8",
};

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/command") {
    res.status = (status) => { res.statusCode = status; return res; };
    res.json = (body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16000) return res.status(413).json({ error: "request_too_large" });
    }
    req.body = body || "{}";
    return command(req, res);
  }
  const file = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  if (!/^(index\.html|main\.js|style\.css|site-config\.js|media-map\.js|content-snapshot\.js|portfolio-core\.js|assets\/[a-zA-Z0-9_./-]+)$/.test(file)
      || file.split("/").includes("..")) {
    res.writeHead(404); return res.end();
  }
  const target = path.resolve(__dirname, file);
  if (!target.startsWith(`${path.resolve(__dirname)}${path.sep}`)) {
    res.writeHead(404); return res.end();
  }
  try {
    const stat = fs.statSync(target);
    const headers = { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    let start = range ? Number(range[1]) : 0;
    let end = range && range[2] ? Number(range[2]) : stat.size - 1;
    if (start > end || end >= stat.size) { res.writeHead(416); return res.end(); }
    headers["Content-Length"] = end - start + 1;
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(target, { start, end }).pipe(res);
  } catch { res.writeHead(404); res.end(); }
}).listen(Number(process.env.PORT || 8801), process.env.HOST || "0.0.0.0", () => {
  console.log(`Homepage preview: http://${process.env.HOST || "0.0.0.0"}:${process.env.PORT || 8801}`);
});
