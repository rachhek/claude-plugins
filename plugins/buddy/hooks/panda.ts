import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The panda, in three chunky poses: sitting up (idle, munching, shades on,
// jumping), walking on all fours, and lying flat asleep. Each pose is a list
// of rounded shapes painted in order onto a pixel grid, so the same panda
// comes out at desktop size and, scaled down, at terminal size.

// Pixels: K black fur, k foot pad, W white fur, S white fur in shadow,
// w eye glint, N nose and mouth, L closed eye, B shades, R open mouth,
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
  const shapes: Shape[] = [
    ...furBall(12, 16, 6.6, 5.8),
    // The black band over the shoulders, then arms and legs tucked in close
    ell('K', 12, 12, 6.6, 2),
    ell('K', 7.4, 15.2, 2, 3.4),
    ...(s.isMunching ? [] : [ell('K', 16.6, 15.2, 2, 3.4)]),
    ell('K', 8.2, 20.3, 2.9, 1.8),
    ell('K', 15.8, 20.3, 2.9, 1.8),
    ell('k', 8.2, 20.5, 1.3, 0.8),
    ell('k', 15.8, 20.5, 1.3, 0.8),
    // Round ears, set in from the corners
    ell('K', 6.2, 3.6, 2.4, 2.4),
    ell('K', 17.8, 3.6, 2.4, 2.4),
    ...furBall(12, 8.4, 8.4, 6.4),
    // Eye patches
    ell('K', 8.5, 8.8, 2.2, 2.7),
    ell('K', 15.5, 8.8, 2.2, 2.7),
    px('N', [11, 11], [12, 11]),
  ]
  if (s.isAsleep || s.isBlinking) shapes.push(px('L', [8, 9], [9, 9], [15, 9], [16, 9]))
  else if (s.isHappy) {
    // Shades on
    shapes.push(rect('B', 5, 7, 6, 3), rect('B', 13, 7, 6, 3), rect('B', 11, 7, 2, 1), rect('B', 4, 7, 1, 1), rect('B', 19, 7, 1, 1))
    shapes.push(px('w', [6, 7], [14, 7]))
  } else shapes.push(px('w', [8, 8], [15, 8]))
  if (s.chew) shapes.push(px('R', [11, 12], [12, 12]))
  if (s.isMunching) {
    // A stalk of bamboo held in its paw, leaves at the top
    shapes.push(rect('G', 18, 2, 2, 19), px('g', [18, 7], [19, 13]))
    shapes.push(ell('g', 21.2, 2.6, 2.6, 1), ell('g', 16.4, 3.6, 2.2, 0.9))
    shapes.push(ell('K', 17, 13.2, 2.6, 2.3))
  }
  return { w: 24, h: 22, shapes }
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
    ell('K', 21.8, 7.2, 1.7, 2.1),
    px('N', [25, 8], [25, 9]),
  ]
  if (!s.isBlinking) shapes.push(px('w', [22, 6]))
  return { w: 26, h: 18, shapes }
}

function sleeping(): Pose {
  return {
    w: 26,
    h: 13,
    shapes: [
      ell('K', 3.6, 10, 2.7, 2.4),
      ...furBall(10, 9, 9.5, 3.9),
      ell('K', 13.4, 8.6, 2.3, 4),
      ell('K', 13.8, 2.8, 2.3, 2.3),
      ell('K', 22.2, 2.8, 2.3, 2.3),
      ...furBall(18, 7, 6.6, 5.2),
      ell('K', 15.5, 7.2, 2.1, 1.8),
      ell('K', 20.5, 7.2, 2.1, 1.8),
      px('L', [15, 7], [16, 7], [20, 7], [21, 7]),
      px('N', [17, 9], [18, 9]),
      // Front paws tucked under the chin
      ell('K', 18, 11.6, 4.6, 1.6),
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
      for (const [x, y] of sh.p) {
        const gx = Math.floor(x * scale)
        const gy = Math.floor(y * scale)
        if (grid[gy]?.[gx] !== undefined) grid[gy]![gx] = sh.c
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
  K: '#4a4a4a',
  k: '#6a6a6a',
  W: '#f4f4f2',
  S: '#c9c6bf',
  w: '#ffffff',
  N: '#2a2a2a',
  L: '#9a9a9a',
  B: '#1c1c1c',
  R: '#a04a5a',
  G: '#7bc96f',
  g: '#a5dc8f',
}

const SVG = {
  O: '#1b1819',
  K: '#2b2729',
  k: '#4d4649',
  W: '#f8f5ee',
  S: '#d8d1c5',
  w: '#ffffff',
  N: '#1b1819',
  L: '#8f8689',
  B: '#0f0d0e',
  R: '#9c3f52',
  G: '#5fae45',
  g: '#93d07a',
}

const GRASS = ".,..'..,...'.,..,'...,.."

const PX = 4
const CELL = 8
const LIFT = 5
const TALLEST = 24 // the sitting pose, with its outline

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
    const sp = mirror(paint(pose(s), TERM_SCALE, false), s.dir)
    // Feet on the bottom row, lifted while jumping as far as the band allows
    const lift = Math.min(s.air, TERM_ROWS - sp.length)
    return {
      rows: halfBlocks(sp, TERM_ROWS - sp.length - lift, TERM_W, TERM_ROWS, TERM),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const sp = mirror(paint(pose(s), 1, true), s.dir)
    const w = cols * CELL
    const size = (sp[0]?.length ?? 0) * PX
    const groundY = TALLEST * PX + 4 * LIFT + 2 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - sp.length * PX + PX - s.air * LIFT

    const grass: string[] = []
    for (let i = 0; i < w; i += 9 * PX) {
      const gx = i + 2 * PX
      grass.push(
        `<rect x="${gx}" y="${groundY - PX}" width="${PX}" height="${PX}" fill="#86b96e"/>` +
          `<rect x="${gx + 2 * PX}" y="${groundY - 2 * PX}" width="${PX}" height="${2 * PX}" fill="#86b96e"/>`,
      )
    }

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="${PX * 0.6}" fill="#a8cf93"/>` +
      grass.join('') +
      shadowSvg(s, ox, size, groundY, PX) +
      // A faint light rim so the dark outline still reads on a dark background
      outline(sp, ox, oy, PX, '#5d5658') +
      pixels(sp, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, PX) +
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
