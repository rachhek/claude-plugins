import type { Scene } from '../types'
import { halfBlocks, mirror, pixels, svgOpen } from './shared'
import type { Character } from './shared'

// The mountains: a high range across the whole band. Pale far peaks stand
// behind big snow-capped ones (lit on the left, in shadow on the right), a
// waterfall drops down one of them, and an alpine meadow runs along the
// bottom with boulders, pines, flowers and a cairn hung with prayer flags.
// Clouds drift through the peaks and mist settles in the valley now and then.
// An eagle circles overhead, marmots pop out of their burrows to look round,
// a pika sits by a rock and a little herd of ibex crosses the meadow. A
// message or a tool call makes the marmots whistle and dive and the birds lift
// off; Claude working brings the herd out to graze and the eagle swoops;
// Claude done turns the snow pink in alpenglow under a rainbow; an error
// brings a snow squall; asleep it's night, with the moon on the snow, the
// milky way and the herd lying down.
//
// Like the forest it draws the whole band itself: rows are exactly `cols`
// wide and `offset` cancels the engine's x. Everything is a pure function of
// the scene; the range is laid out once per width from a seeded hash.
//
// Pixels: E outline, f F far rock and snow, R r near rock lit and shaded,
// S s snow lit and shaded, A a waterfall, J back hill, G g h meadow grass,
// P p pine, T trunk, B b boulder, Y V Q W flowers, d dirt, K dark (eyes,
// holes, hooves), D ibex, i ibex shade, C cream, H horns, M m marmot, k pika,
// N n eagle, O q small bird, c o cloud, u mist, z Z storm, x snowflake,
// X j stars, v milky way, L l moon, 1-5 prayer flags, 6-9 rainbow

const H = 20 // pixel rows: things stand on row 18 (the herd walks a row further back), row 19 is grass
const FLOOR = H - 2

const DAY: Record<string, string> = {
  E: '#1b1f27', f: '#7f8ba3', F: '#c3cddd', R: '#9a958c', r: '#5f6070', S: '#f4f6fa', s: '#b4c2d8',
  A: '#6fb4e6', a: '#dff2ff', J: '#3b6b3a', G: '#58a043', g: '#41812f', h: '#7cbc52', P: '#2f7a48',
  p: '#235e38', T: '#6a4a2e', B: '#a39e94', b: '#706d68', Y: '#f2d04b', V: '#b08be6', Q: '#ec7f9c',
  W: '#f6f6f2', d: '#7a5a3a', K: '#1a1410', D: '#b08654', i: '#7e5a36', C: '#efe2c4', H: '#e0d2ae',
  M: '#a8743f', m: '#7a5230', k: '#b39572', N: '#6e4524', n: '#a06c3a', O: '#4f86d0', q: '#e8894a',
  c: '#e9edf3', o: '#bcc5d2', u: '#c9d2de', z: '#646b7c', Z: '#4a5060', x: '#f4f8ff',
  '1': '#4a7fd6', '2': '#f4f2e8', '3': '#e0524a', '4': '#4fae5a', '5': '#f2d04b',
  '6': '#e8584e', '7': '#f2d04b', '8': '#5cc06a', '9': '#5a8de0',
}
// Alpenglow: the snow and the lit rock catch the sunset
const GLOW: Record<string, string> = {
  ...DAY, S: '#ffd2c2', s: '#f0a294', F: '#f2bfb6', R: '#b39283', f: '#9a8aa6', c: '#ffe0d0', o: '#f0b8a8',
}
const NIGHT: Record<string, string> = {
  ...DAY,
  E: '#0b0e18', f: '#2a3150', F: '#4a5678', R: '#3a4260', r: '#262c44', S: '#a8b8da', s: '#6a7aa0',
  A: '#3a5a8a', a: '#8aa8d0', J: '#15301f', G: '#22472a', g: '#1a3a22', h: '#2e5a35', P: '#173a2a',
  p: '#112c20', T: '#2e2318', B: '#4c4f5c', b: '#32343e', Y: '#8a7a40', V: '#5c4f82', Q: '#7c5068',
  D: '#6e5638', i: '#4e3c26', C: '#8a8474', H: '#8a8270', d: '#3a2c1e',
  '1': '#2c4a7c', '2': '#8a8a90', '3': '#7c3a36', '4': '#2c5a34', '5': '#8a7a40',
  X: '#f4f4ff', j: '#8a8fb0', v: '#4a5380', L: '#f3eec8', l: '#cfc9a2',
}

