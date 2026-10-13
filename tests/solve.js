import { LEVELS } from "../src/levels.js";
import { createSession, describe, play, spawnPart, stepSession } from "../src/session.js";

const only = process.env.LEVEL ? Number(process.env.LEVEL) : 0;
const trace = process.env.TRACE === "1";
let failed = 0;

function run(level, placement, seconds) {
  const session = createSession(level);
  for (const part of placement) {
    const body = spawnPart(session, part.type, part.x, part.y, part.angle || 0, part);
    if (!body) {
      return { won: false, error: `could not place ${part.type}`, session };
    }
  }
  play(session);
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    stepSession(session, 1 / 60);
    if (trace && i % 30 === 0) {
      console.log(`  t=${(i / 60).toFixed(1)} ${describe(session)} hold=${session.hold.toFixed(2)} won=${session.won}`);
    }
    if (session.won) return { won: true, session, t: i / 60 };
  }
  return { won: false, session };
}

for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  if (!level.solution) continue;
  const solved = run(level, level.solution, level.time || 12);
  const empty = run(level, [], Math.min(6, level.time || 6));
  let trapsOk = true;
  let trapDetail = "";
  for (const trap of level.traps || []) {
    const result = run(level, trap, Math.min(8, level.time || 8));
    if (result.won) {
      trapsOk = false;
      trapDetail = JSON.stringify(trap);
    }
  }
  const ok = solved.won && !empty.won && trapsOk;
  if (ok) {
    console.log(`ok  ${level.id} ${level.name} in ${solved.t.toFixed(2)}s`);
  } else {
    failed += 1;
    console.error(
      `FAIL ${level.id} ${level.name} solved=${solved.won} emptyWon=${empty.won} trapsOk=${trapsOk} ${trapDetail} ${solved.error || ""}`,
    );
    console.error(`  end: ${describe(solved.session)}`);
  }
}

if (failed) {
  console.error(`\n${failed} level(s) failed`);
  process.exit(1);
}
console.log("\nall solvable levels ok");
