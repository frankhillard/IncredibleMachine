import { LEVELS as BUILTIN_LEVELS } from "./levels.js";
import { levels as extraLevels } from "../extra_levels/index.js";
import { PARTS, PART_ORDER } from "./parts.js";
import { bodyAtPoint, createBody, localFromWorld } from "./physics.js";
import { blankBuilderLevel, captureLevel, placeGoal, placeStart, sessionFromSaved } from "./builder.js";
import {
  anchorFromPoint,
  createSession,
  moveBody,
  placeRope,
  play,
  removeBody,
  removeRope,
  ropeAtPoint,
  spawnPart,
  stepSession,
  stop,
} from "./session.js";
import { drawWorld, paintIcon } from "./render.js";
import { isMuted, setMuted, sfx } from "./audio.js";

const canvas = document.querySelector("#view");
const ctx = canvas.getContext("2d");
const tray = document.querySelector("#tray");
const dots = document.querySelector("#dots");
const modal = document.querySelector("#modal");

const state = {
  levels: [...BUILTIN_LEVELS, ...extraLevels],
  index: 0,
  session: null,
  selected: null,
  selectedRope: null,
  tool: null,
  placing: null,
  ropeAnchor: null,
  mouse: null,
  pointerId: null,
  drag: null,
  showHint: false,
  slow: false,
  particles: [],
  shake: 0,
  celebrated: false,
  cleared: loadCleared(),
  building: false,
  layer: "fixed",
};

const params = new URLSearchParams(location.search);
const startId = Number(params.get("level"));
if (startId) {
  const found = state.levels.findIndex((level) => level.id === startId);
  if (found >= 0) state.index = found;
}

bind();
loadLevel(state.index);
if (params.get("autosolve") === "1") {
  applySolution();
  startPlay();
}
requestAnimationFrame(frame);
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const session = state.session;
  const scale = state.slow ? 0.45 : 1;
  if (session.playing) {
    const events = stepSession(session, dt * scale);
    for (const event of events) handleEvent(event);
  }
  for (const bit of state.particles) {
    bit.life -= dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.vy += 700 * dt;
    bit.rot += dt * 4;
  }
  state.particles = state.particles.filter((bit) => bit.life > 0);
  state.shake *= Math.exp(-dt * 6);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr * (rect.width / 960), 0, 0, dpr * (rect.height / 540), 0, 0);
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawWorld(ctx, session, {
    time: now / 1000,
    particles: state.particles,
    selected: state.selected,
    selectedRope: state.selectedRope,
    placing: state.placing,
    ropeAnchor: state.ropeAnchor,
    mouse: state.mouse,
    showHint: state.showHint,
  });
  const toast = document.querySelector("#toast");
  toast.textContent = session.message || "";
  toast.classList.toggle("show", Boolean(session.message));
  document.querySelector("#play").disabled = session.playing;
  document.querySelector("#stop").disabled = !session.playing;
  requestAnimationFrame(frame);
}

function handleEvent(event) {
  if (event.type === "impact") {
    sfx("impact", event.impulse / 80);
    state.shake = Math.min(7, state.shake + event.impulse / 200);
  }
  if (event.type === "pop") {
    sfx("pop");
    burst(event.x, event.y, ["#ff5d7a", "#ffe4ec", "#c81e4a"], 16);
  }
  if (event.type === "burn") {
    sfx("burn");
    burst(event.x, event.y, ["#ffb347", "#ffe7a3", "#6a4324"], 12);
  }
  if (event.type === "spring") sfx("spring");
  if (event.type === "win") celebrate();
}

function celebrate() {
  if (state.celebrated) return;
  state.celebrated = true;
  sfx("win");
  state.shake = 6;
  for (let i = 0; i < 40; i++) {
    burst(200 + Math.random() * 560, 80 + Math.random() * 80, ["#ffe7a3", "#e24b3c", "#f2c14e", "#fff"], 1);
  }
  state.cleared.add(state.session.level.id);
  saveCleared();
  renderDots();
  const level = state.session.level;
  const last = state.index >= state.levels.length - 1;
  document.querySelector("#modal-title").textContent = level.sandbox ? "The bench is yours" : "It works";
  document.querySelector("#modal-copy").textContent = last
    ? "Every table on the bench has run. Build another one, or replay this one."
    : level.name;
  document.querySelector("#modal-next").textContent = last ? "Stay here" : "Next machine";
  modal.classList.remove("hidden");
}

