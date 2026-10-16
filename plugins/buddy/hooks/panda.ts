import type { Scene } from '../types'
import { bubbleSvg, halfBlocksFromPixels, mirror, outline, pick, pixels, put, shadowSvg, smoothResize, svgOpen } from './shared'
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

type Pose = { w: number; h: number; shapes: Shape[] } | { w: number; h: number; sprite: string[] }

const ell = (c: string, cx: number, cy: number, rx: number, ry: number): Shape => ({ c, e: [cx, cy, rx, ry] })
const rect = (c: string, x: number, y: number, w: number, h: number): Shape => ({ c, r: [x, y, w, h] })
const px = (c: string, ...p: [number, number][]): Shape => ({ c, p })

// White fur with a soft shadow along its lower right edge
const furBall = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  ell('S', cx, cy, rx, ry),
  ell('W', cx - rx * 0.08, cy - ry * 0.1, rx * 0.92, ry * 0.9),
]

// The sitting panda is pixel art (art/sit.png), facing right.
// E outline and eyes, K dark fur, k lighter dark fur, W white fur, S shaded white fur
const SIT = [
  '.....EEEE..........EEE........',
  '....EEKkkE.EEEEEE.EEkkKE......',
  '...EEkEEkkEWWWWWWkkEkkkE......',
  '...EEEEEkEWWWWWWWWWWEkkE......',
  '...EEEEEESWWWWWWWWWWWEE.......',
  '....EEEESWWWWWWWWWWWWWE.......',
  '.....EESSWWWWWWWWWWWWWEE......',
  '.....ESSWWWkkkWWWWWkkWWE......',
  '....EESSWWkkkkkWWWWkkkWWE.....',
  '....ESSWWkkkEEkWWWWkEkkWE.....',
  '....ESSWWkkkEEkWWWWkEkkWE.....',
  '....ESSWWkkkkkWWWWWWkkkWE.....',
  '....ESSSWWkkkWWWEEEEWkWWE.....',
  '....EKSSWWWWWWWWWEEEWWWWE.....',
  '...EEKSSSWWWWWWWWWEWWWWE......',
  '...EEKKSSSWWWWWEEEEEWWSE......',
  '..EEKKKKKSSWWWWWWWWWWSE.......',
  '..EKKKKKKKSSSSSSSSSSEEE.......',
  '.EEEEKKKKKEkkkkkkkkkEKKE......',
  '.ESSEKKKKKKEkkkkkkkkkEKKE.....',
  '.ESSSEKKKKKEEWWWWWWWWEKKE.....',
  'EESSSEKKKKKKKEWWWWWWWWEKKE....',
  'ESSWSSEKKKKKKKEWWWWWWWEKKE....',
  'ESSWWSEKKKKKKKKEWWWWWWWEKE....',
  'ESSWWWWEEEEEEKKEWWWWWWWEEEEEE.',
  'ESSWWWEkkkkkkEEWWWWWWWWEEkkkkE',
  'ESSSWEKKkkkkkkEWWWWWWWSEkkkkkE',
  'ESSSEKKKkkKKKkEWWWWWWWSEkkkkkE',
  'EESSEKKKkkKKKkEWWWWWWSEKkkkkkE',
  '.ESSEKKKKkKKKkEWWWWWSSEKkkkkE.',
  '..ESEKKKKkKKKkESSSSSSEEKKkkkE.',
  '..EEEEEKKKkkkEESSSSSEEEKKKKE..',
  '.....EEEEEEEEEEEEEEEEEEEEEE...',
]
const SIT_W = SIT[0]?.length ?? 0
const SIT_H = SIT.length

function sitting(s: Scene): Pose {
  const rows = [...SIT]
  const set = (r: number, c0: number, c1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) put(rows, r, c, ch)
  }
  if (s.isAsleep || s.isBlinking) {
    // Pupils gone, a lighter line across each patch
    set(9, 12, 13, 'k')
    set(10, 12, 13, 'k')
    set(9, 20, 20, 'k')
    set(10, 20, 20, 'k')
    set(10, 10, 13, 'L')
    set(10, 19, 22, 'L')
  } else if (s.isHappy) {
    // Shades on: two lenses, a bridge, and arms out to the ears
    for (let r = 8; r <= 10; r++) {
      set(r, 8, 14, 'B')
      set(r, 17, 22, 'B')
    }
    set(9, 15, 16, 'B')
    set(9, 6, 7, 'B')
    put(rows, 9, 23, 'B')
    put(rows, 8, 9, 'w')
    put(rows, 8, 18, 'w')
  }
  if (s.chew) set(16, 16, 18, 'R')
  if (s.isMunching) {
    // A stalk of bamboo held up in the near paw, leaves at the top
    for (let r = 5; r <= 23; r++) set(r, 24, 25, 'G')
    put(rows, 10, 24, 'g')
    put(rows, 17, 25, 'g')
    set(4, 26, 28, 'g')
    set(5, 21, 23, 'g')
    set(18, 22, 26, 'E')
    set(19, 22, 26, 'K')
    set(20, 22, 26, 'K')
    set(21, 22, 26, 'K')
    set(22, 22, 26, 'E')
  }
  return { w: SIT_W, h: SIT_H, sprite: rows }
}

