let ctx = null;
let muted = false;
let lastImpact = 0;

function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function blip(freq, dur, type, gain, slide = 0) {
  if (muted) return;
  const ac = audio();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, gain, freq = 800) {
  if (muted) return;
  const ac = audio();
  const t = ac.currentTime;
  const length = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(ac.destination);
  src.start(t);
}

export function sfx(name, intensity = 1) {
  if (name === "impact") {
    const now = performance.now();
    if (now - lastImpact < 90 || intensity < 0.35) return;
    lastImpact = now;
    noise(0.09, Math.min(0.18, 0.04 * intensity), 240 + intensity * 40);
    return;
  }
  if (name === "place") blip(520, 0.07, "triangle", 0.05);
  if (name === "rotate") blip(740, 0.05, "square", 0.03);
  if (name === "play") blip(440, 0.12, "triangle", 0.06, 180);
  if (name === "stop") blip(300, 0.1, "sine", 0.05, -120);
  if (name === "pop") noise(0.12, 0.12, 1400);
  if (name === "burn") noise(0.18, 0.08, 500);
  if (name === "spring") blip(180, 0.14, "sawtooth", 0.04, 400);
  if (name === "win") {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => blip(freq, 0.18, "triangle", 0.06), i * 90);
    });
  }
}