function loadLevel(index) {
  state.building = false;
  state.index = (index + state.levels.length) % state.levels.length;
  state.session = createSession(state.levels[state.index]);
  state.selected = null;
  state.selectedRope = null;
  state.tool = null;
  state.placing = null;
  state.ropeAnchor = null;
  state.drag = null;
  state.showHint = false;
  state.celebrated = false;
  modal.classList.add("hidden");
  const level = state.session.level;
  const puzzles = BUILTIN_LEVELS.filter((item) => !item.sandbox).length;
  document.querySelector("#level-kicker").textContent = level.sandbox
    ? "Open bench"
    : level.id > 11
      ? `Extra level ${level.id}`
      : `Machine ${level.id} of ${puzzles}`;
  document.querySelector("#level-name").textContent = level.name;
  document.querySelector("#hint").textContent = level.hint;
  document.querySelector("#build").classList.remove("on");
  document.querySelector("#save-level").disabled = true;
  document.querySelector("#load-level").disabled = true;
  document.querySelector("#builder-tools").classList.add("is-hidden");
  document.querySelector("#load-panel").classList.add("is-hidden");
  closeRoleMenu();
  document.querySelector("#shelf-help").textContent = "Drag onto the felt. Scroll or Q / E to rotate. Delete removes.";
  renderTray();
  renderDots();
}

function renderTray() {
  tray.innerHTML = "";
  const level = state.session.level;
  const types = state.building
    ? ["start", "goal", ...PART_ORDER]
    : PART_ORDER.filter((type) => level.inventory.some((item) => item.type === type));
  for (const type of types) addTrayButton(type);
}

function addTrayButton(type) {
  const special = type === "start" || type === "goal";
  const def = special
    ? {
        name: type === "start" ? "Start" : "End",
        blurb: type === "start" ? "Where the ball begins." : "The zone the ball must stay in.",
      }
    : PARTS[type];
  const button = document.createElement("button");
  button.className = "part";
  button.type = "button";
  if (state.tool === type) button.classList.add("selected");
  const icon = document.createElement("canvas");
  icon.width = 72;
  icon.height = 52;
  paintIcon(icon, type);
  const count = document.createElement("span");
  count.className = "count";
  count.textContent = String(stock(type));
  const name = document.createElement("span");
  name.className = "part-name";
  name.textContent = def.name;
  button.append(icon, name, count);
  button.title = def.blurb;
  button.disabled = stock(type) <= 0 && state.tool !== type;
  button.addEventListener("pointerdown", (event) => beginTray(event, type));
  tray.append(button);
}

function renderDots() {
  dots.innerHTML = "";
  for (const level of state.levels) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dot";
    if (!state.building && level.id === state.session.level.id) button.classList.add("current");
    if (state.cleared.has(level.id)) button.classList.add("cleared");
    button.textContent = String(level.id);
    button.title = level.name;
    button.addEventListener("click", () => loadLevel(state.levels.indexOf(level)));
    dots.append(button);
  }
}

function stock(type) {
  if (type === "start") return state.session.world.bodies.some((body) => body.builderKind === "start") ? 0 : 1;
  if (type === "goal") return state.session.world.bodies.some((body) => body.builderKind === "goal-pin") ? 0 : 1;
  return remaining(type);
}

function remaining(type) {
  return state.session.inventory
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + item.remaining, 0);
}

function beginTray(event, type) {
  if (state.session.playing || stock(type) <= 0) return;
  event.preventDefault();
  state.tool = type;
  state.selected = null;
  state.selectedRope = null;
  state.ropeAnchor = null;
  const point = worldOf(event);
  state.drag = { fromTray: true, type, moved: false, x: point.x, y: point.y };
  state.pointerId = event.pointerId;
  event.currentTarget.setPointerCapture(event.pointerId);
  renderTray();
}

function onPointerDown(event) {
  if (event.target.closest && event.target.closest("#tray")) return;
  if (event.button === 2) return;
  const point = worldOf(event);
  state.mouse = point;
  if (state.session.playing) return;
  if (state.ropeAnchor || state.tool === "rope") {
    placeRopeClick(point);
    return;
  }
  const body = bodyAtPoint(state.session.world, point.x, point.y);
  if (body && !body.locked && !body.follow) {
    state.selected = body;
    state.selectedRope = null;
    state.tool = null;
    const local = localFromWorld(body, point.x, point.y);
    state.drag = { body, lx: local.x, ly: local.y, moved: false };
    state.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    renderTray();
    return;
  }
  const rope = ropeAtPoint(state.session.world, point.x, point.y);
  if (rope) {
    state.selectedRope = rope;
    state.selected = null;
    state.drag = null;
    return;
  }
  state.selected = null;
  state.selectedRope = null;
  if (state.tool && state.tool !== "rope") {
    state.drag = { fromTray: true, type: state.tool, moved: true, x: point.x, y: point.y };
    state.placing = preview(state.tool, point.x, point.y, 0);
    state.pointerId = event.pointerId;
  }
}