// The walking panda is pixel art too (art/walk-1.png and art/walk-2.png),
// two steps, facing right
const WALK = [
  [
    '................EEEEEEEEEEE.......................',
    '............EEEEWWWWWWWSKKKEEEEEE...EE............',
    '..........EESSSWWWWWWWWSKKKKKKKSSEEEWWEEEE........',
    '.........ESSWWWWWWWWWWSKKKKKKKKSWWWWWWWKKEE.......',
    '........ESWWWWWWWWWWWWSKKKKKKKKKSWWWWWKKKESE......',
    '.......EWWWWWWWWWWWWWWSKKKKKKKKKKSWWWEKKEESE......',
    '......EWWWWWWWWWWWWWWWSKKKKKKKKKKSWWWEEESSWWE.....',
    '.....ESWWWWWWWWSWWWWWSSKKKKKKKKKKESWSSESWWWWWSE...',
    '.....EWWWWWWSWWWSWWWWSKKKKKKKKKKKKSWWSSWWWWWWWE...',
    '....ESSSSSSSSSWWWWWWWKKKKKKKKKKKKKSWWWWWWWkkWSE...',
    '....ESSSSkkkkSSWWWWWSKKKKKKKKKKKKKKWWSWWWkKEEWE...',
    '...ESSSSkkkkkkSSWWWSSKKKKKKKKKKKKKKSWSWWWkEEEWWE..',
    '...ESSSEKkkkkkkSSSSSKKKKKKKKKKKKKEESWSWWkkEEWWWWE.',
    '...ESSSEKKKKkKKKkSSSKKKKKKKKKKKKEEESSSSWWkkWWWWWE.',
    '....ESSEKKKKKKKKKSSEKKKKKKKKKKKEEEEEEEESSWWWWWkEE.',
    '...EEEEEEKKKKKKKKESEEEKKKKKKKEEEEEEKEEEEEESSSEE...',
    '..EKKKKKEKKKKKKKKESEEEKKKKKEEEEEEKKEE.....EEE.....',
    '.EKKKKKKEEEKKKKKKEEEEKKKKKE...EEKKKKKE............',
    'EKKKKKKE..EKKKKKEE.EEKKKKKE....EEKKKKKEE..........',
    'EKKKKEE....EKKKKEE..EKKKKEE.....EEKKKKKKE.........',
    'EKKKKE.....EEKKKKKE.EEKKKE........EEKKKKkE........',
    '.EEEEE......EEEEEEE..EEEkKEE.......EEEEEEE........',
  ],
  [
    '................EEEEEEEEEEE.......................',
    '.............EEEWWWWWWWSKKKEEEEEEE...EE...........',
    '..........EEESSWWWWWWWWSKKKKKKKSSSEEEWWEEEE.......',
    '.........ESSSWWWWWWWWWWKKKKKKKKKSWWWWWWWKKKE......',
    '........ESWWWWWWWWWWWWWKKKKKKKKKKSWWWWWEKKKSE.....',
    '.......EWWWWWWWWWWWWWWWKKKKKKKKKKSWWWWEKKEESEE....',
    '......EWWWWWWWWWWWWWWWSKKKKKKKKKKKSWWWEKKkSWWEE...',
    '.....ESWWWWWWWWSWWWWWWSKKKKKKKKKKKESWSSESWWWWWSE..',
    '....EkWWWWWWSWWWSWWWWWSKKKKKKKKKKKKSWWSSWWWWWWWE..',
    '....EWWWSSSSSSWWWWWWWWKKKKKKKKKKKKKSWWWWWWWkkWSE..',
    '....EWWSSkkkkkSWWWWWWSKKKKKKKKKKKKKKWWWWWWkEEEWE..',
    '...EWWWSkkkkkkkSWWWWSSKKKKKKKKKKKKKKSWSWWWkEEEWWE.',
    '...EWWSKKKkkkkKkSSSSSKKKKKKKKKKKKKKESSSWWkkEEWWWWE',
    '...ESSSEKKKKkkKKKSSSSKKKKKKKKKKKKKEEESSSWWkkWWWWWE',
    '....EEEEEKKKKKKKKSSSKKKKKKKKKKKKEEEEEEESSSSWWSWWE.',
    '...EEKKEEKKKKKKKKESSKKKKKKKKKKKEEEEEE..EEEESSSEE..',
    '..EKKKKKEEKKKKKKKESSKKKKKKKKKE.EEEKKE......EEE....',
    '.EKKKKKEEEEKKKKKKEEEEEEKKKKKEE.EEKKKKEE...........',
    'EKKKKKEE..EEKKKKKE.....EKKKKKE..EEKKKKEE..........',
    'EKKKEE.....EKKKKEKE....EKKKKE.....EKKKKKE.........',
    'EKKKKE.....EEKKKKKKE....EKKkEE.....EKKKKkE........',
    '.EEEEE......EEEEEkEE....EEEEkE......EEEEEE........',
  ],
]

