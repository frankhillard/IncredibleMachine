// Small 2D rigid-body engine. Y grows downward. Positive angles rotate clockwise.

export function createWorld() {
  return {
    gravityY: 1100,
    bodies: [],
    constraints: [],
    contacts: [],
    nextId: 1,
    time: 0,
    impact: 0,
    beforeSubstep: null,
  };
}

export function createBody(spec) {
  const shape = spec.shape || "box";
  const body = {
    id: 0,
    shape,
    x: spec.x || 0,
    y: spec.y || 0,
    angle: spec.angle || 0,
    vx: spec.vx || 0,
    vy: spec.vy || 0,
    av: spec.av || 0,
    r: spec.r ?? 16,
    hw: (spec.w ?? 40) / 2,
    hh: (spec.h ?? 40) / 2,
    mass: spec.mass ?? 1,
    friction: spec.friction ?? 0.4,
    restitution: spec.restitution ?? 0.1,
    gravityScale: spec.gravityScale ?? 1,
    static: !!spec.static,
    sensor: !!spec.sensor,
    pinned: !!spec.pinned,
    fixedRotation: !!spec.fixedRotation,
    drag: spec.drag || 0,
    linearDamp: spec.linearDamp ?? 0.12,
    angularDamp: spec.angularDamp ?? 0.9,
    alive: true,
    locked: !!spec.locked,
    role: spec.role || null,
    partType: spec.partType || null,
    style: spec.style || "wood",
    meta: spec.meta ? { ...spec.meta } : {},
    nudge: spec.nudge || null,
    nudgeAv: spec.nudgeAv || 0,
    ref: spec.ref || null,
    follow: null,
    followRef: spec.followRef || null,
    followLx: spec.lx ?? 0,
    followLy: spec.ly ?? 0,
    followAngle: spec.followAngle || 0,
    grounded: false,
    springCooldown: 0,
  };
  if (body.followRef) body.static = true;
  if (body.sensor) body.static = true;
  applyMass(body);
  if (body.pinned) {
    body.pinX = body.x;
    body.pinY = body.y;
  }
  return body;
}

function applyMass(body) {
  if (body.shape === "circle") {
    body.inertia = 0.5 * body.mass * body.r * body.r;
  } else {
    const w = body.hw * 2;
    const h = body.hh * 2;
    body.inertia = (body.mass * (w * w + h * h)) / 12;
  }
  body.invMass = 0;
  body.invInertia = 0;
  if (body.static) return;
  if (body.mass > 0) body.invMass = 1 / body.mass;
  if (body.pinned) {
    body.invMass = 0;
    body.invInertia = body.inertia > 0 ? 1 / body.inertia : 0;
    return;
  }
  if (!body.fixedRotation && body.inertia > 0) body.invInertia = 1 / body.inertia;
}

export function addBody(world, body) {
  body.id = world.nextId++;
  world.bodies.push(body);
  return body;
}

export function worldFromLocal(body, lx, ly) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  return {
    x: body.x + lx * c - ly * s,
    y: body.y + lx * s + ly * c,
  };
}

