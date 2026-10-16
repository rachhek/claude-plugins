import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The panda, in three chunky poses: sitting up (idle, munching, shades on,
// jumping), walking on all fours, and lying flat asleep. Each pose is a list
// of rounded shapes painted in order onto a pixel grid, so the same panda
// comes out at desktop size and, scaled down, at terminal size.

// Pixels: K black fur, k its sheen, P eye patch, E eye, W white fur, S white
// fur in shadow, w eye glint, N nose and mouth, L closed eye, B shades, R open mouth,
// G bamboo, g bamboo leaf, O outline (added around the whole sprite)
type Shape =
  | { c: string; e: [cx: number, cy: number, rx: number, ry: number] }
  | { c: string; r: [x: number, y: number, w: number, h: number] }
  | { c: string; p: [x: number, y: number][] }

type Pose = { w: number; h: number; shapes: Shape[] }

const ell = (c: string, cx: number, cy: number, rx: number, ry: number): Shape => ({ c, e: [cx, cy, rx, ry] })
const rect = (c: string, x: number, y: number, w: number, h: number): Shape => ({ c, r: [x, y, w, h] })
const px = (c: string, ...p: [number, number][]): Shape => ({ c, p })

// White fur with a soft shadow along its lower right edge
const furBall = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  ell('S', cx, cy, rx, ry),
  ell('W', cx - rx * 0.08, cy - ry * 0.1, rx * 0.92, ry * 0.9),
]

function sitting(s: Scene): Pose {
  // Three-quarter view, turned towards where it faces (drawn facing right).
  // A pear-shaped silhouette, wider at the bottom than the head: dark fur
  // with a collar across the chest, an arm running down the middle, a white
  // belly on the facing side and a white hip on the back edge
  // The big front foot bulging out on the facing side, outlined against the body
  const frontFoot = [ell('O', 21.6, 24.4, 3.6, 3.7), ell('K', 21.6, 24.4, 3, 3.2), ell('k', 21.2, 23.6, 1.2, 1)]
  const shapes: Shape[] = [
    // Dark body
    ell('K', 13, 21.4, 10.6, 7.2),
    // The white hip on the back edge, with the back foot under it
    ell('S', 4.8, 21.6, 2.3, 4.3),
    ell('W', 4.7, 21.2, 2, 3.9),
    ell('K', 5.6, 26.3, 2.4, 1.6),
    // The white belly on the facing side
    ...furBall(16, 21.9, 5, 5.7),
    // The arm's sheen, and the leg block in the middle with a lighter pad
    // The arm, its own outlined shape, running from the shoulder down to the
    // hand resting against the hip
    ell('O', 7.6, 16.8, 3, 2.8),
    ell('O', 9, 19.1, 3, 2.8),
    ell('O', 10.2, 21.3, 2.9, 2.5),
    ell('K', 7.6, 16.8, 2.4, 2.2),
    ell('K', 9, 19.1, 2.4, 2.2),
    ell('K', 10.2, 21.3, 2.3, 1.9),
    // The leg block in the middle, outlined against the body, with a pad
    ell('O', 11.2, 24.3, 3.5, 3.8),
    ell('K', 11.2, 24.3, 2.9, 3.3),
    ell('k', 11.2, 24.7, 1.3, 1.8),
    // The big front foot, bulging out on the facing side
    ...(s.isMunching ? [] : frontFoot),
    // The collar across the chest, under the head
    // A broad neck: the collar as wide as the head, its sides running
    // straight down into the body
    ell('K', 12.8, 15.8, 8.4, 2.6),
    rect('K', 5, 14.6, 15.6, 3.2),
    // Ears at the top corners of the head
    ell('K', 6.6, 2.6, 2.4, 2.2),
    ell('K', 18.8, 2.4, 2.2, 2.1),
    ell('k', 6, 2, 0.8, 0.7),
    // A round head, a bit narrower than the body
    ...furBall(12.8, 8.2, 8.2, 6.8),
    // Eye patches, close together
    ell('P', 10.4, 8.4, 2.3, 2.4),
    ell('P', 16.4, 8.3, 2.4, 2.5),
    // A small triangle nose under the gap between the eyes, a short stroke
    // and a straight mouth line: calm and content
    rect('N', 12.3, 10.8, 3, 0.7),
    rect('N', 12.9, 11.5, 1.8, 0.6),
    rect('N', 13.5, 12.1, 0.6, 0.7),
    rect('N', 12.5, 12.8, 2.6, 0.6),
  ]
  if (s.isAsleep || s.isBlinking) shapes.push(rect('L', 9, 8.8, 2.8, 0.6), rect('L', 15, 8.8, 2.8, 0.6))
  else if (s.isHappy) {
    // Shades on
    shapes.push(rect('B', 7.8, 6.8, 5, 3.4), rect('B', 13.8, 6.8, 5.2, 3.4), rect('B', 12.8, 7.2, 1, 0.8))
    shapes.push(rect('B', 6, 7.2, 1.8, 0.8), rect('B', 19, 7.2, 1.6, 0.8))
    shapes.push(rect('w', 8.6, 7.4, 0.6, 0.6), rect('w', 14.6, 7.4, 0.6, 0.6))
  } else {
    // Big soft pupils, each with a tiny glint
    shapes.push(rect('E', 10.2, 7.6, 1.9, 2.2), rect('E', 16.4, 7.5, 2, 2.3))
    shapes.push(rect('w', 10.3, 7.7, 0.6, 0.6), rect('w', 16.5, 7.6, 0.6, 0.6))
  }
  if (s.chew) shapes.push(rect('R', 13.1, 12.8, 1.2, 0.7))
  if (s.isMunching) {
    // A stalk of bamboo held up in front, leaves at the top
    shapes.push(rect('G', 21, 5, 1.8, 22), px('g', [21, 10], [21.8, 18]))
    shapes.push(ell('g', 23.6, 5.4, 2, 0.9), ell('g', 19.6, 6.2, 1.8, 0.8))
    shapes.push(ell('K', 21, 17.4, 2.6, 2.2), ell('k', 20.4, 16.8, 0.8, 0.6))
    shapes.push(...frontFoot)
  }
  return { w: 26, h: 28, shapes }
}

