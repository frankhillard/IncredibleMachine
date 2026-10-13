import { PARTS } from "./parts.js";
import {
  addBody,
  addRope,
  anchorPoint,
  bodyAtPoint,
  createBody,
  createWorld,
  distToSegment,
  linkFollowers,
  localFromWorld,
  step,
  syncFollowers,
  worldFromLocal,
} from "./physics.js";

export function createSession(level) {
  const world = createWorld();
  for (const spec of level.fixtures) {
    if (!spec.rope) addFixture(world, spec);
  }
  linkFollowers(world);
  for (const spec of level.fixtures) {
    if (!spec.rope) continue;
    const rope = addRope(world, anchorOpts(resolveAnchor(world, spec.a), resolveAnchor(world, spec.b)));
    rope.locked = true;
    rope.role = spec.role || null;
  }
  return {
    level,
    world,
    inventory: level.inventory.map((item) => ({
      ...item,
      remaining: item.count,
    })),
    playing: false,
    won: false,
    hold: 0,
    elapsed: 0,
    snapshot: null,
    showHint: false,
    slow: false,
    message: "",
  };
}

export function addFixture(world, spec) {
  const body = addBody(world, specToBody(spec, true));
  return body;
}

function specToBody(spec, locked) {
  if (spec.part) {
    const def = PARTS[spec.part];
    return createBody({
      ...def,
      ...spec,
      meta: { ...(def.meta || {}), ...(spec.meta || {}) },
      partType: spec.part,
      locked,
      w: spec.w || def.w,
      h: spec.h || def.h,
      r: spec.r || def.r,
    });
  }
  return createBody({ ...spec, locked });
}

export function spawnPart(session, type, x, y, angle = 0, extra = {}) {
  const def = PARTS[type];
  if (!def || def.tool === "rope") return null;
  const slot = session.inventory.find((item) => item.type === type && item.remaining > 0);
  if (!extra.free && !slot) return null;
  const body = addBody(
    session.world,
    createBody({
      ...def,
      ...extra,
      meta: { ...(def.meta || {}), ...(slot?.meta || {}), ...(extra.meta || {}) },
      partType: type,
      locked: false,
      x,
      y,
      angle,
      w: extra.w || slot?.w || def.w,
      h: extra.h || slot?.h || def.h,
      r: extra.r || slot?.r || def.r,
    }),
  );
  if (slot && !extra.free) slot.remaining -= 1;
  return body;
}

export function placeRope(session, a, b) {
  const slot = session.inventory.find((item) => item.type === "rope" && item.remaining > 0);
  if (!slot) return null;
  const rope = addRope(session.world, anchorOpts(a, b));
  rope.player = true;
  slot.remaining -= 1;
  return rope;
}

function resolveAnchor(world, desc) {
  if (!desc) return { x: 0, y: 0, body: null };
  if (desc.ref) {
    const body = world.bodies.find((candidate) => candidate.ref === desc.ref && candidate.alive);
    return { body, lx: desc.lx || 0, ly: desc.ly || 0, x: body?.x ?? 0, y: body?.y ?? 0 };
  }
  return { x: desc.x, y: desc.y, body: null };
}

export function moveBody(body, x, y, angle = body.angle) {
  body.x = x;
  body.y = y;
  body.angle = angle;
  body.vx = 0;
  body.vy = 0;
  body.av = 0;
  if (body.pinned) {
    body.pinX = x;
    body.pinY = y;
  }
}

function anchorOpts(a, b) {
  return {
    a: a.body || null,
    alx: a.lx || 0,
    aly: a.ly || 0,
    wx: a.x,
    wy: a.y,
    b: b.body || null,
    blx: b.lx || 0,
    bly: b.ly || 0,
    wx2: b.x,
    wy2: b.y,
  };
}

export function anchorFromPoint(world, x, y) {
  const body = bodyAtPoint(world, x, y);
  if (!body || body.sensor) return { x, y, body: null };
  const local = localFromWorld(body, x, y);
  return { x, y, body, lx: local.x, ly: local.y };
}

export function removeBody(session, body) {
  if (!body || body.locked || !body.alive) return false;
  const world = session.world;
  const ids = new Set([body.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const other of world.bodies) {
      if (other.follow && ids.has(other.follow.id) && !ids.has(other.id)) {
        ids.add(other.id);
        grew = true;
      }
    }
  }
  world.bodies = world.bodies.filter((candidate) => !ids.has(candidate.id));
  world.constraints = world.constraints.filter((rope) => {
    const aId = rope.a?.id;
    const bId = rope.b?.id;
    return !ids.has(aId) && !ids.has(bId);
  });
  const slot = session.inventory.find((item) => item.type === body.partType);
  if (slot && !body.builderKind) slot.remaining += 1;
  return true;
}