function onPointerMove(event) {
  const point = worldOf(event);
  state.mouse = point;
  if (!state.drag) return;
  state.drag.moved = true;
  if (state.drag.body) {
    const angle = state.drag.body.angle;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = point.x - (state.drag.lx * c - state.drag.ly * s);
    const y = point.y - (state.drag.lx * s + state.drag.ly * c);
    moveBody(state.drag.body, clamp(x, 30, 930), clamp(y, 30, 510), angle);
  } else if (state.drag.fromTray && state.drag.type !== "rope") {
    state.placing = preview(state.drag.type, point.x, point.y, state.placing?.angle || 0);
  }
}

function onPointerUp(event) {
  const point = worldOf(event);
  const dragged = state.drag?.body;
  const marker = dragged?.builderKind === "start" ? "start" : dragged?.builderKind === "goal-pin" ? "goal" : null;
  if (state.drag?.fromTray && state.drag.type !== "rope" && state.drag.moved && inside(point)) {
    const angle = state.placing?.angle || 0;
    const x = clamp(point.x, 36, 924);
    const y = clamp(point.y, 36, 508);
    if (state.drag.type === "start") {
      placeStart(state.session, x, y);
      sfx("place");
      openRoleMenu(event, "start");
    } else if (state.drag.type === "goal") {
      placeGoal(state.session, x, y, angle);
      sfx("place");
      openRoleMenu(event, "goal");
    } else {
      const body = spawnPart(state.session, state.drag.type, x, y, angle);
      if (body) {
        if (state.building) body.builderLayer = state.layer;
        state.selected = body;
        sfx("place");
        burst(body.x, body.y, ["#ffe7a3", "#fff"], 6);
      }
    }
    state.tool = stock(state.drag.type) > 0 ? state.drag.type : null;
  } else if (marker && state.building && !state.session.playing) {
    openRoleMenu(event, marker);
  }
  state.drag = null;
  state.placing = null;
  state.pointerId = null;
  renderTray();
}

function placeRopeClick(point) {
  const anchor = anchorFromPoint(state.session.world, point.x, point.y);
  if (!state.ropeAnchor) {
    state.ropeAnchor = anchor;
    state.tool = "rope";
    return;
  }
  const rope = placeRope(state.session, state.ropeAnchor, anchor);
  state.ropeAnchor = null;
  if (rope) {
    state.selectedRope = rope;
    if (state.building) rope.builderLayer = state.layer;
    sfx("place");
  }
  state.tool = stock("rope") > 0 ? "rope" : null;
  renderTray();
}

function preview(type, x, y, angle) {
  if (type === "start") {
    const body = createBody({ ...PARTS.ball, x, y, angle, partType: "ball", style: "ball" });
    body.builderKind = "start";
    return body;
  }
  if (type === "goal") {
    const body = createBody({ shape: "circle", r: 14, x, y, angle, style: "goalpin" });
    body.builderKind = "goal-pin";
    return body;
  }
  const def = PARTS[type];
  const slot = state.session.inventory.find((item) => item.type === type && item.remaining > 0);
  return createBody({
    ...def,
    meta: { ...(def.meta || {}), ...(slot?.meta || {}) },
    x,
    y,
    angle,
    partType: type,
    w: slot?.w || def.w,
    h: slot?.h || def.h,
    r: slot?.r || def.r,
  });
}

function rotateTarget(dir) {
  const step = (dir * Math.PI) / 12;
  if (state.placing) {
    state.placing.angle += step;
    sfx("rotate");
    return;
  }
  if (state.selected && !state.session.playing) {
    moveBody(state.selected, state.selected.x, state.selected.y, state.selected.angle + step);
    sfx("rotate");
  }
}

function removeSelected() {
  if (state.session.playing) return;
  if (state.selected) {
    removeBody(state.session, state.selected);
    state.selected = null;
    renderTray();
  } else if (state.selectedRope && state.selectedRope.player) {
    removeRope(state.session, state.selectedRope);
    state.selectedRope = null;
    renderTray();
  }
}

