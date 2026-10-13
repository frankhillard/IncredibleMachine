import { anchorPoint } from "./physics.js";
import { PARTS } from "./parts.js";

export function drawWorld(ctx, session, view) {
  const { time, particles } = view;
  ctx.clearRect(0, 0, 960, 540);
  drawFelt(ctx, session, time);
  for (const decor of session.level.decors || []) drawDecor(ctx, decor, time);
  for (const body of session.world.bodies) {
    if (body.meta?.fan) drawWind(ctx, body, time, session.playing);
  }
  for (const rope of session.world.constraints) drawRope(ctx, rope, time);
  const bodies = session.world.bodies.filter((body) => body.alive && body.style !== "sensor" && body.y < 700);
  bodies.sort((a, b) => Number(a.static) - Number(b.static));
  for (const body of bodies) drawBody(ctx, body, time, session.playing, 1);
  drawGoals(ctx, session, time);
  if (view.showHint) drawHints(ctx, session, time);
  if (view.placing) {
    if (view.placing.meta?.fan) drawWind(ctx, view.placing, time, false);
    drawBody(ctx, view.placing, time, false, 0.55);
  }
  if (view.ropeAnchor && view.mouse) {
    ctx.save();
    ctx.strokeStyle = "rgba(92, 58, 28, 0.7)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.ropeAnchor.x, view.ropeAnchor.y);
    ctx.lineTo(view.mouse.x, view.mouse.y);
    ctx.stroke();
    ctx.restore();
  }
  if (view.selected) strokeSelect(ctx, view.selected);
  if (view.selectedRope) strokeRope(ctx, view.selectedRope);
  for (const bit of particles) drawBit(ctx, bit);
}

function drawFelt(ctx, session, time) {
  const felt = ctx.createLinearGradient(0, 0, 0, 540);
  felt.addColorStop(0, "#2a7d52");
  felt.addColorStop(1, "#1c5a3b");
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, 960, 540);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#f4e7c4";
  for (let y = 18; y < 540; y += 22) {
    for (let x = 18; x < 960; x += 22) ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(480, 250, 120, 480, 270, 560);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = "rgba(255,244,214,0.28)";
  ctx.font = "800 13px Nunito, system-ui, sans-serif";
  ctx.fillText(`TABLE ${String(session.level.id).padStart(2, "0")}`, 26, 32);
  ctx.font = "700 12px Nunito, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,244,214,0.45)";
  const label = session.playing ? "RUNNING" : "SETTING UP";
  ctx.fillText(label, 860, 32);
  void time;
}

