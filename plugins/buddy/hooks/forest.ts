import type { Scene } from '../types'
import { halfBlocks, mirror, pixels, svgOpen } from './shared'
import type { Character } from './shared'

// The forest: not one animal but a little wood across the whole band. Pines
// and round trees stand in front of a dark treeline; a deer runs across now
// and then and stops to graze, a rabbit pops out of a bush, birds sit in the
// trees and flutter up when you send a message or a tool runs, butterflies
// drift. Claude working brings a squirrel and passing birds; Claude done makes
// the flowers bloom and sparkle; an error brings a shower; asleep it's night,
// with a moon, stars, fireflies and the deer curled up under a tree.
//
// It draws the whole band itself: rows are exactly `cols` wide and `offset`
// cancels the engine's x, so it always sits at column 0. Everything is a pure
// function of the scene (tick, spin and the flags); the trees, bushes and
// flowers are laid out once per width from a seeded hash.
//
// Pixels: E outline, b treeline, P pine, p pine shade, L leaves, l leaf shade,
// h leaf light, T trunk, t trunk shade, G grass, g dark grass, R Y W V flowers,
// D deer, d deer ear, C cream (tails, bellies), K eyes, A antlers, H rabbit,
// S bird, O breast, Q squirrel, F firefly, X x stars, M m moon, c cloud, r rain

const H = 18 // pixel rows: things stand on row 16, row 17 is grass
const FLOOR = H - 2

const DAY: Record<string, string> = {
  E: '#18231a', b: '#2b4a3a', P: '#2f8a4e', p: '#236a3c', L: '#5aa646', l: '#3f8236', h: '#86c95a',
  T: '#7a5233', t: '#5a3b24', G: '#4f9a3c', g: '#3b7a2e', R: '#ec7f9c', Y: '#f2d04b', W: '#f4f2e8',
  V: '#b08be6', D: '#b5763f', d: '#8a5530', C: '#f3e6cc', K: '#1e1410', A: '#e0cc9e', H: '#a8998a',
  S: '#4f86d0', O: '#e8894a', Q: '#c8692c', F: '#f6f08a', X: '#f4f4ff', x: '#8a8fb0', M: '#f3eec8',
  m: '#cfc9a2', c: '#6b7480', r: '#8fb4e0',
}
const NIGHT: Record<string, string> = {
  ...DAY,
  E: '#0c120e', b: '#13231f', P: '#1d4a36', p: '#163a2b', L: '#2d5a3c', l: '#22472f', h: '#3c6e4a',
  T: '#3f3024', t: '#2e231b', G: '#25502f', g: '#1c3f25', R: '#8c5a72', Y: '#9a8a4a', W: '#9a9aa8',
  V: '#6c5a90', D: '#7d5638', d: '#5e3f28', C: '#a89c88', A: '#9a8c70', S: '#36588a', O: '#9a6040',
}

// ---------------------------------------------------------------- helpers

// A 32-bit integer hash, for a layout and timings that are the same every frame
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x9e3779b1)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca77)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

export type Grid = string[][]

export function dot(g: Grid, r: number, c: number, p: string) {
  const row = g[r]
  if (row && c >= 0 && c < row.length) row[c] = p
}

export function draw(g: Grid, r: number, c: number, sprite: readonly string[]) {
  sprite.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) if (line[j] !== '.') dot(g, r + i, c + j, line[j] as string)
  })
}

// The sprite with a one-pixel outline grown round it; the row under its feet is left off
export function outlined(rows: string[]): string[] {
  const w = Math.max(...rows.map(r => r.length)) + 2
  const at = (r: number, c: number) => rows[r - 1]?.[c - 1] ?? '.'
  const out: string[] = []
  for (let r = 0; r < rows.length + 1; r++) {
    let line = ''
    for (let c = 0; c < w; c++) {
      const p = at(r, c)
      const near = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)].some(q => q !== '.')
      line += p !== '.' ? p : near ? 'E' : '.'
    }
    out.push(line)
  }
  return out
}

// A tree from its foliage widths (all odd, centred) over a trunk, outlined and shaded
function tree(widths: number[], trunkRows: number, trunkW: number, pine: boolean): string[] {
  const w = Math.max(...widths)
  const rows = widths.map((n, r) => {
    const left = (w - n) / 2
    let line = ''
    for (let c = 0; c < w; c++) {
      if (c < left || c >= left + n) line += '.'
      else if (pine) line += c === left + n - 1 ? 'p' : 'P'
      else {
        // Lit from the top left, shaded to the bottom right
        const u = (c - (w - 1) / 2) / (w / 2) + (r - (widths.length - 1) / 2) / (widths.length / 2)
        line += u > 0.75 ? 'l' : u < -0.95 ? 'h' : 'L'
      }
    }
    return line
  })
  const left = (w - trunkW) / 2
  for (let i = 0; i < trunkRows; i++) rows.push('.'.repeat(left) + (trunkW > 1 ? 'T'.repeat(trunkW - 1) + 't' : 'T') + '.'.repeat(left))
  return outlined(rows)
}