export function localFromWorld(body, wx, wy) {
  const dx = wx - body.x;
  const dy = wy - body.y;
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

function velAt(body, wx, wy) {
  const rx = wx - body.x;
  const ry = wy - body.y;
  return { x: body.vx - body.av * ry, y: body.vy + body.av * rx };
}

export function addRope(world, opts) {
  const rope = {
    id: world.nextId++,
    type: "rope",
    a: opts.a || null,
    b: opts.b || null,
    alx: opts.alx || 0,
    aly: opts.aly || 0,
    blx: opts.blx || 0,
    bly: opts.bly || 0,
    wx: opts.wx ?? 0,
    wy: opts.wy ?? 0,
    wx2: opts.wx2 ?? 0,
    wy2: opts.wy2 ?? 0,
    rest: opts.rest ?? 0,
    broken: false,
    heat: 0,
    role: opts.role || null,
  };
  if (!opts.rest) {
    const pa = anchorPoint(rope, "a");
    const pb = anchorPoint(rope, "b");
    rope.rest = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  }
  world.constraints.push(rope);
  return rope;
}

export function anchorPoint(rope, which) {
  if (which === "a") {
    if (rope.a?.alive) return worldFromLocal(rope.a, rope.alx, rope.aly);
    return { x: rope.wx, y: rope.wy };
  }
  if (rope.b?.alive) return worldFromLocal(rope.b, rope.blx, rope.bly);
  return { x: rope.wx2, y: rope.wy2 };
}

export function syncFollowers(world) {
  const byId = new Map(world.bodies.map((b) => [b.id, b]));
  for (const body of world.bodies) {
    if (!body.follow || !body.alive) continue;
    const parent = byId.get(body.follow.id);
    if (!parent?.alive) continue;
    const pose = worldFromLocal(parent, body.follow.lx, body.follow.ly);
    const rx = pose.x - parent.x;
    const ry = pose.y - parent.y;
    body.x = pose.x;
    body.y = pose.y;
    body.angle = parent.angle + body.follow.angle;
    body.vx = parent.vx - parent.av * ry;
    body.vy = parent.vy + parent.av * rx;
    body.av = parent.av;
  }
}

export function linkFollowers(world) {
  const byRef = new Map();
  for (const body of world.bodies) {
    if (body.ref) byRef.set(body.ref, body);
  }
  for (const body of world.bodies) {
    if (!body.followRef) continue;
    const parent = byRef.get(body.followRef);
    if (!parent) continue;
    body.follow = {
      id: parent.id,
      lx: body.followLx,
      ly: body.followLy,
      angle: body.followAngle,
    };
    body.static = true;
    applyMass(body);
  }
  syncFollowers(world);
}

export function step(world, dt) {
  dt = Math.min(Math.max(dt, 0), 1 / 20);
  const sub = 4;
  const h = dt / sub;
  world.impact = 0;
  let contacts = [];
  for (let i = 0; i < sub; i++) {
    world.beforeSubstep?.(h);
    syncFollowers(world);
    integrate(world, h);
    contacts = detect(world);
    for (const c of contacts) c.jn = 0;
    for (let k = 0; k < 8; k++) {
      solveVelocities(world, contacts);
      solveRopes(world, h);
    }
    correctPositions(contacts);
    settle(contacts);
  }
  world.contacts = contacts;
  markGrounded(world, contacts);
  world.time += dt;
}

function integrate(world, dt) {
  const g = world.gravityY;
  for (const b of world.bodies) {
    if (!b.alive || b.static) continue;
    if (b.invMass > 0) {
      b.vy += g * b.gravityScale * dt;
      const damp = Math.exp(-(b.linearDamp + b.drag) * dt);
      b.vx *= damp;
      b.vy *= damp;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    if (b.invInertia > 0) {
      b.av *= Math.exp(-b.angularDamp * dt);
      b.angle += b.av * dt;
    }
    if (b.pinned) {
      b.x = b.pinX;
      b.y = b.pinY;
      b.vx = 0;
      b.vy = 0;
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 1600) {
      b.vx = (b.vx / sp) * 1600;
      b.vy = (b.vy / sp) * 1600;
    }
    if (b.av > 18) b.av = 18;
    if (b.av < -18) b.av = -18;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) {
      b.alive = false;
    }
  }
}

function detect(world) {
  const contacts = [];
  const bodies = world.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (!b.alive) continue;
      if (a.static && b.static) continue;
      if (a.follow && a.follow.id === b.id) continue;
      if (b.follow && b.follow.id === a.id) continue;
      if (a.follow && b.follow && a.follow.id === b.follow.id) continue;
      const hit = collide(a, b);
      if (!hit) continue;
      contacts.push({ a, b, ...hit, sensor: a.sensor || b.sensor });
    }
  }
  return contacts;
}

function collide(a, b) {
  if (a.shape === "circle" && b.shape === "circle") return circleCircle(a, b);
  if (a.shape === "circle" && b.shape === "box") return circleBox(a, b);
  if (a.shape === "box" && b.shape === "circle") {
    const hit = circleBox(b, a);
    if (!hit) return null;
    return { ...hit, nx: -hit.nx, ny: -hit.ny };
  }
  return boxBox(a, b);
}

