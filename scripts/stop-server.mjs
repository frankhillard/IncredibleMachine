import { execFileSync } from "node:child_process";

const port = String(process.env.PORT || 8080);

function run(args) {
  try {
    return execFileSync("lsof", args, { encoding: "utf8" });
  } catch (error) {
    if (error.status === 1) return "";
    throw error;
  }
}

const listing = run(["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]).trim();
if (!listing) {
  console.log(`No server is listening on port ${port}.`);
  process.exit(0);
}

console.log(listing);
const pids = [
  ...new Set(
    run(["-t", `-iTCP:${port}`, "-sTCP:LISTEN"])
      .split(/\s+/)
      .map((pid) => pid.trim())
      .filter(Boolean),
  ),
];

for (const pid of pids) {
  process.kill(Number(pid), "SIGTERM");
  console.log(`Stopped process ${pid} on port ${port}.`);
}