const TREES = [
  tree([1, 3, 5, 3, 5, 7, 5, 7, 9, 7, 9, 11], 2, 1, true), // tall pine, 15 rows
  tree([5, 9, 11, 11, 11, 9, 5], 5, 3, false), // round tree, 13 rows
  tree([1, 3, 5, 3, 5, 7, 5, 7, 9], 2, 1, true), // small pine, 12 rows
  tree([3, 7, 9, 9, 7, 3], 3, 3, false), // small round tree, 10 rows
]
const BUSHES = [tree([5, 9, 11, 11], 0, 0, false), tree([3, 7, 9], 0, 0, false)]

// Facing right. The deer runs in three steps (gathered, flying, landing)
const DEER = {
  tuck: outlined([
    '..........A.A',
    '..........AA.',
    '.........dDD.',
    '..........DKD',
    '..........DDD',
    '.........DD..',
    '.C.DDDDDDDD..',
    '..CDDDDDDDD..',
    '...DCCCCCDD..',
    '....DD..DD...',
    '.....DDDD....',
    '.....K..K....',
  ]),
  leap: outlined([
    '...........A.A',
    '...........AA.',
    '..........dDD.',
    '...........DKD',
    '...........DDD',
    '.CC.......DD..',
    '...DDDDDDDDD..',
    '...DDDDDDDDD..',
    '..DDCCCCCDDD..',
    '.DD.......DD..',
    'D..........DD.',
    '............K.',
  ]),
  land: outlined([
    '..........A.A',
    '..........AA.',
    '.........dDD.',
    '..........DKD',
    '..........DDD',
    '.CC......DD..',
    '...DDDDDDDD..',
    '...DDDDDDDD..',
    '...DCCCCCDD..',
    '..DD.....D.D.',
    '.DD.......D.D',
    '.K........K.K',
  ]),
  stand: outlined([
    '..........A.A',
    '..........AA.',
    '.........dDD.',
    '..........DKD',
    '..........DDD',
    '.........DD..',
    '.C.DDDDDDDD..',
    '..CDDDDDDDD..',
    '...DCCCCCDD..',
    '...D.D...D.D.',
    '...D.D...D.D.',
    '...K.K...K.K.',
  ]),
  graze: outlined([
    '.C............',
    '..CDDDDDDDD...',
    '...DDDDDDDDDA.',
    '...DCCCCCDDDAA',
    '...D.D...D.DKD',
    '...D.D...D.DDD',
    '...K.K...K....',
  ]),
  sleep: outlined([
    '.........A.A.',
    '.........AAd.',
    '...DDDDDDDDK.',
    '.CDDDDDDDDDD.',
    '..DCCCCCCCDD.',
  ]),
}
const RUN = [DEER.tuck, DEER.leap, DEER.land]

const RABBIT = {
  sit: outlined(['....R.R.', '....H.H.', '....HHH.', '....HKHR', '..HHHHH.', '.CHHHHH.', '..HHCHH.']),
  hop: outlined(['.....R.R', '.....H.H', '.....HHH', '.....HKH', '.CHHHHHR', '..HHHH..', '.H...HH.']),
}

const SQUIRREL = [
  outlined(['.QQ......', 'QQQQ..QK', 'QQ...QQQ', '.QQQQQQ.', '..QCCQ..', '..Q..Q..']),
  outlined(['QQ.......', 'QQQ...QK', '.QQ..QQQ', '..QQQQQ.', '..QCCQ..', '.Q....Q.']),
]

const BIRD = ['..SKY', 'SSSO.'] // perched, facing right
const FLAP = [
  ['S...S', '.SOS.'],
  ['.SOS.', 'S...S'],
]
const BUTTERFLY = [
  ['@.@', '.@.'],
  ['.@.', '.@.'],
]
const SPARKLE = ['.W.', 'WYW', '.W.']
const MOON = ['.MMM.', 'MMmMM', 'MMMMm', 'MmMMM', '.MMM.']

// ---------------------------------------------------------------- the layout

type Placed = { x: number; top: number; sprite: string[] }
type Layout = {
  base: Grid
  trees: Placed[]
  bushes: Placed[]
  perches: [number, number][]
  flowers: [number, number, string][]
}