function drawDecor(ctx, decor) {
  if (decor.type === "pit") {
    ctx.save();
    ctx.fillStyle = "rgba(8, 20, 14, 0.45)";
    ctx.beginPath();
    ctx.ellipse(decor.x, Math.min(decor.y, 520), decor.w / 2, Math.min(decor.h, 80) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGoals(ctx, session, time) {
  for (const body of session.world.bodies) {
    if (body.role !== "goal") continue;
    const pulse = 0.35 + Math.sin(time * 4) * 0.08;
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.strokeStyle = `rgba(255, 220, 120, ${pulse + 0.35})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    roundRect(ctx, -body.hw, -body.hh, body.hw * 2, body.hh * 2, 10);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 214, 90, ${0.08 + pulse * 0.08})`;
    ctx.fill();
    ctx.restore();
  }
}

function drawHints(ctx, session, time) {
  const alpha = 0.28 + Math.sin(time * 3) * 0.08;
  for (const part of session.level.solution || []) {
    if (!PARTS[part.type] || PARTS[part.type].tool === "rope") continue;
    const ghost = ghostBody(part);
    drawBody(ctx, ghost, time, false, alpha);
    ctx.save();
    ctx.translate(part.x, part.y);
    ctx.strokeStyle = "rgba(255,244,210,0.8)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-18, -18, 36, 36);
    ctx.restore();
  }
}

function ghostBody(part) {
  const def = PARTS[part.type];
  return {
    ...def,
    x: part.x,
    y: part.y,
    angle: part.angle || 0,
    partType: part.type,
    style: def.style,
    hw: (part.w || def.w || 40) / 2,
    hh: (part.h || def.h || 40) / 2,
    r: part.r || def.r || 16,
    shape: def.shape || "box",
    meta: { ...(def.meta || {}), ...(part.meta || {}) },
    alive: true,
    static: !!def.static,
    pinned: !!def.pinned,
  };
}

export function drawBody(ctx, body, time, playing, alpha) {
  if (!body || body.style === "sensor") return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle || 0);
  const style = body.style || body.partType;
  if (body.shape === "circle" && style !== "scamp") {
    if (style === "ball") drawBall(ctx, body);
    else if (style === "weight") drawWeight(ctx, body);
    else if (style === "balloon") drawBalloon(ctx, body, time);
    else if (style === "cheese") drawCheese(ctx, body);
    else drawBall(ctx, body);
  } else if (style === "scamp") {
    ctx.rotate(-(body.angle || 0));
    drawScamp(ctx, body, time, playing);
  } else if (style === "fan") drawFan(ctx, body, time, playing);
  else if (style === "candle") drawCandle(ctx, body, time);
  else if (style === "spring") drawSpring(ctx, body);
  else if (style === "conveyor") drawConveyor(ctx, body, time, playing);
  else if (style === "domino") drawDomino(ctx, body);
  else if (style === "seesaw") drawSeesaw(ctx, body);
  else if (style === "block") drawBlock(ctx, body);
  else if (style === "basket" || style === "brick" || style === "frame") drawBeam(ctx, body, style);
  else drawBoard(ctx, body, style);
  ctx.restore();
}

function drawBoard(ctx, body, style) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  const wood = style === "plank" ? ["#e0b56a", "#b7793a"] : style === "floor" ? ["#c4894a", "#8d5a2b"] : ["#e7c27a", "#c4843c"];
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, wood[0]);
  g.addColorStop(1, wood[1]);
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(6, h / 2));
  ctx.fill();
  ctx.strokeStyle = "rgba(92, 48, 18, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,236,200,0.28)";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, -h / 2 + 4);
  ctx.lineTo(w / 2 - 8, -h / 2 + 4);
  ctx.stroke();
  if (body.static && body.partType === "board") {
    ctx.fillStyle = "#6e431c";
    for (const x of [-w / 2 + 12, w / 2 - 12]) {
      ctx.beginPath();
      ctx.arc(x, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBeam(ctx, body, style) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  const colors = {
    brick: ["#a3533c", "#7c3b2b"],
    frame: ["#6a3d22", "#3e2414"],
  };
  const pair = style === "brick" ? colors.brick : style === "frame" ? colors.frame : ["#c48a52", "#8d5a30"];
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, pair[1]);
  g.addColorStop(0.5, pair[0]);
  g.addColorStop(1, pair[1]);
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fill();
}

function drawBlock(ctx, body) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  drawBoard(ctx, body, "block");
  ctx.strokeStyle = "rgba(92, 48, 18, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, -h / 2 + 6);
  ctx.lineTo(w / 2 - 6, h / 2 - 6);
  ctx.moveTo(w / 2 - 6, -h / 2 + 6);
  ctx.lineTo(-w / 2 + 6, h / 2 - 6);
  ctx.stroke();
}

function drawBall(ctx, body) {
  const r = body.r;
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r);
  g.addColorStop(0, "#ffd0c8");
  g.addColorStop(0.45, "#e24b3c");
  g.addColorStop(1, "#8e1d22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.3, r * 0.28, 0.2, 1.4);
  ctx.stroke();
}

function drawWeight(ctx, body) {
  const r = body.r;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
  g.addColorStop(0, "#d7dde2");
  g.addColorStop(0.5, "#5d666c");
  g.addColorStop(1, "#1d2124");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c5ccd1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBalloon(ctx, body, time) {
  const r = body.r;
  const bob = Math.sin(time * 3 + body.x) * 1.5;
  ctx.translate(0, bob);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r);
  g.addColorStop(0, "#ffe4ec");
  g.addColorStop(0.4, "#ff5d7a");
  g.addColorStop(1, "#c81e4a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9a1738";
  ctx.beginPath();
  ctx.moveTo(0, r - 2);
  ctx.lineTo(-4, r + 8);
  ctx.lineTo(4, r + 8);
  ctx.fill();
  ctx.strokeStyle = "#6b3a1e";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, r + 8);
  ctx.quadraticCurveTo(6, r + 20, 0, r + 28);
  ctx.stroke();
}