function walking(s: Scene): Pose {
  const frame = WALK[s.legs === 'b' ? 1 : 0] ?? WALK[0] ?? []
  return { w: frame[0]?.length ?? 0, h: frame.length, sprite: [...frame] }
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

// Scale a sprite to another size: nearest neighbour when growing, a majority
// vote over the covered cells when shrinking, so thin lines don't vanish
function scaleSprite(sprite: string[], scale: number): string[] {
  const H = sprite.length
  const W = sprite[0]?.length ?? 0
  const outH = Math.max(1, Math.round(H * scale))
  const outW = Math.max(1, Math.round(W * scale))
  const out: string[] = []
  for (let y = 0; y < outH; y++) {
    let line = ''
    const y0 = Math.floor((y * H) / outH)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / outH))
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor((x * W) / outW)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / outW))
      const votes = new Map<string, number>()
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const ch = sprite[yy]?.[xx] ?? '.'
          votes.set(ch, (votes.get(ch) ?? 0) + 1)
        }
      let best = '.'
      let bestN = -1
      for (const [ch, n] of votes) {
        // Prefer a coloured cell over a transparent one on a tie
        if (n > bestN || (n === bestN && best === '.')) {
          best = ch
          bestN = n
        }
      }
      line += best
    }
    out.push(line)
  }
  return out
}

// Turn a pose into rows of pixels at the given scale
function render(p: Pose, scale: number, withOutline: boolean): string[] {
  if ('sprite' in p) return scaleSprite(p.sprite, scale)
  return paint(p, scale, withOutline)
}

// Paint the shapes onto a grid, scaled, and optionally ring it with outline
function paint(p: { w: number; h: number; shapes: Shape[] }, scale: number, withOutline: boolean): string[] {
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

const TERM_W = 36 // columns the terminal strip may take
const TERM_MAX_ROWS = 34 // pixel rows at most, two per text row: the art at full size

const TERM = {
  E: '#1e2026',
  K: '#3c4452',
  k: '#505866',
  P: '#505866',
  W: '#f0eade',
  S: '#bdb5ad',
  w: '#ffffff',
  N: '#1e2026',
  L: '#9aa0a8',
  B: '#101216',
  R: '#a04a5a',
  G: '#7bc96f',
  g: '#a5dc8f',
}

const SVG = {
  O: '#0b0c10',
  E: '#0b0c10',
  K: '#2b3340',
  k: '#3f4753',
  P: '#3f4753',
  W: '#f0eade',
  S: '#c0b8b0',
  w: '#ffffff',
  N: '#0b0c10',
  L: '#8a9099',
  B: '#07080a',
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
const SIT_HEIGHT = Math.ceil(28 * DESK_SCALE) // rows the sitting pose is drawn at
const TALLEST = SIT_HEIGHT + 2 // with its outline

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

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GRASS[i % GRASS.length]
    const p = pose(s)
    // As many pixel rows as the band allows, up to the cap; the sitting pose
    // sets the scale, so the other poses come out in proportion to it
    const pixelRows = Math.max(8, Math.min(TERM_MAX_ROWS, rows - (rows % 2)))
    const scale = Math.min(pixelRows / SIT_H, TERM_W / p.w, pixelRows / p.h)
    // Draw at full detail, then shrink with colour blending so edges stay smooth
    const native = 'sprite' in p ? p.sprite : paint(p, 2, false)
    const px = smoothResize(mirror(native, s.dir), TERM, Math.round(p.w * scale), Math.round(p.h * scale))
    // Feet on the bottom row, lifted while jumping as far as the band allows
    const lift = Math.min(s.air, pixelRows - px.length)
    return {
      rows: halfBlocksFromPixels(px, pixelRows - px.length - lift, TERM_W, pixelRows),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const p = pose(s)
    // A sprite pose is drawn at whatever pixel size makes it as tall as the
    // sitting pose was; the shape poses keep PX
    const px = 'sprite' in p ? (SIT_HEIGHT * PX) / SIT_H : PX
    const sp = mirror(render(p, 'sprite' in p ? 1 : DESK_SCALE, true), s.dir)
    const w = cols * CELL
    const size = (sp[0]?.length ?? 0) * px
    const groundY = TALLEST * PX + 4 * LIFT + 2 * UNIT
    const h = groundY + 3 * UNIT
    const ox = s.x * CELL
    const oy = groundY - sp.length * px + px - s.air * LIFT

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
      outline(sp, ox, oy, px, '#5d5658') +
      pixels(sp, ox, oy, px, SVG) +
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
