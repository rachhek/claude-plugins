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
  // Three-quarter view, head and body both turned towards where it faces:
  // the belly bulges that way, with the arm and white hip behind it
  const shapes: Shape[] = [
    // Behind, on the side it faces away from: the white hip and back leg
    ...furBall(5.6, 17.4, 4.2, 4.4),
    ell('K', 7, 21.2, 3.6, 2.4),
    // The big belly, bulging towards the side it faces
    ...furBall(13.2, 17, 7, 6.2),
    // The black arm along the back of the belly, and the shoulder band
    ell('K', 8.2, 15, 3.2, 5.2),
    ell('k', 7.6, 13.2, 0.9, 2),
    ell('K', 12.6, 11.4, 7.6, 2),
    // A small paw on the facing side, and the front foot planted in front
    ...(s.isMunching ? [] : [ell('K', 19.6, 16.4, 1.7, 2.6)]),
    ell('K', 16.8, 21.2, 3.9, 2.6),
    ell('k', 17.4, 21.5, 1.3, 0.8),
    // Ears: the far one smaller
    ell('K', 6.8, 3.4, 2.2, 2.2),
    ell('K', 19, 3.2, 2.6, 2.5),
    ell('k', 18.3, 2.6, 0.9, 0.9),
    ...furBall(13.4, 8.2, 8.6, 6.6),
    // Droopy grey eye patches; the far one narrower, as it's turned away
    ell('P', 10, 8.4, 1.9, 2.5),
    ell('P', 9.5, 9.6, 1.7, 1.8),
    ell('P', 17, 8.2, 2.4, 2.6),
    ell('P', 17.7, 9.5, 2.2, 2.1),
    // A little triangle nose and a tiny mouth, towards the near side
    rect('N', 13.2, 11.2, 2.2, 0.7),
    rect('N', 13.7, 11.9, 1.2, 0.6),
    rect('N', 13.5, 13, 1.6, 0.4),
  ]
  if (s.isAsleep || s.isBlinking) shapes.push(rect('L', 8.4, 8.8, 3, 0.6), rect('L', 15.2, 8.8, 3.6, 0.6))
  else if (s.isHappy) {
    // Shades on
    shapes.push(rect('B', 7.6, 7, 4.4, 3), rect('B', 14.6, 7, 5.2, 3), rect('B', 12, 7, 2.6, 1), rect('B', 19.8, 7, 1.6, 1))
    shapes.push(px('w', [8.4, 7.4], [15.6, 7.4]))
  } else {
    // Dark eyes, each with a glint
    shapes.push(ell('E', 10.4, 8.8, 0.95, 1.3), ell('E', 17.4, 8.6, 1.2, 1.4))
    shapes.push(px('w', [10.1, 8.1], [17, 7.9]))
  }
  if (s.chew) shapes.push(rect('R', 13.6, 12.8, 1.4, 0.8))
  if (s.isMunching) {
    // A stalk of bamboo held up in the near paw, leaves at the top
    shapes.push(rect('G', 19.4, 2, 2, 20), px('g', [19.4, 7], [20.4, 14]))
    shapes.push(ell('g', 22.4, 2.6, 2, 1), ell('g', 18, 3.4, 2, 0.9))
    shapes.push(ell('K', 18.6, 13.4, 2.6, 2.2), ell('k', 18, 12.8, 0.8, 0.7))
  }
  return { w: 24, h: 24, shapes }
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
const TALLEST = Math.ceil(24 * DESK_SCALE) + 2 // the sitting pose, with its outline

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
    const sp = mirror(paint(p, Math.min(TERM_SCALE, TERM_W / p.w), false), s.dir)
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