const layouts = new Map<number, Layout>()

function layout(w: number): Layout {
  const cached = layouts.get(w)
  if (cached) return cached
  if (layouts.size > 8) layouts.clear() // widths change on resize; keep a few
  const g: Grid = Array.from({ length: H }, () => Array<string>(w).fill('.'))

  // The treeline behind: soft, flat, overlapping cones
  const tops = Array<number>(w).fill(H)
  for (let x = -4, i = 0; x < w + 6; x += 3 + (hash(i * 31 + 7) % 3), i++) {
    const height = 6 + (hash(i * 17 + 3) % 5)
    for (let c = 0; c < w; c++) tops[c] = Math.min(tops[c] as number, H - height + Math.abs(c - x))
  }
  tops.forEach((top, c) => {
    for (let r = Math.max(0, top); r < H; r++) dot(g, r, c, 'b')
  })

  // Trees in front, one to a slot, nudged a little
  const n = Math.max(3, Math.round(w / 16))
  const slot = w / n
  const trees: Placed[] = []
  let kind = hash(w)
  for (let i = 0; i < n; i++) {
    // A different kind from the last one, so pines and round trees mix
    kind += 1 + (hash(i * 13 + w) % (TREES.length - 1))
    const sprite = TREES[kind % TREES.length] as string[]
    const width = sprite[0]?.length ?? 0
    const centre = Math.floor(slot * (i + 0.5) + ((hash(i * 7 + 1) % 100) / 100 - 0.5) * slot * 0.4)
    trees.push({ x: centre - (width >> 1), top: FLOOR + 1 - sprite.length, sprite })
  }

  // Bushes between some of the trees
  const bushes: Placed[] = []
  for (let i = 0; i < n - 1 || bushes.length === 0; i++) {
    if (i < n - 1 && hash(i * 5 + 11) % 3 === 0) continue
    const sprite = BUSHES[hash(i * 3 + 2) % BUSHES.length] as string[]
    const a = trees[i % n] as Placed
    const b = trees[(i + 1) % n] as Placed
    const centre = i < n - 1 ? Math.floor((a.x + a.sprite[0]!.length / 2 + b.x + b.sprite[0]!.length / 2) / 2) : a.x - 6
    bushes.push({ x: centre - ((sprite[0]?.length ?? 0) >> 1), top: FLOOR + 1 - sprite.length, sprite })
  }
  for (const t of [...trees, ...bushes]) draw(g, t.top, t.x, t.sprite)

  // Birds sit on the shorter trees (the tall pines reach the top of the band)
  const perches: [number, number][] = trees
    .filter(t => t.top >= 4)
    .map(t => [t.x + (t.sprite[0]!.length >> 1) - 2, t.top - 2] as [number, number])
    .filter((_, i) => hash(i + 99) % 4 !== 0)
    .slice(0, w >= 100 ? 3 : 2)

  // Grass along the bottom, in tufts
  for (let c = 0; c < w; c++) {
    dot(g, H - 1, c, 'G')
    if (hash(c * 3 + 5) % 4 === 0) dot(g, H - 2, c, 'g')
  }

  // Flowers, clear of the trunks and bushes
  const flowers: [number, number, string][] = []
  for (let c = 2, next = 2; c < w - 2; c++) {
    const head = FLOOR - 1 - (hash(c) % 2)
    if (c < next || [c - 1, c, c + 1].some(x => [head - 1, head, FLOOR].some(r => !'.bg'.includes(g[r]![x]!)))) continue
    next = c + 5 + (hash(c * 5) % 6)
    flowers.push([c, head, 'RYWV'[hash(c * 7) % 4] as string])
    for (let r = head + 1; r <= FLOOR; r++) dot(g, r, c, 'g')
    dot(g, head, c, flowers[flowers.length - 1]![2])
  }

  const made = { base: g, trees, bushes, perches, flowers }
  layouts.set(w, made)
  return made
}

// ---------------------------------------------------------------- the animals

