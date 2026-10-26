// Generates assets/lottie/confetti.json: one burst of tumbling paper pieces falling across the screen.
// Run `node scripts/make-confetti.mjs` after changing it. Lottie is the After Effects JSON format;
// each piece is a shape layer with keyframed position, rotation and a flip (negative x scale).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'lottie');
const W = 400;
const H = 800;
const FPS = 60;
const FRAMES = 210;
const PIECES = 70;
const COLORS = ['#F43F5E', '#FACC15', '#22D3EE', '#A78BFA', '#34D399', '#FB923C', '#F472B6'];

let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (a, b) => a + (b - a) * rand();
const rgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);

const ease = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const spatialEase = { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 } };
const still = (k) => ({ a: 0, k });

function piece(index) {
  const start = Math.round(between(0, 40));
  const fall = Math.round(between(110, 170));
  const x = between(0, W);
  const drift = between(-90, 90);
  const color = rgba(COLORS[index % COLORS.length]);
  const round = rand() < 0.3;
  const size = round ? [10, 10] : [between(8, 12), between(14, 20)];
  const flips = Math.round(between(3, 7));
  const flipKeys = Array.from({ length: flips + 1 }, (_, i) => ({
    t: start + Math.round((fall * i) / flips),
    s: [i % 2 === 0 ? 100 : -100, 100, 100],
    ...ease,
  }));

  return {
    ddd: 0,
    ind: index + 1,
    ty: 4,
    nm: `piece ${index + 1}`,
    sr: 1,
    ks: {
      o: {
        a: 1,
        k: [
          { t: start, s: [100], ...ease },
          { t: start + fall - 20, s: [100], ...ease },
          { t: start + fall, s: [0] },
        ],
      },
      r: { a: 1, k: [{ t: start, s: [between(0, 360)], ...ease }, { t: start + fall, s: [between(-540, 540)] }] },
      p: {
        a: 1,
        k: [
          { t: start, s: [x, -30, 0], ...spatialEase, to: [0, 0, 0], ti: [0, 0, 0] },
          { t: start + fall, s: [x + drift, H + 30, 0] },
        ],
      },
      a: still([0, 0, 0]),
      s: { a: 1, k: flipKeys },
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        nm: 'paper',
        it: [
          round
            ? { ty: 'el', nm: 'dot', d: 1, s: still(size), p: still([0, 0]) }
            : { ty: 'rc', nm: 'strip', d: 1, s: still(size), p: still([0, 0]), r: still(2) },
          { ty: 'fl', nm: 'fill', c: still(color), o: still(100), r: 1 },
          { ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) },
        ],
      },
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  };
}

const animation = {
  v: '5.7.4',
  fr: FPS,
  ip: 0,
  op: FRAMES,
  w: W,
  h: H,
  nm: 'confetti',
  ddd: 0,
  assets: [],
  layers: Array.from({ length: PIECES }, (_, i) => piece(i)),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'confetti.json'), JSON.stringify(animation));
console.log(`Wrote ${PIECES} confetti pieces to ${OUT}/confetti.json`);
