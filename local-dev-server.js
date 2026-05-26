const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = __dirname;
const apiDir = path.join(projectRoot, "api");
const port = Number(process.env.PORT || 3000);

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(projectRoot, safePath);

  if (!filePath.startsWith(projectRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: "Not Found" });
    return;
  }

  const ext = path.extname(filePath);
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
  };

  res.statusCode = 200;
  res.setHeader("Content-Type", typeMap[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

function createLocalRes(nodeRes) {
  return {
    status(code) {
      nodeRes.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      nodeRes.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (!nodeRes.getHeader("Content-Type")) {
        nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      nodeRes.end(JSON.stringify(payload));
      return this;
    },
  };
}

async function handleApi(req, res) {
  const route = req.url.split("?")[0];
  const routeName = route.replace(/^\/api\//, "");
  const handlerPath = path.join(apiDir, `${routeName}.js`);

  if (!fs.existsSync(handlerPath)) {
    sendJson(res, 404, { error: "API route not found" });
    return;
  }

  try {
    delete require.cache[require.resolve(handlerPath)];
    const mod = require(handlerPath);
    const handler = typeof mod === "function" ? mod : mod?.default;
    const localRes = createLocalRes(res);

    if (typeof handler !== "function") {
      throw new TypeError(`API handler is not a function for route: ${routeName}`);
    }

    await handler(req, localRes);
  } catch (error) {
    console.error("[local-dev-server] API error", error);
    sendJson(res, 500, { error: "Internal Server Error" });
  }
}

loadEnvFile();

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Bad Request" });
    return;
  }

  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Local dev server running at http://localhost:${port}`);
});