// Where the deer is this tick, or null: one crossing a minute or so, sometimes stopping to graze
function deer(tick: number, w: number): { x: number; top: number; sprite: string[] } | null {
  const period = 600 + w
  const k = Math.floor(tick / period)
  const hk = hash(k + 1)
  const u = (tick % period) - (80 + (hk % 240))
  if (u < 0) return null
  const dir = hk & 256 ? 1 : -1
  const W = DEER.stand[0]!.length
  const start = dir === 1 ? -W : w
  const grazes = (hk >>> 9) % 3 !== 0
  const stop = grazes ? Math.abs(Math.floor(w * (0.25 + ((hk >>> 12) % 50) / 100)) - start) : Infinity
  const GRAZE = 70
  let along: number
  let sprite: string[] | null = null
  let lift = 0
  if (u < stop) along = u
  else if (u < stop + GRAZE) {
    along = stop
    const v = u - stop
    sprite = v < 8 || (v >= 34 && v < 44) || v >= 62 ? DEER.stand : DEER.graze
  } else along = u - GRAZE
  if (along > w + W) return null
  if (!sprite) {
    const step = Math.floor(along / 2) % 3
    sprite = RUN[step] as string[]
    lift = step === 1 ? 1 : 0
  }
  return { x: start + dir * along, top: FLOOR + 1 - sprite.length - lift, sprite: mirror(sprite, dir as 1 | -1) }
}

// The rabbit's outing from one of the bushes: peek, hop out, sit, hop back
function rabbit(tick: number, l: Layout): { x: number; top: number; sprite: string[]; bush: Placed } | null {
  const k = Math.floor(tick / 450)
  const hk = hash(k * 3 + 77)
  const t = (tick % 450) - (60 + (hk % 200))
  if (t < 0 || t >= 140 || l.bushes.length === 0) return null
  const bush = l.bushes[hk % l.bushes.length] as Placed
  const w = l.base[0]!.length
  const centre = bush.x + (bush.sprite[0]!.length >> 1)
  const out: 1 | -1 = centre < 20 ? 1 : centre > w - 20 ? -1 : hk & 512 ? 1 : -1
  let along = 0
  let hopping = false
  let lift = 0
  let facing = out
  const hops = (v: number) => {
    along = Math.floor(v / 6) * 3 + Math.min(3, v % 6)
    hopping = v % 6 < 4
    lift = v % 6 === 1 || v % 6 === 2 ? 1 : 0
  }
  if (t >= 20 && t < 44) hops(t - 20)
  else if (t >= 44 && t < 100) {
    along = 12
    if (t >= 66 && t < 78) facing = out === 1 ? -1 : 1 // looks back over its shoulder
  } else if (t >= 100 && t < 124) {
    hops(t - 100)
    along = 12 - along
    facing = out === 1 ? -1 : 1
  }
  const sprite = mirror(hopping ? RABBIT.hop : RABBIT.sit, facing)
  return { x: centre - (sprite[0]!.length >> 1) + out * along, top: FLOOR + 1 - sprite.length - lift, sprite, bush }
}

// How high the birds are, ticks into a jump: a tool call's four-tick hop ends
// low, a message's nine ticks bob up twice and settle
const LIFT = [0, 2, 3, 3, 2, 3, 4, 3, 2, 1]
const flutter = (spin: number) => LIFT[((spin - 1) % 9) + 1] as number

// ---------------------------------------------------------------- the picture

