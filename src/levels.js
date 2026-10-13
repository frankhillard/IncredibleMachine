import { PARTS } from "./parts.js";

function box(x, y, w, h, angle = 0, extra = {}) {
  return {
    shape: "box",
    x,
    y,
    w,
    h,
    angle,
    static: true,
    friction: extra.friction ?? 0.4,
    restitution: extra.restitution ?? 0.04,
    style: "wood",
    ...extra,
  };
}

function frame() {
  return [
    box(8, 270, 16, 540, 0, { style: "frame", friction: 0.45 }),
    box(952, 270, 16, 540, 0, { style: "frame", friction: 0.45 }),
    box(480, 8, 960, 16, 0, { style: "frame", friction: 0.3 }),
    box(480, 1100, 2200, 120, 0, { style: "frame", friction: 0.7 }),
  ];
}

function basket(x, surfaceTop, width = 170) {
  // Open on the left so a rolling ball can enter. x is the pocket center.
  const backH = 86;
  return [
    box(x + width / 2, surfaceTop - backH / 2, 14, backH, 0, {
      style: "basket",
      friction: 0.45,
      restitution: 0.01,
    }),
    {
      shape: "box",
      x,
      y: surfaceTop - 22,
      w: width,
      h: 52,
      sensor: true,
      role: "goal",
      style: "sensor",
    },
  ];
}

function endOf(fixture, side = 1) {
  const angle = fixture.angle || 0;
  const hw = fixture.w / 2;
  return {
    x: fixture.x + side * hw * Math.cos(angle),
    y: fixture.y + side * hw * Math.sin(angle),
  };
}

function extend(from, width, angle) {
  const hw = width / 2;
  return {
    x: from.x + hw * Math.cos(angle),
    y: from.y + hw * Math.sin(angle),
    angle,
    w: width,
  };
}

function onSurface(fixture, localX, radius) {
  const angle = fixture.angle || 0;
  const hh = fixture.h / 2;
  const ly = -(hh + radius + 0.6);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: fixture.x + localX * c - ly * s,
    y: fixture.y + localX * s + ly * c,
  };
}

function localToWorld(origin, angle, lx, ly) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: origin.x + lx * c - ly * s,
    y: origin.y + lx * s + ly * c,
  };
}

function contain(extra = {}) {
  return {
    type: "contain",
    match: "ball",
    zone: "goal",
    mode: "any",
    hold: 0.3,
    maxSpeed: 360,
    ...extra,
  };
}

const level1 = (() => {
  const angle = 0.38;
  const slope = box(190, 210, 260, 16, angle, { style: "ramp", friction: 0.12, restitution: 0.02 });
  const boardW = 280;
  const board = extend(endOf(slope, 1), boardW, angle);
  const far = endOf({ ...board, h: 16 }, 1);
  const platTop = far.y + 4;
  const plat = box(far.x + 110, platTop + 10, 250, 20, 0, {
    style: "ramp",
    friction: 0.55,
    restitution: 0.02,
  });
  const spot = onSurface(slope, -70, 16);
  return {
    id: 1,
    name: "A Rolling Start",
    hint: "Lay a board so the ball keeps rolling downhill into the basket. Scroll to tilt it.",
    fixtures: [
      ...frame(),
      slope,
      plat,
      ...basket(plat.x + 40, plat.y - plat.h / 2),
      { part: "ball", x: spot.x, y: spot.y, role: "hero" },
    ],
    decors: [{ type: "pit", x: 430, y: 430, w: 280, h: 200 }],
    inventory: [{ type: "board", count: 1, w: boardW }],
    goal: contain(),
    solution: [{ type: "board", x: board.x, y: board.y, angle: board.angle, w: boardW }],
    time: 8,
  };
})();