function circleCircle(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const rad = a.r + b.r;
  if (dist >= rad) return null;
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    nx,
    ny,
    pen: rad - dist,
    px: a.x + nx * a.r,
    py: a.y + ny * a.r,
  };
}

// Normal points from the circle toward the box (circle is body A).
function circleBox(circle, box) {
  const c = Math.cos(box.angle);
  const s = Math.sin(box.angle);
  const dx = circle.x - box.x;
  const dy = circle.y - box.y;
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  let clx = clamp(lx, -box.hw, box.hw);
  let cly = clamp(ly, -box.hh, box.hh);
  const inside = lx === clx && ly === cly;
  let lnx;
  let lny;
  let pen;
  let cpx;
  let cpy;
  if (inside) {
    const px = box.hw - Math.abs(lx);
    const py = box.hh - Math.abs(ly);
    if (px < py) {
      lnx = lx >= 0 ? 1 : -1;
      lny = 0;
      pen = px + circle.r;
      cpx = lx >= 0 ? box.hw : -box.hw;
      cpy = ly;
    } else {
      lnx = 0;
      lny = ly >= 0 ? 1 : -1;
      pen = py + circle.r;
      cpx = lx;
      cpy = ly >= 0 ? box.hh : -box.hh;
    }
  } else {
    const ox = lx - clx;
    const oy = ly - cly;
    const d = Math.hypot(ox, oy);
    if (d >= circle.r) return null;
    lnx = ox / (d || 1);
    lny = oy / (d || 1);
    pen = circle.r - d;
    cpx = clx;
    cpy = cly;
  }
  // Local normal currently points from box to circle. Flip so it points circle -> box.
  const wx = lnx * c - lny * s;
  const wy = lnx * s + lny * c;
  const contact = worldFromLocal(box, cpx, cpy);
  return { nx: -wx, ny: -wy, pen, px: contact.x, py: contact.y };
}

function boxBox(a, b) {
  const axes = [...axesOf(a), ...axesOf(b)];
  let minPen = Infinity;
  let nx = 0;
  let ny = 0;
  for (const axis of axes) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null;
    if (overlap < minPen) {
      minPen = overlap;
      nx = axis.x;
      ny = axis.y;
    }
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx * nx + dy * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const verts = [];
  collectPenetrating(a, b, verts);
  collectPenetrating(b, a, verts);
  let px;
  let py;
  if (verts.length) {
    px = verts.reduce((sum, p) => sum + p.x, 0) / verts.length;
    py = verts.reduce((sum, p) => sum + p.y, 0) / verts.length;
  } else {
    const pa = support(a, nx, ny);
    const pb = support(b, -nx, -ny);
    px = (pa.x + pb.x) / 2;
    py = (pa.y + pb.y) / 2;
  }
  return { nx, ny, pen: minPen, px, py };
}

function collectPenetrating(body, other, out) {
  for (const lx of [-body.hw, body.hw]) {
    for (const ly of [-body.hh, body.hh]) {
      const point = worldFromLocal(body, lx, ly);
      const local = localFromWorld(other, point.x, point.y);
      if (Math.abs(local.x) <= other.hw + 0.75 && Math.abs(local.y) <= other.hh + 0.75) {
        out.push(point);
      }
    }
  }
}

function axesOf(b) {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return [
    { x: c, y: s },
    { x: -s, y: c },
  ];
}

function project(b, axis) {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const ux = c;
  const uy = s;
  const vx = -s;
  const vy = c;
  const radius =
    b.hw * Math.abs(axis.x * ux + axis.y * uy) +
    b.hh * Math.abs(axis.x * vx + axis.y * vy);
  const center = b.x * axis.x + b.y * axis.y;
  return { min: center - radius, max: center + radius };
}

function support(b, nx, ny) {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const lx = nx * c + ny * s;
  const ly = -nx * s + ny * c;
  return worldFromLocal(b, lx >= 0 ? b.hw : -b.hw, ly >= 0 ? b.hh : -b.hh);
}