function walking(s: Scene): Pose {
  // Legs swap between two strides
  const stride = s.legs === 'b' ? 1.5 : 0
  const shapes: Shape[] = [
    ell('K', 5 + stride, 14.5, 2.6, 3.3),
    ell('K', 16 - stride, 14.5, 2.6, 3.3),
    ...furBall(11, 10, 9.5, 5.5),
    // The far legs peek out behind
    ell('K', 7.5 - stride, 14.8, 2.2, 2.9),
    ell('K', 13.5 + stride, 14.8, 2.2, 2.9),
    // Shoulder band running down into the front leg
    ell('K', 15, 9.5, 2.9, 5.4),
    ell('K', 18.2, 2.8, 2.2, 2.2),
    ell('K', 21.6, 2.5, 2, 2),
    ...furBall(20.5, 7.6, 5.4, 5),
    ell('k', 17.7, 2.3, 0.9, 0.9),
    ell('P', 21.8, 7.2, 1.7, 2.1),
    px('N', [25, 8], [25, 9]),
  ]
  if (s.isBlinking) shapes.push(rect('L', 20.6, 7.4, 2.4, 0.6))
  else shapes.push(ell('E', 22.2, 7.3, 0.9, 1.1), px('w', [21.9, 6.6]))
  return { w: 26, h: 18, shapes }
}

function sleeping(): Pose {
  // A big head lying on its chin, with the body a small lump behind it
  return {
    w: 28,
    h: 17,
    shapes: [
      ...furBall(8.5, 11.8, 7.8, 4.4),
      // Legs lying along the ground
      ell('K', 12, 15.3, 11, 1.9),
      // Ears
      ell('K', 12.6, 3.2, 2.7, 2.7),
      ell('K', 24.4, 3.2, 2.7, 2.7),
      ...furBall(18.5, 9.2, 9.6, 7.2),
      // Big eye patches, eyes closed
      ell('k', 11.9, 2.5, 1, 1),
      ell('k', 23.7, 2.5, 1, 1),
      ell('P', 14.3, 9.7, 3.3, 2.7),
      ell('P', 22.7, 9.7, 3.3, 2.7),
      rect('L', 12.6, 10, 3.4, 0.6),
      rect('L', 21, 10, 3.4, 0.6),
      px('N', [18, 12], [19, 12]),
      // Front paws tucked under the chin, and one paw against its cheek
      ell('K', 18.5, 15.6, 5.2, 1.5),
      ell('K', 8.8, 8.6, 2.4, 2.6),
      ell('k', 8.8, 8.8, 1.1, 1.2),
    ],
  }
}

function pose(s: Scene): Pose {
  if (s.isAsleep) return sleeping()
  if (s.air === 0 && (s.legs === 'a' || s.legs === 'b')) return walking(s)
  return sitting(s)
}

// Paint the shapes onto a grid, scaled, and optionally ring it with outline
function paint(p: Pose, scale: number, withOutline: boolean): string[] {
  const W = Math.ceil(p.w * scale)
  const H = Math.ceil(p.h * scale)
  const grid = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  for (const sh of p.shapes) {
    if ('e' in sh) {
      const [cx, cy, rx, ry] = sh.e.map(v => v * scale) as [number, number, number, number]
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = (x + 0.5 - cx) / rx
          const dy = (y + 0.5 - cy) / ry
          if (dx * dx + dy * dy <= 1) grid[y]![x] = sh.c
        }
    } else if ('r' in sh) {
      const [x0, y0, w, h] = sh.r.map(v => Math.round(v * scale)) as [number, number, number, number]
      for (let y = y0; y < y0 + Math.max(1, h); y++)
        for (let x = x0; x < x0 + Math.max(1, w); x++) if (grid[y]?.[x] !== undefined) grid[y]![x] = sh.c
    } else {
      // A point is one pixel at terminal size and a small block when finer
      const size = Math.max(1, Math.round(scale))
      for (const [x, y] of sh.p) {
        const gx = Math.floor(x * scale)
        const gy = Math.floor(y * scale)
        for (let dy = 0; dy < size; dy++)
          for (let dx = 0; dx < size; dx++) if (grid[gy + dy]?.[gx + dx] !== undefined) grid[gy + dy]![gx + dx] = sh.c
      }
    }
  }
  const rows = grid.map(r => r.join(''))
  if (!withOutline) return rows
  // A one-pixel dark outline around the whole silhouette
  const filled = (y: number, x: number) => (rows[y]?.[x] ?? '.') !== '.'
  const out: string[] = []
  for (let y = -1; y <= H; y++) {
    let line = ''
    for (let x = -1; x <= W; x++) {
      if (filled(y, x)) line += rows[y]![x]
      else line += filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1) ? 'O' : '.'
    }
    out.push(line)
  }
  return out
}