export function removeRope(session, rope) {
  if (!rope || rope.locked) return false;
  session.world.constraints = session.world.constraints.filter((item) => item !== rope);
  if (rope.player) {
    const slot = session.inventory.find((item) => item.type === "rope");
    if (slot) slot.remaining += 1;
  }
  return true;
}

export function ropeAtPoint(world, x, y) {
  let best = null;
  let bestDist = 12;
  for (const rope of world.constraints) {
    if (rope.broken || rope.type !== "rope") continue;
    const pa = anchorPoint(rope, "a");
    const pb = anchorPoint(rope, "b");
    const dist = distToSegment(x, y, pa.x, pa.y, pb.x, pb.y);
    if (dist < bestDist) {
      best = rope;
      bestDist = dist;
    }
  }
  return best;
}

export function play(session) {
  if (session.playing) return;
  session.snapshot = capture(session.world);
  session.playing = true;
  session.won = false;
  session.hold = 0;
  session.elapsed = 0;
  session.message = "";
  for (const body of session.world.bodies) {
    if (!body.alive) continue;
    body.springCooldown = 0;
    if (body.nudge) {
      body.vx += body.nudge.vx || 0;
      body.vy += body.nudge.vy || 0;
    }
    if (body.nudgeAv) body.av += body.nudgeAv;
  }
}

export function stop(session) {
  if (session.snapshot) restore(session.world, session.snapshot);
  session.playing = false;
  session.won = false;
  session.hold = 0;
  session.message = "";
  syncFollowers(session.world);
}

function capture(world) {
  return {
    bodies: world.bodies.map((body) => ({
      id: body.id,
      x: body.x,
      y: body.y,
      angle: body.angle,
      alive: body.alive,
    })),
    constraints: world.constraints.map((rope) => ({
      id: rope.id,
      broken: rope.broken,
    })),
  };
}

function restore(world, snap) {
  for (const saved of snap.bodies) {
    const body = world.bodies.find((candidate) => candidate.id === saved.id);
    if (!body) continue;
    body.x = saved.x;
    body.y = saved.y;
    body.angle = saved.angle;
    body.vx = 0;
    body.vy = 0;
    body.av = 0;
    body.alive = saved.alive;
    body.springCooldown = 0;
    if (body.pinned) {
      body.pinX = saved.x;
      body.pinY = saved.y;
    }
  }
  for (const saved of snap.constraints) {
    const rope = world.constraints.find((candidate) => candidate.id === saved.id);
    if (!rope) continue;
    rope.broken = saved.broken;
    rope.heat = 0;
  }
}

export function stepSession(session, dt) {
  const events = [];
  if (!session.playing) {
    syncFollowers(session.world);
    return events;
  }
  session.elapsed += dt;
  const world = session.world;
  world.beforeSubstep = (subDt) => {
    driveFans(world, subDt);
    driveScamps(world);
  };
  step(world, dt);
  events.push(...applySprings(world, dt));
  events.push(...applyFlames(world, dt));
  if (!session.won && goalMet(session, dt)) {
    session.won = true;
    events.push({ type: "win" });
  } else if (!session.won && session.elapsed > 18 && !session.message) {
    session.message = "Still going. Stop and nudge a part if it looks stuck.";
  }
  if (world.impact > 80) {
    events.push({ type: "impact", impulse: world.impact });
  }
  return events;
}

function driveFans(world, dt) {
  for (const fan of world.bodies) {
    const wind = fan.meta?.fan;
    if (!fan.alive || !wind) continue;
    const c = Math.cos(fan.angle);
    const s = Math.sin(fan.angle);
    for (const body of world.bodies) {
      if (body === fan || !body.alive || body.invMass <= 0) continue;
      const dx = body.x - fan.x;
      const dy = body.y - fan.y;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      if (lx < fan.hw - 4 || lx > fan.hw + wind.len) continue;
      if (Math.abs(ly) > wind.spread / 2) continue;
      const accel = wind.power / Math.max(body.mass, 0.2);
      body.vx += c * accel * dt;
      body.vy += s * accel * dt;
    }
  }
}

function driveScamps(world) {
  for (const scamp of world.bodies) {
    const targetName = scamp.meta?.scamp;
    if (!scamp.alive || !targetName || !scamp.grounded) continue;
    const target = world.bodies.find(
      (body) => body.alive && (body.role === targetName || body.partType === targetName),
    );
    if (!target) continue;
    const dx = target.x - scamp.x;
    if (Math.abs(dx) < 8) continue;
    scamp.vx = Math.sign(dx) * (scamp.meta.speed || 90);
  }
}

