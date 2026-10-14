import { frame } from "./levels.js";
import { PARTS, PART_ORDER } from "./parts.js";
import { addBody, anchorPoint, createBody } from "./physics.js";
import { createSession, moveBody, spawnPart } from "./session.js";

const GOAL_W = 180;
const GOAL_H = 64;
export const MARKER_ROLES = ["ball", "balloon", "domino"];

export function blankBuilderLevel() {
  return {
    id: "builder",
    name: "Level builder",
    hint: "Place Start and End, then choose ball, balloon, or domino.",
    builder: true,
    fixtures: frame(),
    decors: [],
    inventory: PART_ORDER.map((type) => ({ type, count: 24 })),
    goal: defaultGoal(),
    solution: [],
    time: 12,
  };
}

export function sessionFromSaved(level) {
  const session = createSession({
    ...blankBuilderLevel(),
    name: level.name || `Level ${level.id}`,
    hint: level.hint || "Bring the ball to the end.",
    fixtures: level.fixtures?.length ? level.fixtures : frame(),
    decors: level.decors || [],
    goal: level.goal || defaultGoal(),
    time: level.time || 12,
  });
  for (const body of session.world.bodies) {
    if (body.style === "frame") continue;
    if (body.role === "hero" && body.partType) {
      body.builderKind = "start";
      body.builderLayer = "fixed";
      body.locked = false;
      continue;
    }
    if (body.role === "goal" && body.sensor) {
      const pin = addBody(
        session.world,
        createBody({
          shape: "circle",
          r: 14,
          x: body.x,
          y: body.y,
          angle: body.angle,
          static: true,
          locked: false,
          style: "goalpin",
        }),
      );
      pin.builderKind = "goal-pin";
      pin.goalRole = session.level.goal?.match || "ball";
      body.builderKind = "goal";
      body.goalRole = pin.goalRole;
      body.follow = { id: pin.id, lx: 0, ly: 0, angle: 0 };
      continue;
    }
    if (body.partType) {
      body.builderLayer = "fixed";
      body.locked = false;
    }
  }
  for (const rope of session.world.constraints) {
    if (rope.type !== "rope") continue;
    rope.locked = false;
    rope.builderLayer = "fixed";
  }
  for (const part of level.solution || []) {
    const body = spawnPart(session, part.type, part.x, part.y, part.angle || 0, part);
    if (body) body.builderLayer = "solution";
  }
  return session;
}

export function placeStart(session, x, y, role) {
  const existing = session.world.bodies.find((body) => body.alive && body.builderKind === "start");
  const kind = normalizeRole(role || existing?.partType || "ball");
  if (existing && existing.partType === kind) {
    moveBody(existing, x, y, existing.angle);
    return existing;
  }
  const angle = existing?.angle || 0;
  const body = addBody(
    session.world,
    createBody({
      ...PARTS[kind],
      x,
      y,
      angle,
      partType: kind,
      role: "hero",
      locked: false,
    }),
  );
  body.builderKind = "start";
  body.builderLayer = "fixed";
  if (existing) replaceBody(session, existing, body);
  return body;
}

export function placeGoal(session, x, y, angle = 0, role) {
  const pin = session.world.bodies.find((body) => body.alive && body.builderKind === "goal-pin");
  const kind = normalizeRole(role || pin?.goalRole || session.level.goal?.match || "ball");
  session.level.goal = goalFor(kind, session.level.goal);
  if (pin) {
    moveBody(pin, x, y, angle);
    pin.goalRole = kind;
    const zone = session.world.bodies.find((body) => body.builderKind === "goal");
    if (zone) zone.goalRole = kind;
    return pin;
  }
  const pinBody = addBody(
    session.world,
    createBody({
      shape: "circle",
      r: 14,
      x,
      y,
      angle,
      static: true,
      locked: false,
      style: "goalpin",
    }),
  );
  pinBody.builderKind = "goal-pin";
  pinBody.goalRole = kind;
  const zone = addBody(
    session.world,
    createBody({
      shape: "box",
      w: GOAL_W,
      h: GOAL_H,
      x,
      y,
      angle,
      sensor: true,
      role: "goal",
      style: "sensor",
    }),
  );
  zone.builderKind = "goal";
  zone.goalRole = kind;
  zone.follow = { id: pinBody.id, lx: 0, ly: 0, angle: 0 };
  return pinBody;
}