const level2 = (() => {
  const angle = 0.26;
  const left = box(150, 188, 230, 16, angle, { style: "ramp", friction: 0.12, restitution: 0.02 });
  const w = 200;
  const b1 = extend(endOf(left, 1), w, angle);
  const b2 = extend(endOf({ ...b1, h: 16 }, 1), w, angle);
  const far = endOf({ ...b2, h: 16 }, 1);
  const platTop = far.y + 2;
  const plat = box(Math.min(820, far.x + 90), platTop + 12, 200, 24, 0, {
    style: "ramp",
    friction: 0.6,
    restitution: 0.02,
  });
  const spot = onSurface(left, -50, 16);
  return {
    id: 2,
    name: "Across the Gap",
    hint: "Keep the downhill run going. Two boards can span the gap.",
    fixtures: [
      ...frame(),
      left,
      plat,
      ...basket(plat.x + 20, plat.y - plat.h / 2),
      { part: "ball", x: spot.x, y: spot.y },
    ],
    decors: [{ type: "pit", x: 480, y: 460, w: 520, h: 240 }],
    inventory: [{ type: "board", count: 2, w }],
    goal: contain(),
    solution: [
      { type: "board", x: b1.x, y: b1.y, angle: b1.angle, w },
      { type: "board", x: b2.x, y: b2.y, angle: b2.angle, w },
    ],
    time: 9,
  };
})();

const level3 = (() => {
  const padTop = 348;
  return {
    id: 3,
    name: "Boing",
    hint: "Drop a spring in the shaft and tilt it toward the opening. Straight up just hits the ceiling.",
    fixtures: [
      ...frame(),
      box(150, 290, 18, 460, 0, { style: "brick" }),
      box(312, 440, 18, 160, 0, { style: "brick" }),
      box(220, 64, 180, 16, 0, { style: "brick" }),
      box(800, padTop + 10, 300, 20, 0, { style: "floor", friction: 0.28, restitution: 0.02 }),
      ...basket(800, padTop, 250),
      { part: "ball", x: 230, y: 170 },
    ],
    decors: [],
    inventory: [{ type: "spring", count: 1 }],
    goal: contain({ maxSpeed: 700 }),
    solution: [{ type: "spring", x: 230, y: 468, angle: 0.32 }],
    time: 7,
  };
})();

const level4 = (() => {
  return {
    id: 4,
    name: "Crosswind",
    hint: "The balloon only rises. Park a fan so the breeze carries it into the hoop.",
    fixtures: [
      ...frame(),
      box(860, 150, 16, 240, 0, { style: "brick" }),
      box(760, 250, 220, 16, 0, { style: "shelf", friction: 0.4 }),
      {
        shape: "box",
        x: 730,
        y: 78,
        w: 250,
        h: 110,
        sensor: true,
        role: "goal",
        style: "sensor",
      },
      { part: "balloon", x: 220, y: 380, role: "balloon" },
    ],
    decors: [{ type: "hoop", x: 730, y: 78, w: 250, h: 110 }],
    inventory: [
      {
        type: "fan",
        count: 1,
        meta: { fan: { len: 560, spread: 150, power: 280 } },
      },
    ],
    goal: contain({ match: "balloon", maxSpeed: 1200, hold: 0.3 }),
    solution: [
      {
        type: "fan",
        x: 90,
        y: 70,
        angle: 0,
        meta: { fan: { len: 560, spread: 150, power: 280 } },
      },
    ],
    time: 8,
  };
})();

const level5 = (() => {
  const tableTop = 383;
  const table = box(420, tableTop + 9, 760, 18, 0, { style: "ramp", friction: 0.5, restitution: 0 });
  const spacing = 34;
  const origin = 160;
  const count = 8;
  const h = 78;
  const player = [];
  for (let i = 1; i < count - 1; i++) {
    player.push({ type: "domino", x: origin + i * spacing, y: tableTop - h / 2 - 1 });
  }
  return {
    id: 5,
    name: "Tip the Line",
    hint: "The near domino is already falling. Fill the row so it can tip the marked one at the end.",
    fixtures: [
      ...frame(),
      table,
      {
        part: "domino",
        x: origin,
        y: tableTop - h / 2 - 8,
        angle: 0.95,
        nudgeAv: 2,
        h,
        w: 12,
      },
      {
        part: "domino",
        ref: "target",
        role: "target",
        x: origin + (count - 1) * spacing,
        y: tableTop - h / 2 - 1,
        h,
        w: 12,
        meta: { marked: true },
      },
    ],
    decors: [],
    inventory: [{ type: "domino", count: count - 2 }],
    goal: { type: "tipped", match: "target", minAngle: 1, hold: 0.15 },
    solution: player,
    time: 7,
  };
})();