function picture(s: Scene, w: number): string[] {
  const l = layout(w)
  const g = l.base.map(r => r.slice())
  const t = s.tick
  const night = s.isAsleep

  if (night) {
    // Stars in the empty sky, a few twinkling, and the moon
    const moon = Math.floor(w * 0.72)
    draw(g, 1, moon, MOON)
    for (let i = 0; i < w / 6; i++) {
      const c = hash(i * 41 + 3) % w
      const r = hash(i * 43 + 5) % 7
      if (g[r]?.[c] === '.' && Math.abs(c - moon - 2) > 4) dot(g, r, c, (Math.floor(t / 8) + i) % 5 === 0 ? 'x' : 'X')
    }
  }

  if (s.isUpset) {
    // A grey cloud along the top
    for (let c = 0; c < w; c++) {
      const depth = 1 + (Math.sin(c / 4) + Math.sin(c / 2.3 + 1) > 0.4 ? 1 : 0) + (Math.sin(c / 4) > 0.6 ? 1 : 0)
      for (let r = 0; r < depth; r++) dot(g, r, c, 'c')
    }
  }

  // The deer: crossing by day, curled up under a round tree at night
  if (night) {
    const den = l.trees.find(tr => tr.sprite === TREES[1] || tr.sprite === TREES[3]) ?? l.trees[0]
    if (den) draw(g, FLOOR + 1 - DEER.sleep.length, den.x + den.sprite[0]!.length - 6, DEER.sleep)
  } else {
    const d = deer(t, w)
    if (d) draw(g, d.top, d.x, d.sprite)
  }

  // The rabbit pops out from behind its bush
  if (!night) {
    const r = rabbit(t, l)
    if (r) {
      draw(g, r.top, r.x, r.sprite)
      draw(g, r.bush.top, r.bush.x, r.bush.sprite)
    }
  }

  // Claude working: a squirrel scurries along the ground, and birds fly over
  if (s.isWorking) {
    const span = Math.max(1, w - 12)
    const p = t % (2 * span)
    const dir: 1 | -1 = p < span ? 1 : -1
    const sprite = mirror(SQUIRREL[Math.floor(t / 2) % 2] as string[], dir)
    draw(g, FLOOR + 1 - sprite.length, 1 + (p < span ? p : 2 * span - p), sprite)
    const pass = Math.floor(t / (w + 40))
    const x = ((t % (w + 40)) * 3) / 2 - 6
    const row = 1 + (hash(pass) % 4) + (Math.floor(t / 4) % 2)
    draw(g, row, Math.floor(x), FLAP[Math.floor(t / 2) % 2] as string[])
    draw(g, row + 2, Math.floor(x) - 7, FLAP[Math.floor(t / 2 + 1) % 2] as string[])
  }

  // Birds in the trees fly up when something happens
  l.perches.forEach(([x, r], i) => {
    if (s.spin > 0) {
      const lift = Math.min(r, flutter(s.spin) + (i % 2))
      draw(g, r - lift, x + Math.round(2 * Math.sin((t + i * 5) / 2)), FLAP[(Math.floor(t / 2) + i) % 2] as string[])
    } else draw(g, r, x, i % 2 ? mirror(BIRD, -1) : BIRD)
  })

  // Butterflies by day (not in the rain), fireflies by night
  if (night) {
    for (let i = 0; i < w / 10; i++) {
      const h = hash(i * 19 + 4)
      if ((t + h) % 40 >= 22) continue
      const c = (h % w) + Math.round(3 * Math.sin(t / 23 + i))
      const r = 6 + ((h >>> 8) % 9) + Math.round(1.5 * Math.sin(t / 31 + i * 2))
      dot(g, r, c, 'F')
    }
  } else if (!s.isUpset) {
    for (let i = 0; i < (w >= 100 ? 3 : 2); i++) {
      const c = Math.round(((i + 0.5) * w) / 3 + 9 * Math.sin(t / 47 + i * 2) + 4 * Math.sin(t / 13 + i))
      const r = 8 + Math.round(2 * Math.sin(t / 19 + i * 3))
      const colour = 'RYV'[i] as string
      draw(g, r, c, (BUTTERFLY[Math.floor(t / 3) % 2] as string[]).map(line => line.replace(/@/g, colour)))
    }
  }

  // Claude done: the flowers open up and sparkle
  if (s.isHappy) {
    l.flowers.forEach(([c, r, p], i) => {
      const heart = p === 'Y' ? 'O' : 'Y'
      draw(g, r - 1, c - 1, ['.' + p + '.', p + heart + p, '.' + p + '.'])
      if ((t + i) % 6 < 3) draw(g, r - 5 - (i % 3), c - 1 + ((i % 2) * 2 - 1) * 2, SPARKLE)
    })
  }

  // Something went wrong: a shower
  if (s.isUpset) {
    for (let c = 0; c < w; c++) {
      const h = hash(c * 11 + 9)
      if (h % 3) continue
      const r = (((h >>> 4) % 20) + t * 2) % 20
      if (r >= 2 && r < H - 1) {
        dot(g, r, c, 'r')
        dot(g, r + 1, c, 'r')
      }
    }
  }

  return g.map(r => r.join(''))
}

// ---------------------------------------------------------------- the character

const PX = 6
const CELL = 8
const GROUND = ",'.'`,.''.,`'."

export const forest: Character = {
  width: 0,
  canMunch: false,
  rolls: true,
  stride: 0,
  pace: 1,
  snackLane: 0,
  chases: false,

  terminal(s, cols, rows) {
    // At most the band's height, cut from the top (never squeezed)
    const fit = Math.min(H, rows - (rows % 2))
    const sp = picture(s, cols).slice(H - fit)
    const cells = halfBlocks(sp, 0, cols, fit, s.isAsleep ? NIGHT : DAY)
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[i % GROUND.length]
    return { rows: cells, ground, groundColor: 'green', offset: s.x }
  },

  svg(s, cols) {
    const w = cols * CELL
    const art = Math.floor(w / PX)
    const h = H * PX
    const sky = s.isAsleep ? `<rect x="0" y="0" width="${w}" height="${h}" fill="#141a2e"/>` : ''
    return svgOpen(w, h) + sky + pixels(picture(s, art), 0, 0, PX, s.isAsleep ? NIGHT : DAY) + '</svg>'
  },

  lines: {
    hi: '',
    jump: '',
    done: [''],
    abort: '',
    error: '',
    snack: [''],
    react: () => '',
  },
}