function startPlay() {
  if (state.session.playing || state.session.won) return;
  state.placing = null;
  state.drag = null;
  state.ropeAnchor = null;
  play(state.session);
  sfx("play");
}

function stopPlay() {
  if (!state.session.playing && !state.session.won) return;
  stop(state.session);
  state.celebrated = false;
  modal.classList.add("hidden");
  sfx("stop");
}

function applySolution() {
  const session = state.session;
  for (const part of session.level.solution || []) {
    spawnPart(session, part.type, part.x, part.y, part.angle || 0, part);
  }
  renderTray();
}

function burst(x, y, colors, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 160;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.6 + Math.random() * 0.5,
      size: 3 + Math.random() * 4,
      color: colors[i % colors.length],
      rot: Math.random(),
    });
  }
}

function worldOf(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 960,
    y: ((event.clientY - rect.top) / rect.height) * 540,
  };
}

function inside(point) {
  return point.x >= 0 && point.x <= 960 && point.y >= 0 && point.y <= 540;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadCleared() {
  try {
    return new Set(JSON.parse(localStorage.getItem("contraption-cleared") || "[]"));
  } catch {
    return new Set();
  }
}

function saveCleared() {
  localStorage.setItem("contraption-cleared", JSON.stringify([...state.cleared]));
}

function bind() {
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointerdown", (event) => {
    if (event.target.closest && event.target.closest("#role-menu")) return;
    closeRoleMenu();
  });
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (!state.session.playing) removeSelected();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      rotateTarget(event.deltaY > 0 ? 1 : -1);
    },
    { passive: false },
  );
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRoleMenu();
    if (event.target.matches("input, textarea, select")) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (state.session.playing) stopPlay();
      else startPlay();
    }
    if (event.key === "q" || event.key === "Q") rotateTarget(-1);
    if (event.key === "e" || event.key === "E") rotateTarget(1);
    if (event.key === "Delete" || event.key === "Backspace") removeSelected();
    if (event.key === "Escape") {
      state.ropeAnchor = null;
      state.tool = null;
      state.placing = null;
      renderTray();
    }
    if (event.key === "h" || event.key === "H") {
      state.showHint = !state.showHint;
      document.querySelector("#hint-btn").classList.toggle("on", state.showHint);
    }
  });
  document.querySelector("#play").addEventListener("click", startPlay);
  document.querySelector("#stop").addEventListener("click", stopPlay);
  document.querySelector("#reset").addEventListener("click", () => {
    if (state.building) enterBuilder();
    else loadLevel(state.index);
  });
  document.querySelector("#hint-btn").addEventListener("click", () => {
    state.showHint = !state.showHint;
    document.querySelector("#hint-btn").classList.toggle("on", state.showHint);
  });
  document.querySelector("#slow").addEventListener("click", (event) => {
    state.slow = !state.slow;
    event.currentTarget.classList.toggle("on", state.slow);
  });
  document.querySelector("#mute").addEventListener("click", (event) => {
    setMuted(!isMuted());
    event.currentTarget.classList.toggle("on", isMuted());
    event.currentTarget.textContent = isMuted() ? "Muted" : "Sound";
  });
  document.querySelector("#prev").addEventListener("click", () => loadLevel(state.index - 1));
  document.querySelector("#next").addEventListener("click", () => loadLevel(state.index + 1));
  document.querySelector("#build").addEventListener("click", () => {
    if (state.building) loadLevel(state.index);
    else enterBuilder();
  });
  document.querySelector("#save-level").addEventListener("click", saveBuiltLevel);
  document.querySelector("#load-level").addEventListener("click", openLoadPanel);
  document.querySelector("#load-cancel").addEventListener("click", closeLoadPanel);
  document.querySelector("#role-choice").addEventListener("change", (event) => {
    const role = event.currentTarget.value;
    if (state.roleTarget === "start") {
      const start = state.session.world.bodies.find((body) => body.builderKind === "start");
      if (start) placeStart(state.session, start.x, start.y, role);
    } else if (state.roleTarget === "goal") {
      const pin = state.session.world.bodies.find((body) => body.builderKind === "goal-pin");
      if (pin) placeGoal(state.session, pin.x, pin.y, pin.angle, role);
    }
  });
  document.querySelector("#layer-player").addEventListener("click", () => setLayer("solution"));
  document.querySelector("#replay").addEventListener("click", () => {
    modal.classList.add("hidden");
    stopPlay();
  });
  document.querySelector("#modal-next").addEventListener("click", () => {
    modal.classList.add("hidden");
    if (state.index < state.levels.length - 1) loadLevel(state.index + 1);
  });
}