const level6 = (() => {
  const angle = 0.36;
  const slide = extend({ x: 150, y: 240 }, 720, angle);
  const far = endOf({ ...slide, h: 16 }, 1);
  const platTop = far.y + 6;
  return {
    id: 6,
    name: "Burn Notice",
    hint: "A candle under the rope is enough. Flames chew through it.",
    fixtures: [
      ...frame(),
      box(slide.x, slide.y, slide.w, 16, slide.angle, { style: "ramp", friction: 0.12, restitution: 0.02 }),
      box(Math.min(900, far.x + 40), platTop + 14, 160, 28, 0, { style: "floor", friction: 0.7, restitution: 0.01 }),
      ...basket(Math.min(900, far.x + 20), platTop),
      { part: "ball", ref: "cargo", x: 210, y: 140 },
      { rope: true, a: { x: 210, y: 28 }, b: { ref: "cargo" } },
    ],
    decors: [],
    inventory: [{ type: "candle", count: 1 }],
    goal: contain({ maxSpeed: 500 }),
    solution: [{ type: "candle", x: 214, y: 96 }],
    time: 10,
  };
})();

const level7 = (() => {
  const top = 392;
  const left = box(168, top + 28, 300, 56, 0, { style: "platform", friction: 0.7, restitution: 0.01 });
  const right = box(792, top + 28, 300, 56, 0, { style: "platform", friction: 0.7, restitution: 0.01 });
  const boardW = 200;
  const y = top + 8;
  return {
    id: 7,
    name: "Scamp's Errand",
    hint: "Scamps walk in a straight line. They do not jump. Lay a bridge.",
    fixtures: [
      ...frame(),
      left,
      right,
      {
        shape: "circle",
        x: 110,
        y: top - 15,
        r: 16,
        mass: 1,
        friction: 0.15,
        restitution: 0.02,
        fixedRotation: true,
        role: "scamp",
        style: "scamp",
        meta: { scamp: "cheese", speed: 92 },
      },
      {
        shape: "circle",
        x: 860,
        y: top - 8,
        r: 18,
        sensor: true,
        role: "cheese",
        style: "cheese",
        static: true,
      },
    ],
    decors: [{ type: "pit", x: 480, y: 560, w: 360, h: 280 }],
    inventory: [{ type: "board", count: 2, w: boardW }],
    goal: { type: "overlap", matchA: "scamp", matchB: "cheese" },
    solution: [
      { type: "board", x: 400, y, angle: 0, w: boardW },
      { type: "board", x: 580, y, angle: 0, w: boardW },
    ],
    time: 10,
  };
})();

const level8 = (() => {
  const top = 360;
  const belt = {
    part: "conveyor",
    x: 200,
    y: top + 11,
    w: 280,
    meta: { conveyor: 380 },
  };
  const angle = 0.12;
  const boardW = 240;
  const board = { x: 400, y: 390, angle, w: boardW };
  const far = endOf({ ...board, h: 16 }, 1);
  const platTop = far.y + 4;
  return {
    id: 8,
    name: "Moving Day",
    hint: "The belt does the pushing. Lay a board so the ball can coast into the basket.",
    fixtures: [
      ...frame(),
      belt,
      box(far.x + 90, platTop + 12, 220, 24, 0, { style: "platform", friction: 0.2, restitution: 0.02 }),
      ...basket(far.x + 90, platTop, 180),
      { part: "ball", x: 110, y: top - 16 },
    ],
    decors: [{ type: "pit", x: 470, y: 560, w: 260, h: 220 }],
    inventory: [{ type: "board", count: 1, w: boardW }],
    goal: contain({ maxSpeed: 600 }),
    solution: [{ type: "board", x: board.x, y: board.y, angle: board.angle, w: boardW }],
    time: 8,
  };
})();