function solveVelocities(world, contacts) {
  for (const c of contacts) {
    if (c.sensor) continue;
    const { a, b } = c;
    const ra = { x: c.px - a.x, y: c.py - a.y };
    const rb = { x: c.px - b.x, y: c.py - b.y };
    const va = velAt(a, c.px, c.py);
    const vb = velAt(b, c.px, c.py);
    const rvx = vb.x - va.x;
    const rvy = vb.y - va.y;
    const velN = rvx * c.nx + rvy * c.ny;
    const raN = ra.x * c.ny - ra.y * c.nx;
    const rbN = rb.x * c.ny - rb.y * c.nx;
    const k =
      a.invMass +
      b.invMass +
      raN * raN * a.invInertia +
      rbN * rbN * b.invInertia;
    if (k <= 0) continue;
    if (velN < 0) {
      const e = velN < -70 ? Math.min(a.restitution, b.restitution) : 0;
      const jn = (-(1 + e) * velN) / k;
      applyImpulse(a, b, c.nx * jn, c.ny * jn, ra, rb);
      c.jn += jn;
      if (jn > world.impact) world.impact = jn;
    }
    solveTangent(c, ra, rb);
  }
}

function solveTangent(c, ra, rb) {
  const { a, b } = c;
  const belt = a.meta?.conveyor ? a : b.meta?.conveyor ? b : null;
  const va = velAt(a, c.px, c.py);
  const vb = velAt(b, c.px, c.py);
  const rvx = vb.x - va.x;
  const rvy = vb.y - va.y;
  if (belt && onBeltSurface(belt, c)) {
    let tx = Math.cos(belt.angle);
    let ty = Math.sin(belt.angle);
    const nd = tx * c.nx + ty * c.ny;
    tx -= c.nx * nd;
    ty -= c.ny * nd;
    const len = Math.hypot(tx, ty);
    if (len < 1e-6) return;
    tx /= len;
    ty /= len;
    const velT = rvx * tx + rvy * ty;
    const k = tangentMass(a, b, ra, rb, tx, ty);
    if (k <= 0) return;
    const target = belt === a ? belt.meta.conveyor : -belt.meta.conveyor;
    const jt = clamp((target - velT) / k, -120, 120);
    applyImpulse(a, b, tx * jt, ty * jt, ra, rb);
    return;
  }
  const tx = -c.ny;
  const ty = c.nx;
  const velT = rvx * tx + rvy * ty;
  if (Math.abs(velT) < 1e-4) return;
  const k = tangentMass(a, b, ra, rb, tx, ty);
  if (k <= 0) return;
  const mu = (a.friction + b.friction) * 0.5;
  const limit = mu * c.jn;
  const jt = clamp(-velT / k, -limit, limit);
  applyImpulse(a, b, tx * jt, ty * jt, ra, rb);
}

function tangentMass(a, b, ra, rb, tx, ty) {
  const raT = ra.x * ty - ra.y * tx;
  const rbT = rb.x * ty - rb.y * tx;
  return (
    a.invMass +
    b.invMass +
    raT * raT * a.invInertia +
    rbT * rbT * b.invInertia
  );
}

function onBeltSurface(belt, c) {
  const upX = Math.sin(belt.angle);
  const upY = -Math.cos(belt.angle);
  const other = belt === c.a ? c.b : c.a;
  const pushX = other === c.a ? -c.nx : c.nx;
  const pushY = other === c.a ? -c.ny : c.ny;
  return pushX * upX + pushY * upY > 0.55;
}

function applyImpulse(a, b, ix, iy, ra, rb) {
  a.vx -= ix * a.invMass;
  a.vy -= iy * a.invMass;
  a.av -= (ra.x * iy - ra.y * ix) * a.invInertia;
  b.vx += ix * b.invMass;
  b.vy += iy * b.invMass;
  b.av += (rb.x * iy - rb.y * ix) * b.invInertia;
}