function drawCheese(ctx, body) {
  ctx.fillStyle = "#f2c14e";
  ctx.beginPath();
  ctx.moveTo(-body.r, body.r * 0.6);
  ctx.lineTo(body.r, body.r * 0.2);
  ctx.lineTo(-body.r * 0.2, -body.r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#c4891e";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#e7a92e";
  for (const [x, y, r] of [
    [-4, 0, 4],
    [6, 4, 3],
    [-2, 8, 2.5],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScamp(ctx, body, time, playing) {
  const step = playing ? Math.sin(time * Math.max(8, Math.abs(body.vx || 0) * 0.15)) : 0;
  ctx.fillStyle = "#8a5a34";
  ctx.beginPath();
  ctx.ellipse(0, 2, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3d7b0";
  ctx.beginPath();
  ctx.ellipse(1, 6, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5a34";
  ctx.beginPath();
  ctx.ellipse(-8, -12, 5, 7, -0.4, 0, Math.PI * 2);
  ctx.ellipse(6, -13, 5, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7b7b0";
  ctx.beginPath();
  ctx.ellipse(-8, -11, 2.4, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(6, -12, 2.4, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1c14";
  ctx.beginPath();
  ctx.arc(4, -1, 1.6, 0, Math.PI * 2);
  ctx.arc(10, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5c3a22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 8);
  ctx.lineTo(-18, 8 + step * 4);
  ctx.moveTo(-6, 10);
  ctx.lineTo(-8, 14 - step * 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-16, 2);
  ctx.quadraticCurveTo(-24, 6, -20, 12);
  ctx.stroke();
}

function drawFan(ctx, body, time, playing) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  ctx.fillStyle = "#d7a441";
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "#7a5416";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(6, 0);
  const spin = time * (playing ? 14 : 2.5);
  ctx.rotate(spin);
  ctx.fillStyle = "#f7f1df";
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.ellipse(11, 0, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#5c4214";
  ctx.beginPath();
  ctx.arc(6, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, -6);
  ctx.lineTo(w / 2 + 8, 0);
  ctx.lineTo(w / 2 - 6, 6);
  ctx.fill();
}

function drawWind(ctx, fan, time, playing) {
  const wind = fan.meta?.fan;
  if (!wind) return;
  ctx.save();
  ctx.translate(fan.x, fan.y);
  ctx.rotate(fan.angle || 0);
  ctx.fillStyle = "rgba(214, 242, 255, 0.13)";
  ctx.fillRect(fan.hw - 2, -wind.spread / 2, wind.len, wind.spread);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  const speed = playing ? 180 : 40;
  for (let i = 0; i < 4; i++) {
    const y = -wind.spread / 2 + ((i + 0.5) * wind.spread) / 4;
    const shift = (time * speed + i * 40) % (wind.len + 30);
    ctx.beginPath();
    ctx.moveTo(fan.hw + shift, y);
    ctx.lineTo(fan.hw + shift + 18, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCandle(ctx, body, time) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  ctx.fillStyle = "#f4efe2";
  roundRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fill();
  ctx.fillStyle = "#e7d7a8";
  ctx.fillRect(-w / 2, -h / 2, w, 6);
  const flicker = 1 + Math.sin(time * 16 + body.x) * 0.12;
  ctx.save();
  ctx.translate(0, -h / 2);
  ctx.scale(flicker, 1);
  const g = ctx.createRadialGradient(0, -8, 1, 0, -6, 16);
  g.addColorStop(0, "rgba(255,250,220,0.95)");
  g.addColorStop(0.4, "rgba(255,170,50,0.9)");
  g.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -10, 7, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpring(ctx, body) {
  const w = body.hw * 2;
  ctx.fillStyle = "#8d97a1";
  roundRect(ctx, -w / 2, -2, w, body.hh * 2, 3);
  ctx.fill();
  ctx.strokeStyle = "#d5dbe1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const coils = 7;
  for (let i = 0; i <= coils; i++) {
    const x = -w / 2 + 6 + (i * (w - 12)) / coils;
    const y = i % 2 === 0 ? -body.hh - 8 : body.hh - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawConveyor(ctx, body, time, playing) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  ctx.fillStyle = "#4e5963";
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.clip();
  const speed = body.meta?.conveyor || 200;
  const offset = ((playing ? time * speed * 0.15 : time * 12) % 24);
  ctx.fillStyle = "#f0c14a";
  for (let x = -w / 2 - 24 + offset; x < w / 2; x += 24) ctx.fillRect(x, -h / 2 + 3, 10, h - 6);
  ctx.restore();
  ctx.fillStyle = "#2c333a";
  ctx.beginPath();
  ctx.arc(-w / 2 + 8, 0, 6, 0, Math.PI * 2);
  ctx.arc(w / 2 - 8, 0, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawDomino(ctx, body) {
  const w = body.hw * 2;
  const h = body.hh * 2;
  ctx.fillStyle = body.meta?.marked ? "#fff4d2" : "#f7f3ea";
  roundRect(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fill();
  ctx.strokeStyle = body.meta?.marked ? "#c0392b" : "#2a2420";
  ctx.lineWidth = body.meta?.marked ? 3 : 1.5;
  ctx.stroke();
  ctx.fillStyle = body.meta?.marked ? "#c0392b" : "#24324a";
  const pips = body.meta?.marked ? 1 : (body.id % 5) + 1;
  for (let i = 0; i < pips; i++) {
    const y = -h / 4 + (i % 3) * 8;
    const x = (i % 2 === 0 ? -3 : 3);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (body.meta?.marked) {
    ctx.fillStyle = "#c0392b";
    ctx.font = "900 11px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★", 0, h / 2 - 8);
  }
}

function drawSeesaw(ctx, body) {
  drawBoard(ctx, body, "board");
  ctx.save();
  ctx.rotate(-(body.angle || 0));
  ctx.fillStyle = "#6b3e22";
  ctx.beginPath();
  ctx.moveTo(-16, 10);
  ctx.lineTo(16, 10);
  ctx.lineTo(0, -4);
  ctx.fill();
  ctx.restore();
}

function drawRope(ctx, rope, time) {
  if (rope.broken) return;
  const a = anchorPoint(rope, "a");
  const b = anchorPoint(rope, "b");
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const sag = 10 + Math.max(0, rope.rest - Math.hypot(b.x - a.x, b.y - a.y)) * 0.15;
  const heat = rope.heat || 0;
  ctx.strokeStyle = heat > 0 ? `rgb(${80 + heat * 160}, ${50}, ${30})` : "#6a4324";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my + sag, b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = "#4a3118";
  ctx.beginPath();
  ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
  ctx.fill();
  if (heat > 0.05) {
    ctx.fillStyle = `rgba(255,${180 - heat * 80},40,${heat})`;
    ctx.beginPath();
    ctx.arc(mx + Math.sin(time * 20) * 2, my, 4 + heat * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function strokeSelect(ctx, body) {
  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(body.angle || 0);
  ctx.strokeStyle = "#ffe7a3";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  if (body.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, (body.r || 16) + 6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(-body.hw - 6, -body.hh - 6, body.hw * 2 + 12, body.hh * 2 + 12);
  }
  ctx.restore();
}

function strokeRope(ctx, rope) {
  const a = anchorPoint(rope, "a");
  const b = anchorPoint(rope, "b");
  ctx.save();
  ctx.strokeStyle = "#ffe7a3";
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawBit(ctx, bit) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, bit.life);
  ctx.fillStyle = bit.color;
  ctx.translate(bit.x, bit.y);
  ctx.rotate(bit.rot || 0);
  ctx.fillRect(-bit.size / 2, -bit.size / 2, bit.size, bit.size);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function paintIcon(canvas, type) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (type === "rope") {
    ctx.strokeStyle = "#6a4324";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 18);
    ctx.quadraticCurveTo(36, 40, 58, 16);
    ctx.stroke();
    return;
  }
  const def = PARTS[type];
  if (!def) return;
  const body = ghostBody({ type, x: 36, y: 28, angle: type === "domino" ? 0 : type === "seesaw" ? -0.2 : 0 });
  if (body.shape === "circle") body.r = Math.min(body.r || 16, 16);
  else {
    const scale = Math.min(48 / (body.hw * 2 || 48), 36 / (body.hh * 2 || 36), 1);
    body.hw *= scale;
    body.hh *= scale;
  }
  drawBody(ctx, body, 0, false, 1);
}