const level9 = (() => {
  return {
    id: 9,
    name: "The Heavy Idea",
    hint: "One rope is holding the seesaw. The other is a decoy. Burn the one that matters.",
    fixtures: [
      ...frame(),
      {
        part: "seesaw",
        ref: "arm",
        x: 560,
        y: 250,
        w: 280,
        h: 16,
        mass: 3.2,
        angularDamp: 1.8,
        friction: 0.8,
        restitution: 0.02,
      },
      {
        shape: "box",
        w: 14,
        h: 24,
        x: 0,
        y: 0,
        followRef: "arm",
        lx: -130,
        ly: -16,
        style: "tray",
        friction: 0.8,
      },
      box(30, 320, 16, 420, 0, { style: "brick", friction: 0.4 }),
      box(250, 500, 440, 18, 0, { style: "floor", friction: 0.45, restitution: 0.01 }),
      {
        shape: "box",
        x: 180,
        y: 468,
        w: 230,
        h: 56,
        sensor: true,
        role: "goal",
        style: "sensor",
      },
      { part: "weight", x: 480, y: 226, r: 16, mass: 8, friction: 0.65, restitution: 0.01 },
      { part: "ball", x: 640, y: 228, r: 14, mass: 0.8, friction: 0.12, restitution: 0.08 },
      { rope: true, role: "hold", a: { x: 480, y: 30 }, b: { ref: "arm", lx: -130, ly: -6 } },
      { rope: true, role: "decoy", a: { x: 180, y: 36 }, b: { x: 180, y: 170 } },
    ],
    decors: [{ type: "hoop", x: 180, y: 468, w: 230, h: 56 }],
    inventory: [{ type: "candle", count: 1 }],
    goal: contain({ maxSpeed: 80, hold: 0.25 }),
    solution: [{ type: "candle", x: 455, y: 140 }],
    traps: [[{ type: "candle", x: 200, y: 110 }]],
    time: 9,
  };
})();

const level10 = (() => {
  const angle = 0.34;
  const boardW = 240;
  const board = extend({ x: 190, y: 250 }, boardW, angle);
  const far = endOf({ ...board, h: 16 }, 1);
  const ramp = extend(far, 460, angle);
  const end = endOf({ ...ramp, h: 16 }, 1);
  const platTop = end.y + 6;
  return {
    id: 10,
    name: "Catch of the Day",
    hint: "Cut the rope and catch the ball. A board alone, or a candle alone, will not do it.",
    fixtures: [
      ...frame(),
      box(ramp.x, ramp.y, ramp.w, 16, ramp.angle, { style: "ramp", friction: 0.12, restitution: 0.02 }),
      box(Math.min(900, end.x + 30), platTop + 14, 150, 28, 0, {
        style: "floor",
        friction: 0.75,
        restitution: 0.01,
      }),
      ...basket(Math.min(900, end.x + 10), platTop),
      { part: "ball", ref: "cargo", x: 230, y: 140 },
      { rope: true, a: { x: 230, y: 28 }, b: { ref: "cargo" } },
    ],
    decors: [{ type: "pit", x: 300, y: 640, w: 240, h: 280 }],
    inventory: [
      { type: "candle", count: 1 },
      { type: "board", count: 1, w: boardW },
    ],
    goal: contain({ maxSpeed: 520 }),
    solution: [
      { type: "candle", x: 236, y: 92 },
      { type: "board", x: board.x, y: board.y, angle: board.angle, w: boardW },
    ],
    traps: [
      [{ type: "candle", x: 236, y: 92 }],
      [{ type: "board", x: board.x, y: board.y, angle: board.angle, w: boardW }],
    ],
    time: 11,
  };
})();

const level11 = {
  ...level1,
  id: 11,
  name: "Open Bench",
  hint: "Everything is unlocked. The ghost hint is only one idea — any ball in the basket counts.",
  sandbox: true,
  inventory: [
    ...level1.inventory,
    { type: "board", count: 3, w: 210 },
    { type: "block", count: 3 },
    { type: "plank", count: 2 },
    { type: "ball", count: 2 },
    { type: "weight", count: 2 },
    { type: "balloon", count: 2 },
    { type: "fan", count: 2 },
    { type: "domino", count: 8 },
    { type: "candle", count: 2 },
    { type: "spring", count: 1 },
    { type: "seesaw", count: 1 },
    { type: "conveyor", count: 1 },
    { type: "rope", count: 4 },
  ],
  fixtures: [
    ...level1.fixtures,
    {
      shape: "circle",
      x: 70,
      y: 460,
      r: 18,
      sensor: true,
      role: "cheese",
      style: "cheese",
      static: true,
    },
  ],
};

export const LEVELS = [level1, level2, level3, level4, level5, level6, level7, level8, level9, level10, level11];

export function levelById(id) {
  return LEVELS.find((level) => level.id === Number(id)) || LEVELS[0];
}

export { PARTS };
