// Synthesizes the game's sound effects into assets/sounds/*.wav. No samples, no dependencies:
// run `node scripts/make-sounds.mjs` after changing a recipe below.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// A tiny deterministic noise source, so regenerating gives identical files.
let seed = 7;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Adds a tone with a fast attack and exponential decay. `harmonics` shape the timbre. */
function tone(out, { at, freq, length, gain = 0.5, decay = 6, harmonics = [1], slideTo, vibrato = 0 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(length * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const f = slideTo ? freq + (slideTo - freq) * (i / n) : freq;
    phase += (2 * Math.PI * f * (1 + vibrato * Math.sin(2 * Math.PI * 6 * t))) / RATE;
    const env = Math.min(1, t / 0.004) * Math.exp(-decay * t);
    let v = 0;
    harmonics.forEach((h, k) => (v += h * Math.sin(phase * (k + 1))));
    out[start + i] += v * env * gain;
  }
}

/** Adds a burst of filtered noise, e.g. a snare hit or a stamp. */
function hiss(out, { at, length, gain = 0.4, decay = 30, smooth = 0.5 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(length * RATE);
  let last = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    last = last * smooth + noise() * (1 - smooth);
    out[start + i] += last * Math.exp(-decay * t) * gain;
  }
}

function write(name, samples) {
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round((v / peak) * 0.9 * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(OUT, `${name}.wav`), Buffer.concat([header, data]));
}

const bright = [1, 0.35, 0.15];
const brass = [1, 0.6, 0.45, 0.3, 0.2];

const recipes = {
  // A player joined the lobby: two rising notes.
  join: () => {
    const s = buffer(0.35);
    tone(s, { at: 0, freq: note(76), length: 0.2, harmonics: bright, decay: 12 });
    tone(s, { at: 0.09, freq: note(83), length: 0.25, harmonics: bright, decay: 10 });
    return s;
  },
  // Your clue turn starts: a quick major arpeggio.
  turn: () => {
    const s = buffer(0.5);
    [72, 76, 79, 84].forEach((m, i) => tone(s, { at: i * 0.07, freq: note(m), length: 0.25, harmonics: bright, decay: 9 }));
    return s;
  },
  // Each of the last 5 seconds of a timer.
  tick: () => {
    const s = buffer(0.06);
    tone(s, { at: 0, freq: 1600, length: 0.05, decay: 90, harmonics: [1, 0.2] });
    hiss(s, { at: 0, length: 0.01, gain: 0.3, decay: 400, smooth: 0 });
    return s;
  },
  // The vote stamp lands.
  lock: () => {
    const s = buffer(0.3);
    tone(s, { at: 0, freq: 180, slideTo: 60, length: 0.25, gain: 0.9, decay: 14 });
    hiss(s, { at: 0, length: 0.08, gain: 0.6, decay: 45, smooth: 0.7 });
    return s;
  },
  // A vote lands on an avatar in the results.
  pop: () => {
    const s = buffer(0.12);
    tone(s, { at: 0, freq: 380, slideTo: 900, length: 0.1, decay: 25, harmonics: [1, 0.15] });
    return s;
  },
  // Before the results: a snare roll that builds, then a crash.
  drumroll: () => {
    const s = buffer(2.6);
    const roll = 1.9;
    for (let at = 0; at < roll; at += 0.045) {
      hiss(s, { at, length: 0.05, gain: 0.15 + 0.35 * (at / roll), decay: 60, smooth: 0.2 });
    }
    hiss(s, { at: roll, length: 0.7, gain: 0.8, decay: 5, smooth: 0.05 });
    tone(s, { at: roll, freq: 90, slideTo: 50, length: 0.3, gain: 0.9, decay: 10 });
    return s;
  },
  // The round went your way.
  win: () => {
    const s = buffer(1.1);
    [67, 72, 76].forEach((m, i) => tone(s, { at: i * 0.11, freq: note(m), length: 0.2, harmonics: brass, decay: 8, gain: 0.4 }));
    tone(s, { at: 0.33, freq: note(79), length: 0.75, harmonics: brass, decay: 3, gain: 0.5, vibrato: 0.004 });
    tone(s, { at: 0.33, freq: note(72), length: 0.75, harmonics: brass, decay: 3, gain: 0.3 });
    return s;
  },
  // The round didn't go your way: a sad trombone.
  lose: () => {
    const s = buffer(1.5);
    [67, 66, 65].forEach((m, i) => tone(s, { at: i * 0.3, freq: note(m), length: 0.32, harmonics: brass, decay: 2, gain: 0.4 }));
    tone(s, { at: 0.9, freq: note(64), slideTo: note(63), length: 0.6, harmonics: brass, decay: 2.5, gain: 0.45, vibrato: 0.02 });
    return s;
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(recipes)) write(name, make());
console.log(`Wrote ${Object.keys(recipes).length} sounds to ${OUT}`);