export function captureLevel(session) {
  const world = session.world;
  const start = world.bodies.find((body) => body.alive && body.builderKind === "start");
  const goal = world.bodies.find((body) => body.alive && body.role === "goal");
  if (!start || !goal) {
    return { error: "Place a start and an end before saving." };
  }

  const refs = new Map();
  const refFor = (body) => {
    if (!refs.has(body)) refs.set(body, `part${refs.size + 1}`);
    return refs.get(body);
  };

  const ropes = world.constraints.filter((rope) => rope.type === "rope" && !rope.broken);
  for (const rope of ropes) {
    if (rope.builderLayer === "solution") continue;
    for (const end of ["a", "b"]) {
      const body = rope[end];
      if (body?.alive && ownsFixture(body)) refFor(body);
    }
  }

  const fixtures = [];
  const solution = [];
  for (const body of world.bodies) {
    if (!body.alive || body.builderKind === "goal-pin") continue;
    if (body.follow && body.role !== "goal") continue;
    if (body.builderKind === "start") {
      fixtures.push(partFixture(body, refFor, refs));
      continue;
    }
    if (body.role === "goal") {
      fixtures.push(boxFixture(body));
      continue;
    }
    if (!body.partType) {
      fixtures.push(boxFixture(body));
      continue;
    }
    if (body.builderLayer === "solution") solution.push(solutionPart(body));
    else fixtures.push(partFixture(body, refFor, refs));
  }

  let playerRopes = 0;
  for (const rope of ropes) {
    if (rope.builderLayer === "solution") {
      playerRopes += 1;
      continue;
    }
    fixtures.push({
      rope: true,
      a: anchorSpec(rope, "a", refFor),
      b: anchorSpec(rope, "b", refFor),
    });
  }

  return {
    level: {
      name: "Level",
      hint: `Bring the ${markerRole(session)} to the end.`,
      fixtures,
      decors: [],
      inventory: inventoryFrom(solution, playerRopes),
      goal: goalFor(markerRole(session), session.level.goal),
      solution,
      time: 12,
    },
  };
}

function defaultGoal() {
  return goalFor("ball");
}

function goalFor(match, previous) {
  const kind = normalizeRole(match);
  return {
    type: "contain",
    match: kind,
    zone: "goal",
    mode: "any",
    hold: previous?.hold ?? 0.3,
    maxSpeed: kind === "balloon" ? 1200 : 360,
  };
}

function markerRole(session) {
  const pin = session.world.bodies.find((body) => body.alive && body.builderKind === "goal-pin");
  return normalizeRole(pin?.goalRole || session.level.goal?.match || "ball");
}

function normalizeRole(role) {
  return MARKER_ROLES.includes(role) ? role : "ball";
}

function replaceBody(session, previous, next) {
  for (const rope of session.world.constraints) {
    if (rope.a === previous) rope.a = next;
    if (rope.b === previous) rope.b = next;
  }
  session.world.bodies = session.world.bodies.filter((body) => body !== previous);
}

function ownsFixture(body) {
  if (!body || body.builderKind === "goal-pin") return false;
  if (body.builderLayer === "solution") return false;
  return true;
}

function anchorSpec(rope, which, refFor) {
  const body = rope[which];
  const lx = which === "a" ? rope.alx : rope.blx;
  const ly = which === "a" ? rope.aly : rope.bly;
  if (body?.alive && ownsFixture(body)) {
    return { ref: refFor(body), lx: round(lx), ly: round(ly) };
  }
  const point = anchorPoint(rope, which);
  return { x: round(point.x), y: round(point.y) };
}

function partFixture(body, refFor, refs) {
  const spec = partFields(body);
  spec.part = body.partType;
  delete spec.type;
  if (body.builderKind === "start") spec.role = "hero";
  else if (body.role) spec.role = body.role;
  if (refs.has(body)) spec.ref = refFor(body);
  return spec;
}

function solutionPart(body) {
  const spec = partFields(body);
  return spec;
}

function partFields(body) {
  const def = PARTS[body.partType] || {};
  const spec = {
    type: body.partType,
    x: round(body.x),
    y: round(body.y),
  };
  if (Math.abs(body.angle) > 0.001) spec.angle = round(body.angle);
  if (def.shape === "circle") {
    if (def.r && Math.abs(body.r - def.r) > 0.1) spec.r = round(body.r);
  } else if (def.w) {
    const w = round(body.hw * 2);
    const h = round(body.hh * 2);
    if (w !== def.w) spec.w = w;
    if (h !== def.h) spec.h = h;
  }
  if (body.meta && Object.keys(body.meta).length && JSON.stringify(body.meta) !== JSON.stringify(def.meta || {})) {
    spec.meta = body.meta;
  }
  return spec;
}

function boxFixture(body) {
  const spec = {
    shape: body.shape,
    x: round(body.x),
    y: round(body.y),
    static: true,
  };
  if (body.shape === "circle") spec.r = round(body.r);
  else {
    spec.w = round(body.hw * 2);
    spec.h = round(body.hh * 2);
  }
  if (Math.abs(body.angle) > 0.001) spec.angle = round(body.angle);
  if (body.sensor) spec.sensor = true;
  if (body.role) spec.role = body.role;
  if (body.style) spec.style = body.style;
  if (body.friction != null) spec.friction = round(body.friction);
  if (body.restitution != null) spec.restitution = round(body.restitution);
  return spec;
}

function inventoryFrom(solution, ropeCount) {
  const slots = new Map();
  for (const part of solution) {
    const slot = slots.get(part.type) || { type: part.type, count: 0 };
    slot.count += 1;
    if (part.w && slot.w == null) slot.w = part.w;
    if (part.h && slot.h == null) slot.h = part.h;
    if (part.r && slot.r == null) slot.r = part.r;
    if (part.meta && !slot.meta) slot.meta = part.meta;
    slots.set(part.type, slot);
  }
  const inventory = [...slots.values()];
  if (ropeCount > 0) inventory.push({ type: "rope", count: ropeCount });
  return inventory;
}

function round(value) {
  const n = Math.round(value * 100) / 100;
  return Object.is(n, -0) ? 0 : n;
}