// ---------------------------------------------------------------- helpers

// A 32-bit integer hash, for a layout and timings that are the same every frame
function hash(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x9e3779b1)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca77)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

type Grid = string[][]

function dot(g: Grid, r: number, c: number, p: string) {
  const row = g[r]
  if (row && c >= 0 && c < row.length) row[c] = p
}

function draw(g: Grid, r: number, c: number, sprite: readonly string[]) {
  sprite.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) if (line[j] !== '.') dot(g, r + i, c + j, line[j] as string)
  })
}

// Depths, back to front: what's at each cell decides what can be drawn there
const SKY = 0
const FAR = 1
const NEAR = 2
const HILL = 3
const FRONT = 4

// Draw only over cells further back than `depth`, so things pass behind the peaks
function behind(l: Layout, g: Grid, r: number, c: number, p: string, depth: number) {
  if (r >= 0 && r < H && c >= 0 && c < l.w && (l.depth[r * l.w + c] as number) < depth) dot(g, r, c, p)
}

// The sprite with a one-pixel outline grown round it; the row under its feet is left off
function outlined(rows: string[]): string[] {
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

// ---------------------------------------------------------------- the sprites

// Facing right. The ibex walks in two steps (legs apart, legs together)
const IBEX = {
  a: outlined([
    'HHH.......',
    '..HHH.....',
    '....HHDD..',
    '.....DDDKD',
    '.....DDDDD',
    '.DDDDDDDD.',
    'DDDDDDDD..',
    '.DCCCCDD..',
    '.D.i..D.i.',
    '.K.K..K.K.',
  ]),
  b: outlined([
    'HHH.......',
    '..HHH.....',
    '....HHDD..',
    '.....DDDKD',
    '.....DDDDD',
    '.DDDDDDDD.',
    'DDDDDDDD..',
    '.DCCCCDD..',
    '..Di...Di.',
    '..KK...KK.',
  ]),
  graze: outlined([
    '.HHH.......',
    '...HHH.....',
    '.DDDDDHHD..',
    'DDDDDDDDDD.',
    '.DCCCCDDDKD',
    '.D.i..D.iDD',
    '.K.K..K.K..',
  ]),
  rest: outlined([
    '...........',
    '..HHH......',
    '.....HHHDD.',
    '.......DDKD',
    '.DDDDDDDDDD',
    'DDDDDDDDi..',
    'DCCCCCDD...',
  ]),
}
// The kid: no horns to speak of
const KID = {
  a: outlined(['.....HD.', '.....DKD', '.DDDDDD.', 'DDCCCDD.', '.D.i.D.i', '.K.K.K.K']),
  b: outlined(['.....HD.', '.....DKD', '.DDDDDD.', 'DDCCCDD.', '..Di..Di', '..KK..KK']),
  graze: outlined(['.DDDDD..', 'DDCCCDH.', '.D.i.DDD', '.K.K..KD']),
  rest: outlined(['....HD.', '....DKD', '.DDDDDD', 'DCCCDD.']),
}

// The marmot sitting up on its burrow, facing right; it comes out head first
const MARMOT = outlined(['.MM.', 'MMKM', 'MMMM', '.MM.', 'MCCM', 'MCCM', 'MMMm'])
const MARMOT_WHISTLE = outlined(['.MM.', 'MMKM', 'MMMK', '.MM.', 'MCCM', 'MCCM', 'MMMm'])
const BURROW = ['.d...d.', 'ddKKKdd']

const PIKA = [
  outlined(['...kk.', '.kkkkk', 'kkkkKk', 'kkkkkk', '.k..k.']),
  outlined(['..kk..', '.kkkkk', 'kkkkKk', 'kkkkkk', '.k..k.']), // an ear twitch
]

// The eagle from below: gliding, and wings down in a beat
const EAGLE = [
  ['NN.......NN', '.NNn...nNN.', '...nNWNn...', '....NNN....'],
  ['...........', '..nNNWNNn..', '.NN.NNN.NN.', 'N.........N'],
]

const BIRD = ['..OKY', 'OOOq.'] // perched, facing right
const FLAP = [
  ['O...O', '.OqO.'],
  ['.OqO.', 'O...O'],
]
const BUTTERFLY = [
  ['@.@', '.@.'],
  ['.@.', '.@.'],
]
const MOON = ['.LLL.', 'LLlLL', 'LLLLl', 'LlLLL', '.LLL.']

const BOULDERS = [
  outlined(['.BBBB.', 'BBBBBb', 'BBBBbb']),
  outlined(['.BBB..', 'BBBBb.', 'BBBBbb', 'BBBbbb']),
  outlined(['.BB.', 'BBBb']),
]
const PINES = [
  outlined(['..P..', '..P..', '.PPp.', '..P..', '.PPp.', 'PPPPp', '.PPp.', 'PPPPp', '..T..']),
  outlined(['..P..', '.PPp.', '..P..', '.PPp.', 'PPPPp', '..T..']),
]
const CAIRN = outlined(['.B.', 'BBb', '.Bb', 'BBBb', 'BBBbb'])
const CLOUDS = [
  ['....cc....', '..cccccc..', 'cccccccccc', '.oooooooo.'],
  ['...cc.......', '.cccccc.ccc.', 'cccccccccccc', '.oooooooooo.'],
  ['.ccc..', 'cccccc', '.oooo.'],
]

// ---------------------------------------------------------------- the layout

type Placed = { x: number; top: number; sprite: string[] }
type Peak = { x: number; top: number; kl: number; kr: number; slant: number; snow: number }
type Layout = {
  w: number
  base: Grid
  depth: Uint8Array
  front: Placed[] // boulders, pines and the cairn, drawn again over the herd
  burrows: number[] // left columns
  perches: [number, number][]
  flowers: [number, number, string][]
  pika: number | null // column the pika sits at, by its rock
  peaks: Peak[]
  fall: { x: number; top: number; bottom: number } | null
  flags: [number, number, string][]
  moon: number // a column with open sky between the peaks, for the moon
  den: number // the middle of the widest open stretch, where the herd sleeps
}

const layouts = new Map<number, Layout>()

// Row of a peak's surface at column c
function surface(p: Peak, c: number): number {
  const dx = c - p.x
  return p.top + Math.ceil(Math.abs(dx) / (dx < 0 ? p.kl : p.kr))
}

// A rolling line of hills: a top row per column, with no one-column bumps
function hills(w: number, base: number, seed: number, amp: number): number[] {
  const a = (hash(seed) % 100) / 16
  const b = (hash(seed + 1) % 100) / 16
  const tops = Array.from({ length: w }, (_, c) => base + Math.round(amp * (Math.sin(c / 7 + a) * 0.7 + Math.sin(c / 15 + b) * 0.6)))
  for (let c = 1; c < w - 1; c++) if (tops[c - 1] === tops[c + 1] && tops[c] !== tops[c - 1]) tops[c] = tops[c - 1] as number
  return tops
}

function layout(w: number): Layout {
  const cached = layouts.get(w)
  if (cached) return cached
  if (layouts.size > 8) layouts.clear() // widths change on resize; keep a few
  const g: Grid = Array.from({ length: H }, () => Array<string>(w).fill('.'))
  const depth = new Uint8Array(H * w)
  const set = (r: number, c: number, p: string, d: number) => {
    if (r < 0 || r >= H || c < 0 || c >= w) return
    dot(g, r, c, p)
    depth[r * w + c] = d
  }

  // The far range: pale, low, gently sloped, with a little snow on each top
  const far: Peak[] = []
  for (let x = -6, i = 0; x < w + 10; x += 8 + (hash(i * 31 + 7) % 8), i++)
    far.push({ x, top: 3 + (hash(i * 17 + 3) % 4), kl: 1.5, kr: 1.5, slant: 0, snow: 2 })
  for (let c = 0; c < w; c++) {
    let best = far[0] as Peak
    for (const p of far) if (surface(p, c) < surface(best, c)) best = p
    for (let r = Math.max(0, surface(best, c)); r < H; r++) set(r, c, r - best.top < best.snow ? 'F' : 'f', FAR)
  }

  // The near range: big peaks, one to a slot, steep on one side
  const n = Math.max(2, Math.round(w / 28))
  const slot = w / n
  const peaks: Peak[] = []
  for (let i = 0; i < n; i++) {
    const h = hash(i * 13 + w * 7 + 5)
    const steepLeft = h & 1
    peaks.push({
      x: Math.floor(slot * (i + 0.5) + (((h >>> 4) % 100) / 100 - 0.5) * slot * 0.4),
      top: 1 + ((h >>> 12) % 2),
      kl: steepLeft ? 1 : 1.5,
      kr: steepLeft ? 1.5 : 1,
      slant: [0, 1 / 3, -1 / 3][(h >>> 16) % 3] as number,
      snow: 3 + ((h >>> 20) % 2),
    })
  }
  const owner: (Peak | null)[] = Array.from({ length: w }, () => null)
  const nearTop = Array<number>(w).fill(H)
  for (let c = 0; c < w; c++)
    for (const p of peaks)
      if (surface(p, c) < (nearTop[c] as number)) {
        nearTop[c] = surface(p, c)
        owner[c] = p
      }
  for (let c = 0; c < w; c++) {
    const p = owner[c]
    if (!p) continue
    for (let r = Math.max(0, nearTop[c] as number); r < H; r++) {
      const dr = r - p.top
      const ridge = p.x + Math.round(dr * p.slant)
      const lit = c <= ridge
      // The snowline dips down the ridge, in steps
      const away = Math.abs(c - ridge)
      const snow = dr < p.snow + (away <= 1 ? 2 : away <= 3 ? 1 : 0)
      set(r, c, snow ? (lit ? 'S' : 's') : lit ? 'R' : 'r', NEAR)
    }
  }
  // An outline along the near range's skyline
  for (let c = 0; c < w; c++) {
    const top = nearTop[c] as number
    const edge = Math.min(top, nearTop[c - 1] ?? H, nearTop[c + 1] ?? H)
    for (let r = Math.max(0, edge - 1); r < top && r < H; r++) {
      const left = nearTop[c - 1] ?? H
      const right = nearTop[c + 1] ?? H
      if (r === top - 1 || r >= left || r >= right) set(r, c, 'E', NEAR)
    }
  }

  // The moon rises in the deepest notch of the skyline's right half
  let moon = Math.max(0, w - 7)
  for (let c = w >> 1, best = -1; c + 5 <= w; c++) {
    const low = Math.min(...nearTop.slice(c, c + 5))
    if (low > best) {
      best = low
      moon = c
    }
  }

  // A waterfall down the shaded face of one peak
  const fp = peaks[hash(w * 3 + 1) % peaks.length] as Peak
  const fx = fp.x + 3
  let fall: Layout['fall'] = null

  // The back hills, then the meadow in front
  const back = hills(w, 14, w + 11, 1)
  const meadow = hills(w, 16, w + 23, 0.8)
  for (let c = 0; c < w; c++) {
    for (let r = back[c] as number; r < H; r++) set(r, c, 'J', HILL)
    for (let r = meadow[c] as number; r < H; r++) set(r, c, r === meadow[c] ? 'h' : 'G', FRONT)
    if (hash(c * 3 + 5) % 4 === 0) set(H - 2, c, 'g', FRONT)
    if (hash(c * 7 + 2) % 5 === 0 && (meadow[c] as number) + 2 < H - 2) set((meadow[c] as number) + 2, c, 'g', FRONT)
    set(H - 1, c, 'G', FRONT)
  }
  if (fx >= 1 && fx < w - 2 && owner[fx] === fp && owner[fx + 1] === fp) {
    const top = fp.top + fp.snow + 2
    const bottom = Math.min(back[fx] as number, back[fx + 1] as number) - 1
    if (bottom - top >= 3) fall = { x: fx, top, bottom }
  }

  // Little pines along the back hills
  for (let c = 3; c < w - 3; c++) {
    if (hash(c * 11 + w) % 9 !== 0) continue
    const top = back[c] as number
    for (const [dc, rows] of [[0, 3], [2, 2]] as const) {
      const x = c + dc
      if (x >= w) continue
      for (let k = 1; k <= rows; k++) set(top - k, x, 'p', HILL)
      if (rows === 3) {
        set(top - 1, x - 1, 'p', HILL)
        set(top - 1, x + 1, 'p', HILL)
      }
    }
    c += 6
  }

  // Things standing in the meadow: boulders, pines and a cairn with prayer flags, in slots
  const front: Placed[] = []
  const slots = Math.max(2, Math.round(w / 20))
  const kinds: string[] = []
  for (let i = 0; i < slots; i++) kinds.push(i === Math.floor(slots / 2) ? 'cairn' : hash(i * 5 + w) % 3 === 0 ? 'pine' : 'boulder')
  const flags: [number, number, string][] = []
  kinds.forEach((kind, i) => {
    const sprite =
      kind === 'cairn' ? CAIRN : kind === 'pine' ? (PINES[hash(i + w) % 2] as string[]) : (BOULDERS[hash(i * 3 + w) % 3] as string[])
    const sw = sprite[0]!.length
    const x = Math.floor((w / slots) * (i + 0.5) + ((hash(i * 9 + 4) % 100) / 100 - 0.5) * (w / slots) * 0.5) - (sw >> 1)
    front.push({ x, top: FLOOR + 1 - sprite.length, sprite })
    if (kind === 'cairn') {
      // A string of flags from the cairn's top to a pole, sagging in the middle
      const from = x + 1
      const len = 11
      const to = from + len
      for (let k = 0; k <= len; k++) {
        const r = FLOOR - 6 + Math.round(1.5 * Math.sin((k / len) * Math.PI))
        flags.push([to - k, r, 'b'])
        if (k > 0 && k < len && k % 2 === 0) flags.push([to - k, r + 1, String(((k / 2 - 1) % 5) + 1)])
      }
      for (let r = FLOOR - 6; r <= FLOOR; r++) flags.push([to, r, 'T'])
    }
  })
  for (const t of front) draw(g, t.top, t.x, t.sprite)

  // The pika's rock: the first boulder, if there is one
  const rock = front.find(t => t.sprite === BOULDERS[0] || t.sprite === BOULDERS[1])
  const pika = rock ? rock.x + rock.sprite[0]!.length - 1 : null

  // Burrows in the clear stretches of meadow
  const burrows: number[] = []
  const clear = (x: number, span: number) =>
    x >= 1 && x + span < w - 1 && (pika === null || x > pika + 7 || x + span < pika) && front.every(t => x + span < t.x - 1 || x > t.x + t.sprite[0]!.length) && flags.every(([c]) => c < x || c > x + span)
  for (let k = 0, x0 = hash(w * 5) % w; k < w && burrows.length < (w >= 100 ? 3 : 2); k++) {
    const x = (x0 + k) % w
    if (!clear(x - 1, 9) || burrows.some(b => Math.abs(b - x) < 14)) continue
    burrows.push(x)
    draw(g, FLOOR - 1, x, BURROW)
  }

  // The middle of the widest open stretch of meadow, where the herd sleeps
  const taken = front.map(t => [t.x, t.x + t.sprite[0]!.length])
  if (flags.length) taken.push([Math.min(...flags.map(f => f[0])), Math.max(...flags.map(f => f[0])) + 1])
  let den = w >> 1
  let widest = 0
  let from = 0
  for (const [x, end] of [...taken, [w, w]].sort((a, b) => a[0]! - b[0]!) as [number, number][]) {
    if (x - from > widest) {
      widest = x - from
      den = (from + x) >> 1
    }
    from = Math.max(from, end)
  }

  // Birds sit on the boulders and the cairn
  const perches: [number, number][] = front
    .filter(t => t.sprite !== PINES[0] && t.sprite !== PINES[1])
    .map(t => [t.x + (t.sprite[0]!.length >> 1) - 2, t.top - 1] as [number, number])
    .filter((_, i) => hash(i + 99) % 3 !== 0)
    .slice(0, w >= 100 ? 3 : 2)

  // Flowers in the meadow, clear of everything else
  const flowers: [number, number, string][] = []
  for (let c = 2, next = 2; c < w - 2; c++) {
    const head = FLOOR - 1 - (hash(c) % 2)
    if (c < next || [c - 1, c, c + 1].some(x => [head - 1, head, FLOOR].some(r => !'Ggh'.includes(g[r]![x]!)))) continue
    next = c + 4 + (hash(c * 5) % 6)
    const p = 'YVQW'[hash(c * 7) % 4] as string
    flowers.push([c, head, p])
    for (let r = head + 1; r <= FLOOR; r++) dot(g, r, c, 'g')
    dot(g, head, c, p)
  }

  const made: Layout = { w, base: g, depth, front, burrows, perches, flowers, pika, peaks, fall, flags, moon, den }
  layouts.set(w, made)
  return made
}

// ---------------------------------------------------------------- the animals

// The herd: two ibex and a kid crossing the meadow now and then, stopping to
// graze; while Claude works they're always out
function herd(tick: number, w: number, working: boolean): { x: number; top: number; sprite: string[] }[] {
  const GRAZE = 90
  const len = 40
  const period = working ? (w + len) * 2 + GRAZE : 900 + w * 2
  const k = Math.floor(tick / period)
  const hk = hash(k * 5 + 3)
  const u = (tick % period) - (working ? 0 : 100 + (hk % 200))
  if (u < 0) return []
  const dir: 1 | -1 = hk & 64 ? 1 : -1
  const stop = Math.floor(w * (0.3 + ((hk >>> 8) % 40) / 100))
  let along: number
  let grazing = false
  const walked = Math.floor(u / 2)
  if (walked < stop) along = walked
  else if (u < stop * 2 + GRAZE) {
    along = stop
    grazing = true
  } else along = Math.floor((u - GRAZE) / 2)
  if (along > w + len) return []
  const out: { x: number; top: number; sprite: string[] }[] = []
  ;[0, 16, 30].forEach((gap, i) => {
    const kid = i === 2
    const set = kid ? KID : IBEX
    const step = Math.floor((along + i) / 2) % 2
    // Each one looks up from grazing now and then
    const head = grazing && (Math.floor((u + i * 23) / 30) % 4 !== 0)
    const sprite = head ? set.graze : step ? set.b : set.a
    const lead = dir === 1 ? along : w - along
    const x = lead - dir * gap - (dir === 1 ? sprite[0]!.length : 0)
    out.push({ x, top: FLOOR - sprite.length, sprite: mirror(sprite, dir) })
  })
  return out
}

// How far a marmot is out of its burrow (rows showing) and which way it looks
function marmot(tick: number, i: number, spin: number): { up: number; facing: 1 | -1; whistle: boolean } {
  const full = MARMOT.length
  // A message or a tool call: up with a whistle, then a dive back down
  if (spin > 0) return spin <= 2 ? { up: full, facing: i % 2 ? -1 : 1, whistle: true } : { up: Math.max(0, full - (spin - 2) * 4), facing: 1, whistle: false }
  const period = 260 + (hash(i * 7 + 1) % 160)
  const t = (tick + hash(i * 3 + 9)) % period
  const OUT = 90
  if (t >= OUT) return { up: 0, facing: 1, whistle: false }
  const up = Math.min(full, t < full ? t + 1 : OUT - t <= full ? OUT - t : full)
  const facing: 1 | -1 = Math.floor(t / 18) % 2 ? -1 : 1
  return { up, facing, whistle: false }
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
    // The milky way across the sky behind the peaks, stars and the moon
    for (let c = 0; c < w; c++) {
      const mid = 1 + ((c * 7) / Math.max(1, w)) + Math.sin(c / 11)
      for (let r = 0; r < 9; r++) {
        const d = Math.abs(r - mid)
        // A dense drift of faint stars, thickest along its middle
        const h = hash(c * 31 + r * 7 + 1) % 100
        if (h < (d < 0.8 ? 45 : d < 1.8 ? 14 : 0)) behind(l, g, r, c, h % 4 ? 'v' : 'j', FAR)
      }
    }
    for (let i = 0; i < w / 4; i++) {
      const c = hash(i * 41 + 3) % w
      const r = hash(i * 43 + 5) % 9
      behind(l, g, r, c, (Math.floor(t / 8) + i) % 5 === 0 ? 'j' : 'X', FAR)
    }
    MOON.forEach((line, i) => [...line].forEach((p, j) => p !== '.' && behind(l, g, i, l.moon + j, p, NEAR)))
  }

  // Claude done: a rainbow over the valley, behind the peaks
  if (s.isHappy && !night && l.peaks.length > 1) {
    const a = l.peaks[0] as Peak
    const b = l.peaks[1] as Peak
    const cx = Math.floor((a.x + b.x) / 2)
    for (let r = 0; r < H; r++)
      for (let c = cx - 12; c <= cx + 12; c++) {
        const band = Math.floor(11.5 - Math.hypot(c - cx, r - 14))
        if (band >= 0 && band < 4) behind(l, g, r, c, '6789'[band] as string, HILL)
      }
  }

  // Clouds drifting along: high ones behind the peaks, a low one in front of them
  if (!night) {
    const n = Math.max(2, Math.round(w / 40))
    for (let i = 0; i < n + 1; i++) {
      const cloud = CLOUDS[hash(i * 3 + 1) % CLOUDS.length] as string[]
      const cw = cloud[0]!.length
      const low = i === n
      const speed = low ? 14 : 9 + (i % 3) * 3
      const span = w + cw
      const x = (((hash(i * 17 + 2) % span) + Math.floor(t / speed)) % span) - cw
      const r = low ? 8 + (hash(i) % 2) : 1 + (hash(i * 5 + 7) % 5)
      cloud.forEach((line, k) => [...line].forEach((p, j) => p !== '.' && behind(l, g, r + k, x + j, p, low ? HILL : NEAR)))
    }
  }

  // The waterfall, its streaks running down
  if (l.fall) {
    const { x, top, bottom } = l.fall
    for (let r = top; r <= bottom; r++) {
      dot(g, r, x, (r - t) % 4 === 0 ? 'a' : 'A')
      dot(g, r, x + 1, (r - t + 2) % 4 === 0 ? 'a' : 'A')
    }
    dot(g, bottom, x - 1, 'a')
    dot(g, bottom, x + 2, 'a')
  }

  // Mist in the valley now and then, coming and going
  const mist = Math.sin(t / 300)
  if (!night && mist > 0.3) {
    const reach = (mist - 0.3) / 0.7
    for (let i = 0; i < Math.max(2, w / 30); i++) {
      const cx = ((hash(i * 13 + 5) % w) + Math.floor(t / 20)) % (w + 20) - 10
      const half = Math.round(reach * (6 + (hash(i * 7) % 6)))
      const r = 13 - (i % 2)
      for (let c = cx - half; c <= cx + half; c++) behind(l, g, r, c, 'u', HILL)
      for (let c = cx - half + 4; c <= cx + half - 4; c++) behind(l, g, r - 1, c, 'u', HILL)
    }
  }

  // The eagle: circling high by day, swooping down over the meadow while Claude works
  if (!night && !s.isUpset) {
    if (s.isWorking) {
      const period = 80
      const u = (t % period) / period
      const pass = Math.floor(t / period)
      const dir = pass % 2 ? -1 : 1
      const x = Math.round(dir === 1 ? -11 + u * (w + 11) : w - u * (w + 11))
      const r = Math.round(1 + 6 * Math.sin(u * Math.PI))
      draw(g, r, x, EAGLE[u > 0.35 && u < 0.65 ? 0 : Math.floor(t / 2) % 2] as string[])
    } else {
      const cx = w * (0.5 + 0.3 * Math.sin(t / 700))
      const a = t / 20
      const x = Math.round(cx + Math.min(14, w / 5) * Math.cos(a)) - 5
      const r = Math.round(2 + 1.5 * Math.sin(a))
      // Mostly gliding, a few beats now and then
      const beat = t % 60 < 8 ? Math.floor(t / 2) % 2 : 0
      draw(g, r, x, EAGLE[beat] as string[])
    }
  }

  // Butterflies over the flowers by day
  if (!night && !s.isUpset)
    for (let i = 0; i < (w >= 100 ? 3 : 2); i++) {
      const c = Math.round(((i + 0.5) * w) / 3 + 9 * Math.sin(t / 47 + i * 2) + 4 * Math.sin(t / 13 + i))
      const r = 13 + Math.round(1.5 * Math.sin(t / 19 + i * 3))
      const colour = 'QYV'[i] as string
      draw(g, r, c, (BUTTERFLY[Math.floor(t / 3) % 2] as string[]).map(line => line.replace(/@/g, colour)))
    }

  // The herd: crossing by day, lying down at night
  if (night) {
    const rest = [IBEX.rest, IBEX.rest, KID.rest]
    for (const f of l.front) draw(g, f.top, f.x, f.sprite)
    // Huddled in the widest stretch of open meadow, the kid in front
    rest.forEach((sprite, i) => draw(g, FLOOR + 1 - sprite.length, l.den + [-14, 1, -6][i]!, sprite))
  } else {
    for (const a of herd(t, w, s.isWorking)) draw(g, a.top, a.x, a.sprite)
    for (const f of l.front) draw(g, f.top, f.x, f.sprite)
  }

  // The prayer flags, fluttering
  for (const [c, r, p] of l.flags) dot(g, r, 'Tb'.includes(p) || (t + c) % 12 < 8 ? c : c + 1, p)

  // The pika by its rock, gone in a flash at any noise
  if (l.pika !== null && !night && s.spin === 0 && t % 500 < 220) {
    const sprite = PIKA[Math.floor(t / 25) % 2] as string[]
    draw(g, FLOOR + 1 - sprite.length, l.pika, sprite)
  }

  // Marmots out of their burrows
  if (!night)
    l.burrows.forEach((bx, i) => {
      const m = marmot(t, i, s.spin)
      if (m.up <= 0) return
      const sprite = mirror(m.whistle ? MARMOT_WHISTLE : MARMOT, m.facing)
      draw(g, FLOOR + 1 - m.up, bx + 1, sprite.slice(0, m.up))
      if (m.whistle && (t % 4) < 2) draw(g, FLOOR - MARMOT.length - 2, bx + (m.facing === 1 ? 6 : 0), ['W.W', '.W.'])
    })

  // Small birds on the rocks lift off when something happens
  if (!night)
    l.perches.forEach(([x, r], i) => {
      if (s.spin > 0) {
        const lift = Math.min(r, flutter(s.spin) + 1 + (i % 2))
        draw(g, r - 1 - lift, x + Math.round(2 * Math.sin((t + i * 5) / 2)), FLAP[(Math.floor(t / 2) + i) % 2] as string[])
      } else draw(g, r - 1, x, i % 2 ? mirror(BIRD, -1) : BIRD)
    })

  // Something went wrong: a snow squall blows in
  if (s.isUpset) {
    // Heavy cloud along the top, billowing, with a darker underside
    for (let c = 0; c < w; c++) {
      const x = c + Math.floor(t / 4)
      const lump = Math.abs(((x % 9) - 4) / 4) // 1 between billows, 0 at their middle
      const depth = 2 + Math.round(2 * (1 - lump * lump)) + (hash(Math.floor(x / 9)) % 2)
      for (let r = 0; r < depth; r++) dot(g, r, c, r >= depth - 1 ? 'Z' : 'z')
    }
    for (let i = 0; i < w / 2; i++) {
      const h = hash(i * 11 + 9)
      const r = ((h >>> 4) % H + t) % H
      const c = ((h % w) + Math.floor(((h >>> 4) % H + t) / 2)) % w
      if (r >= 3 && r < H - 1) dot(g, r, c, 'x')
    }
  }

  return g.map(r => r.join(''))
}

// ---------------------------------------------------------------- the character

const PX = 6
const CELL = 8
const GROUND = ",'.'`,.''.,`'."

export const mountains: Character = {
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
    const cells = halfBlocks(sp, 0, cols, fit, s.isAsleep ? NIGHT : s.isHappy ? GLOW : DAY)
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[i % GROUND.length]
    return { rows: cells, ground, groundColor: 'green', offset: s.x }
  },

  svg(s, cols) {
    const w = cols * CELL
    const art = Math.floor(w / PX)
    const h = H * PX
    const sky = s.isAsleep ? `<rect x="0" y="0" width="${w}" height="${h}" fill="#0f1430"/>` : ''
    return svgOpen(w, h) + sky + pixels(picture(s, art), 0, 0, PX, s.isAsleep ? NIGHT : s.isHappy ? GLOW : DAY) + '</svg>'
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
