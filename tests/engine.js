import { addBody, addRope, createBody, createWorld, step } from "../src/physics.js";

let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name} ${detail}`);
  }
}

function floorWorld() {
  const world = createWorld();
  addBody(
    world,
    createBody({
      shape: "box",
      x: 480,
      y: 524,
      w: 960,
      h: 32,
      static: true,
      friction: 0.5,
      restitution: 0.05,
    }),
  );
  return world;
}

function sim(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) step(world, 1 / 60);
}

// Ball comes to rest on the floor.
{
  const world = floorWorld();
  const ball = addBody(
    world,
    createBody({
      shape: "circle",
      x: 200,
      y: 200,
      r: 16,
      mass: 1,
      friction: 0.3,
      restitution: 0.2,
    }),
  );
  sim(world, 2.5);
  check(
    "ball rests on floor",
    ball.alive && ball.y > 470 && ball.y < 508 && Math.abs(ball.vy) < 40,
    `y=${ball.y.toFixed(1)} vy=${ball.vy.toFixed(1)}`,
  );
}

// Rope keeps a ball from falling.
{
  const world = floorWorld();
  const ball = addBody(
    world,
    createBody({
      shape: "circle",
      x: 100,
      y: 80,
      r: 16,
      mass: 1,
      gravityScale: 1,
      restitution: 0.1,
    }),
  );
  addRope(world, { b: ball, blx: 0, bly: 0, wx: 100, wy: 30, rest: 70 });
  sim(world, 2);
  check(
    "rope suspends ball",
    ball.y > 70 && ball.y < 160,
    `y=${ball.y.toFixed(1)} vy=${ball.vy.toFixed(1)}`,
  );
}

// Ball slides down a slope.
{
  const world = createWorld();
  addBody(
    world,
    createBody({
      shape: "box",
      x: 400,
      y: 320,
      w: 420,
      h: 18,
      angle: 0.4,
      static: true,
      friction: 0.12,
      restitution: 0.02,
    }),
  );
  const ball = addBody(
    world,
    createBody({
      shape: "circle",
      x: 280,
      y: 230,
      r: 16,
      mass: 1,
      friction: 0.12,
      restitution: 0.05,
    }),
  );
  const x0 = ball.x;
  sim(world, 1.4);
  check(
    "ball slides downhill",
    ball.x > x0 + 50,
    `x ${x0.toFixed(0)} -> ${ball.x.toFixed(0)} y=${ball.y.toFixed(0)}`,
  );
}

// Tipped domino falls over.
{
  const world = floorWorld();
  const domino = addBody(
    world,
    createBody({
      shape: "box",
      x: 300,
      y: 508 - 29,
      w: 14,
      h: 58,
      angle: 0.7,
      mass: 0.45,
      friction: 0.8,
      restitution: 0.02,
      angularDamp: 0.4,
    }),
  );
  sim(world, 1.2);
  check(
    "domino topples",
    Math.abs(domino.angle) > 1.15,
    `angle=${domino.angle.toFixed(2)}`,
  );
}

// Fan accelerates a balloon to the right.
{
  const world = createWorld();
  const fan = addBody(
    world,
    createBody({
      shape: "box",
      x: 120,
      y: 200,
      w: 56,
      h: 40,
      static: true,
      meta: { fan: { len: 280, spread: 90, power: 260 } },
    }),
  );
  const balloon = addBody(
    world,
    createBody({
      shape: "circle",
      x: 220,
      y: 200,
      r: 22,
      mass: 0.28,
      gravityScale: -0.05,
      drag: 0.4,
      meta: {},
    }),
  );
  world.beforeSubstep = (dt) => {
    const c = Math.cos(fan.angle);
    const s = Math.sin(fan.angle);
    const dx = balloon.x - fan.x;
    const dy = balloon.y - fan.y;
    const lx = dx * c + dy * s;
    const ly = -dx * s + dy * c;
    if (lx > fan.hw && lx < fan.hw + 280 && Math.abs(ly) < 45) {
      const accel = 260 / balloon.mass;
      balloon.vx += c * accel * dt;
      balloon.vy += s * accel * dt;
    }
  };
  const x0 = balloon.x;
  sim(world, 1);
  check(
    "fan blows balloon",
    balloon.x > x0 + 80,
    `x ${x0.toFixed(0)} -> ${balloon.x.toFixed(0)}`,
  );
}

if (failed) {
  console.error(`\n${failed} engine test(s) failed`);
  process.exit(1);
}
console.log("\nengine ok");