function correctPositions(contacts) {
  const percent = 0.45;
  const slop = 0.8;
  for (const c of contacts) {
    if (c.sensor) continue;
    const corr = Math.min(Math.max(c.pen - slop, 0) * percent, 6);
    const inv = c.a.invMass + c.b.invMass;
    if (inv <= 0 || corr <= 0) continue;
    const cx = (c.nx * corr) / inv;
    const cy = (c.ny * corr) / inv;
    c.a.x -= cx * c.a.invMass;
    c.a.y -= cy * c.a.invMass;
    c.b.x += cx * c.b.invMass;
    c.b.y += cy * c.b.invMass;
    if (c.a.pinned) {
      c.a.x = c.a.pinX;
      c.a.y = c.a.pinY;
    }
    if (c.b.pinned) {
      c.b.x = c.b.pinX;
      c.b.y = c.b.pinY;
    }
  }
}

function settle(contacts) {
  for (const c of contacts) {
    if (c.sensor) continue;
    // Only quiet things that are already sitting on a flat surface.
    if (Math.abs(c.nx) > 0.06) continue;
    for (const b of [c.a, c.b]) {
      if (b.invMass === 0) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 10 && Math.abs(b.av) < 0.15) {
        b.vx *= 0.4;
        b.vy *= 0.4;
        b.av *= 0.4;
      }
    }
  }
}

function solveRopes(world, dt) {
  for (const rope of world.constraints) {
    if (rope.broken || rope.type !== "rope") continue;
    const pa = anchorPoint(rope, "a");
    const pb = anchorPoint(rope, "b");
    let dx = pb.x - pa.x;
    let dy = pb.y - pa.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-5) continue;
    const extra = dist - rope.rest;
    if (extra <= 0) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    const a = rope.a?.alive ? rope.a : null;
    const b = rope.b?.alive ? rope.b : null;
    const ra = a ? { x: pa.x - a.x, y: pa.y - a.y } : { x: 0, y: 0 };
    const rb = b ? { x: pb.x - b.x, y: pb.y - b.y } : { x: 0, y: 0 };
    const va = a ? velAt(a, pa.x, pa.y) : { x: 0, y: 0 };
    const vb = b ? velAt(b, pb.x, pb.y) : { x: 0, y: 0 };
    const rvx = vb.x - va.x;
    const rvy = vb.y - va.y;
    const velN = rvx * nx + rvy * ny;
    const slop = 1.2;
    const bias = extra > slop ? (0.35 / dt) * (extra - slop) : 0;
    const raN = ra.x * ny - ra.y * nx;
    const rbN = rb.x * ny - rb.y * nx;
    const invA = a ? a.invMass : 0;
    const invB = b ? b.invMass : 0;
    const iA = a ? a.invInertia : 0;
    const iB = b ? b.invInertia : 0;
    const k = invA + invB + raN * raN * iA + rbN * rbN * iB;
    if (k <= 0) continue;
    let jn = -(velN + bias) / k;
    // A rope only pulls inward. jn < 0 pulls the endpoints together.
    if (jn > 0) jn = 0;
    if (a) {
      a.vx -= jn * nx * invA;
      a.vy -= jn * ny * invA;
      a.av -= raN * jn * iA;
    }
    if (b) {
      b.vx += jn * nx * invB;
      b.vy += jn * ny * invB;
      b.av += rbN * jn * iB;
    }
  }
}

function markGrounded(world, contacts) {
  for (const b of world.bodies) b.grounded = false;
  for (const c of contacts) {
    if (c.sensor) continue;
    if (c.ny > 0.55) c.a.grounded = true;
    if (c.ny < -0.55) c.b.grounded = true;
  }
}

export function pointInBody(body, x, y) {
  if (!body.alive) return false;
  if (body.shape === "circle") {
    return (x - body.x) ** 2 + (y - body.y) ** 2 <= body.r * body.r;
  }
  const p = localFromWorld(body, x, y);
  return Math.abs(p.x) <= body.hw && Math.abs(p.y) <= body.hh;
}

export function bodyAtPoint(world, x, y) {
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.sensor || b.follow) continue;
    if (pointInBody(b, x, y)) return b;
  }
  return null;
}

export function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-6) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