function enterBuilder() {
  state.building = true;
  state.layer = "fixed";
  state.session = createSession(blankBuilderLevel());
  state.selected = null;
  state.selectedRope = null;
  state.tool = null;
  state.placing = null;
  state.ropeAnchor = null;
  state.drag = null;
  state.showHint = false;
  state.celebrated = false;
  modal.classList.add("hidden");
  closeLoadPanel();
  closeRoleMenu();
  showBuilderChrome();
}

function showBuilderChrome() {
  closeRoleMenu();
  const level = state.session.level;
  document.querySelector("#level-kicker").textContent = "Workshop";
  document.querySelector("#level-name").textContent = level.name;
  document.querySelector("#hint").textContent = level.hint;
  document.querySelector("#build").classList.add("on");
  document.querySelector("#save-level").disabled = false;
  document.querySelector("#load-level").disabled = false;
  document.querySelector("#builder-tools").classList.remove("is-hidden");
  document.querySelector("#shelf-help").textContent = "Fixed stays in the level. Player parts are given to the player. Click Build again to leave.";
  setLayer(state.layer || "fixed");
  renderTray();
  renderDots();
}

function closeLoadPanel() {
  document.querySelector("#load-panel").classList.add("is-hidden");
}

function openRoleMenu(event, target) {
  state.roleTarget = target;
  const menu = document.querySelector("#role-menu");
  const select = document.querySelector("#role-choice");
  document.querySelector("#role-label").textContent = target === "start" ? "Start object" : "End watches";
  const current = target === "start"
    ? state.session.world.bodies.find((body) => body.builderKind === "start")?.partType
    : state.session.world.bodies.find((body) => body.builderKind === "goal-pin")?.goalRole;
  select.value = ["ball", "balloon", "domino"].includes(current) ? current : "ball";
  menu.style.left = `${Math.min(event.clientX + 12, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(event.clientY + 12, window.innerHeight - 92)}px`;
  menu.classList.remove("is-hidden");
  select.focus();
}

function closeRoleMenu() {
  state.roleTarget = null;
  document.querySelector("#role-menu")?.classList.add("is-hidden");
}

async function openLoadPanel() {
  if (!state.building || state.session.playing) return;
  const list = document.querySelector("#load-list");
  const empty = document.querySelector("#load-empty");
  list.innerHTML = "";
  let levels = [];
  try {
    const response = await fetch("/api/levels");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not list levels.");
    for (const item of data.levels || []) {
      const mod = await import(`../extra_levels/${item.file}?v=${Date.now()}`);
      if (mod.level) levels.push(mod.level);
    }
  } catch {
    levels = state.levels.filter((level) => Number(level.id) > 11);
  }
  levels.sort((a, b) => a.id - b.id);
  empty.classList.toggle("is-hidden", levels.length > 0);
  for (const level of levels) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${level.name}  ·  level${level.id}.js`;
    button.addEventListener("click", () => {
      state.building = true;
      state.layer = "fixed";
      state.session = sessionFromSaved(level);
      state.selected = null;
      state.selectedRope = null;
      state.tool = null;
      state.placing = null;
      state.ropeAnchor = null;
      state.drag = null;
      state.showHint = false;
      state.celebrated = false;
      modal.classList.add("hidden");
      closeLoadPanel();
      showBuilderChrome();
      state.session.message = `Loaded extra_levels/level${level.id}.js`;
    });
    list.append(button);
  }
  document.querySelector("#load-panel").classList.remove("is-hidden");
}

function setLayer(layer) {
  state.layer = layer;
  document.querySelector("#layer-fixed").classList.toggle("on", layer === "fixed");
  document.querySelector("#layer-player").classList.toggle("on", layer === "solution");
}

async function saveBuiltLevel() {
  if (!state.building || state.session.playing) return;
  const captured = captureLevel(state.session);
  if (captured.error) {
    state.session.message = captured.error;
    return;
  }
  const button = document.querySelector("#save-level");
  button.disabled = true;
  try {
    const response = await fetch("/api/levels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(captured.level),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not save the level.");
    state.levels.push(data.level);
    loadLevel(state.levels.length - 1);
    state.session.message = `Saved extra_levels/${data.file}`;
  } catch (error) {
    state.session.message = error.message === "Failed to fetch"
      ? "Save needs npm start so the level can be written."
      : error.message;
    if (state.building) button.disabled = false;
  }
}
