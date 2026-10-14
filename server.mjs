import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const extraDir = path.join(root, "extra_levels");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT) || 8080;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webp": "image/webp",
};

fs.mkdirSync(extraDir, { recursive: true });

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/levels" && req.method === "GET") {
    sendJson(res, 200, { levels: listSavedLevels() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/levels") {
    readBody(req)
      .then((body) => saveLevel(body, res))
      .catch((error) => sendJson(res, 400, { error: error.message || "Could not save the level." }));
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }
  serveStatic(url.pathname, req, res);
});

server.listen(port, host, () => {
  console.log(`Contraption workshop listening on http://${host}:${port}`);
});

function saveLevel(payload, res) {
  if (!payload || !Array.isArray(payload.fixtures) || !payload.goal) {
    sendJson(res, 400, { error: "The level needs fixtures and a goal." });
    return;
  }
  const hasStart = payload.fixtures.some((item) => item.part === "ball" && item.role === "hero");
  const hasGoal = payload.fixtures.some((item) => item.role === "goal");
  if (!hasStart || !hasGoal) {
    sendJson(res, 400, { error: "Place a start and an end before saving." });
    return;
  }
  const id = nextLevelId();
  const level = {
    id,
    name: `Level ${id}`,
    hint: payload.hint || "Bring the ball to the end.",
    fixtures: payload.fixtures,
    decors: Array.isArray(payload.decors) ? payload.decors : [],
    inventory: Array.isArray(payload.inventory) ? payload.inventory : [],
    goal: payload.goal,
    solution: Array.isArray(payload.solution) ? payload.solution : [],
    time: Number(payload.time) || 12,
  };
  const file = `level${id}.js`;
  const source = `// Saved from the level builder. Same fields as the tables in src/levels.js.\nexport const level = ${JSON.stringify(level, null, 2)};\n`;
  fs.writeFileSync(path.join(extraDir, file), source);
  writeIndex();
  sendJson(res, 200, { file, level });
}

function listSavedLevels() {
  return levelIds().map((id) => ({
    id,
    file: `level${id}.js`,
    name: readLevelName(id),
  }));
}

function readLevelName(id) {
  const source = fs.readFileSync(path.join(extraDir, `level${id}.js`), "utf8");
  const match = /"name":\s*"((?:\\.|[^"\\])*)"/.exec(source);
  if (!match) return `Level ${id}`;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return `Level ${id}`;
  }
}

function nextLevelId() {
  let max = 11;
  for (const id of levelIds()) max = Math.max(max, id);
  return max + 1;
}

function levelIds() {
  return fs
    .readdirSync(extraDir)
    .map((file) => /^level(\d+)\.js$/.exec(file))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
}

function writeIndex() {
  const ids = levelIds();
  const source = ids.length
    ? `${ids.map((id) => `import { level as level${id} } from "./level${id}.js";`).join("\n")}\n\nexport const levels = [${ids.map((id) => `level${id}`).join(", ")}];\n`
    : "export const levels = [];\n";
  fs.writeFileSync(path.join(extraDir, "index.js"), source);
}

function serveStatic(pathname, req, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, decodeURIComponent(requested)));
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const type = types[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("Level is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Level was not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