function applySprings(world, dt) {
  const events = [];
  for (const body of world.bodies) {
    if (body.springCooldown > 0) body.springCooldown = Math.max(0, body.springCooldown - dt);
  }
  for (const contact of world.contacts) {
    if (contact.sensor) continue;
    const springBody = contact.a.meta?.spring ? contact.a : contact.b.meta?.spring ? contact.b : null;
    if (!springBody) continue;
    const other = springBody === contact.a ? contact.b : contact.a;
    if (!other.alive || other.invMass <= 0 || other.springCooldown > 0) continue;
    const ux = Math.sin(springBody.angle);
    const uy = -Math.cos(springBody.angle);
    const pushX = other === contact.a ? -contact.nx : contact.nx;
    const pushY = other === contact.a ? -contact.ny : contact.ny;
    if (pushX * ux + pushY * uy < 0.5) continue;
    const along = other.vx * ux + other.vy * uy;
    const power = springBody.meta.spring;
    if (along > 80) continue;
    other.vx += ux * (power - along);
    other.vy += uy * (power - along);
    other.springCooldown = 0.35;
    events.push({ type: "spring", x: other.x, y: other.y });
  }
  return events;
}

function applyFlames(world, dt) {
  const events = [];
  const flames = [];
  for (const body of world.bodies) {
    if (!body.alive || !body.meta?.flame) continue;
    const flame = body.meta.flame;
    const point = worldFromLocal(body, 0, flame.oy ?? -(body.hh + 8));
    flames.push({ x: point.x, y: point.y, r: flame.r ?? 28, rate: flame.rate ?? 1 });
  }
  if (!flames.length) return events;

  for (const rope of world.constraints) {
    if (rope.broken || rope.type !== "rope") continue;
    const pa = anchorPoint(rope, "a");
    const pb = anchorPoint(rope, "b");
    let heating = false;
    for (const flame of flames) {
      if (distToSegment(flame.x, flame.y, pa.x, pa.y, pb.x, pb.y) <= flame.r) {
        rope.heat += flame.rate * dt;
        heating = true;
      }
    }
    if (!heating) rope.heat = Math.max(0, rope.heat - dt * 0.3);
    if (rope.heat >= 1) {
      rope.broken = true;
      events.push({ type: "burn", x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 });
    }
  }

  for (const body of world.bodies) {
    if (!body.alive || body.partType !== "balloon" && body.style !== "balloon") continue;
    for (const flame of flames) {
      if (Math.hypot(body.x - flame.x, body.y - flame.y) <= flame.r + body.r * 0.55) {
        popBalloon(world, body, events);
        break;
      }
    }
  }
  return events;
}

function popBalloon(world, balloon, events) {
  balloon.alive = false;
  balloon.vx = 0;
  balloon.vy = 0;
  for (const rope of world.constraints) {
    if (rope.a === balloon || rope.b === balloon) rope.broken = true;
  }
  events.push({ type: "pop", x: balloon.x, y: balloon.y });
}

function goalMet(session, dt) {
  const goal = session.level.goal;
  if (!goal) return false;
  if (goal.type === "tipped") {
    const bodies = matches(session.world, goal.match).filter((body) => body.alive);
    const ok = bodies.some((body) => Math.abs(body.angle) >= (goal.minAngle ?? 1));
    session.hold = ok ? session.hold + dt : 0;
    return session.hold >= (goal.hold ?? 0.2);
  }
  if (goal.type === "overlap") {
    const left = matches(session.world, goal.matchA);
    const right = matches(session.world, goal.matchB);
    return left.some((a) =>
      right.some((b) => a !== b && a.alive && b.alive && touch(a, b)),
    );
  }
  const zone = session.world.bodies.find((body) => body.role === (goal.zone || "goal") && body.alive);
  const bodies = matches(session.world, goal.match).filter((body) => body.alive && body.invMass > 0);
  if (!zone || bodies.length === 0) {
    session.hold = 0;
    return false;
  }
  const maxSpeed = goal.maxSpeed ?? 320;
  const inside = (body) =>
    centerIn(body, zone) && Math.hypot(body.vx, body.vy) <= maxSpeed;
  const ok = goal.mode === "all" ? bodies.every(inside) : bodies.some(inside);
  session.hold = ok ? session.hold + dt : 0;
  return session.hold >= (goal.hold ?? 0.32);
}

function matches(world, name) {
  return world.bodies.filter(
    (body) => body.partType === name || body.role === name || body.style === name,
  );
}

function centerIn(body, zone) {
  if (zone.shape === "circle") return Math.hypot(body.x - zone.x, body.y - zone.y) <= zone.r;
  const local = localFromWorld(zone, body.x, body.y);
  return Math.abs(local.x) <= zone.hw && Math.abs(local.y) <= zone.hh;
}

function touch(a, b) {
  if (a.shape === "circle" && b.shape === "circle") {
    return Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + 4;
  }
  return centerIn(a, b) || centerIn(b, a);
}

export function describe(session) {
  return session.world.bodies
    .filter((body) => body.alive && !body.static)
    .map(
      (body) =>
        `${body.partType || body.role || body.style}@${body.x.toFixed(0)},${body.y.toFixed(0)} a=${body.angle.toFixed(2)} v=${Math.hypot(body.vx, body.vy).toFixed(0)}`,
    )
    .join(" | ");
}

export { createWorld };