// ---------------------------------------------------------------- drawing

const TERM_SCALE = 0.62
const TERM_W = 16
const TERM_ROWS = 16 // pixel rows, two per text row

const TERM = {
  K: '#50545c',
  k: '#62666f',
  P: '#6a6e78',
  E: '#1e1e1e',
  W: '#f3efe4',
  S: '#cfc9bb',
  w: '#ffffff',
  N: '#2a2a2a',
  L: '#9a9a9a',
  B: '#1c1c1c',
  R: '#a04a5a',
  G: '#7bc96f',
  g: '#a5dc8f',
}

const SVG = {
  O: '#16171b',
  K: '#33363d',
  k: '#4b4f58',
  P: '#585c66',
  E: '#0e0f12',
  W: '#f4f0e5',
  S: '#d7d0c1',
  w: '#ffffff',
  N: '#16171b',
  L: '#2a2c31',
  B: '#0e0f12',
  R: '#9c3f52',
  G: '#5fae45',
  g: '#93d07a',
}

const GRASS = ".,..'..,...'.,..,'...,.."

const DESK_SCALE = 1.6 // the desktop paints a finer grid...
const PX = 2.5 // ...with smaller pixels, so the panda keeps its size
const UNIT = 4 // grass, shadow and speech bubble keep chunkier pixels
const CELL = 8
const LIFT = 5
const TALLEST = Math.ceil(28 * DESK_SCALE) + 2 // the sitting pose, with its outline

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*cracks knuckles*', 'bug? easy.'])
  if (/\b(test|spec)/.test(t)) return pick(['tests. nice.', 'go green.'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['ship it.', 'send it.'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['clean.', 'respect.'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['anytime.', 'np.'])
  if (/\b(food|lunch|snack|eat)/.test(t)) return pick(['bamboo?', 'snack break.'])
  if (text.trim().endsWith('?')) return pick(['hmm.', 'good q.', '*thinks*'])
  return pick(['on it.', 'yep.', "let's go.", 'bet.', '*nods*'])
}

export const panda: Character = {
  width: TERM_W,
  canMunch: true,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GRASS[i % GRASS.length]
    const p = pose(s)
    // Scale down to the terminal, narrower still for a pose too wide to fit
    const sp = mirror(paint(p, Math.min(TERM_SCALE, TERM_W / p.w, TERM_ROWS / p.h), false), s.dir)
    // Feet on the bottom row, lifted while jumping as far as the band allows
    const lift = Math.min(s.air, TERM_ROWS - sp.length)
    return {
      rows: halfBlocks(sp, TERM_ROWS - sp.length - lift, TERM_W, TERM_ROWS, TERM),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const sp = mirror(paint(pose(s), DESK_SCALE, true), s.dir)
    const w = cols * CELL
    const size = (sp[0]?.length ?? 0) * PX
    const groundY = TALLEST * PX + 4 * LIFT + 2 * UNIT
    const h = groundY + 3 * UNIT
    const ox = s.x * CELL
    const oy = groundY - sp.length * PX + PX - s.air * LIFT

    const grass: string[] = []
    for (let i = 0; i < w; i += 9 * UNIT) {
      const gx = i + 2 * UNIT
      grass.push(
        `<rect x="${gx}" y="${groundY - UNIT}" width="${UNIT}" height="${UNIT}" fill="#86b96e"/>` +
          `<rect x="${gx + 2 * UNIT}" y="${groundY - 2 * UNIT}" width="${UNIT}" height="${2 * UNIT}" fill="#86b96e"/>`,
      )
    }

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="${UNIT * 0.6}" fill="#a8cf93"/>` +
      grass.join('') +
      shadowSvg(s, ox, size, groundY, UNIT) +
      // A faint light rim so the dark outline still reads on a dark background
      outline(sp, ox, oy, PX, '#5d5658') +
      pixels(sp, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, UNIT) +
      `</svg>`
    )
  },

  lines: {
    hi: 'yo.',
    jump: 'hup!',
    done: ['nailed it.', 'done.', 'ez.'],
    abort: 'k.',
    error: 'oof.',
    snack: ['*munch*', 'nom', '*crunch*'],
    react,
  },
}
