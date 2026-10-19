import type { Scene } from '../types'
import { halfBlocks, mirror, pixels, svgOpen } from './shared'
import type { Character } from './shared'

// Kathmandu: not one animal but the valley's skyline across the whole band.
// The snowy Himalaya stand along the far horizon; in front, a row of
// red-brick houses with carved wooden windows, and among them the landmarks:
// Newari pagodas with tiered roofs and golden pinnacles, the Swayambhu stupa
// with the Buddha's eyes and its prayer flags fluttering, the stone shikhara
// of Krishna Mandir and the slender Dharahara tower. Pigeons sit on the roofs
// and in the temple squares and flutter up when you send a message or a tool
// runs; a kite flies over the valley now and then, and haze drifts along the
// mountains. Claude working brings people to the street and pigeons wheeling
// round the stupa; Claude done rings the temple bells and fills the sky with
// kites; an error brings a monsoon shower; asleep it's night, with a moon,
// stars, lit windows and butter lamps flickering on the temple steps.
//
// Like the forest, it draws the whole band itself: rows are exactly `cols`
// wide and `offset` cancels the engine's x. Everything is a pure function of
// the scene; the skyline is laid out once per width from a seeded hash.
//
// Pixels: E outline, N n snow (lit, shade), M rock, a haze, B b Q brick,
// P plinth brick, W carved wood, w d window lattice (w lights up at night),
// T roof, U eave, Y y gold, J bell, C c whitewash, S s stone, z stone band,
// K black, r red (the stupa's nose), 1-5 prayer flags (blue, white, red,
// green, yellow), G g q pigeon, H skin, O saffron, V plant, k tank, = - street,
// X x stars, L l moon, A cloud, R rain, F f butter lamps, Z sparkle

const H = 20 // pixel rows: things stand on row 18, row 19 is the street
const FLOOR = H - 2

const DAY: Record<string, string> = {
  E: '#1c1311', N: '#eef2f8', n: '#b4c2d8', M: '#424c66',
  B: '#b5502f', b: '#9a4029', Q: '#c2693e', P: '#8a3826', W: '#7a4a2a', w: '#2e1b12', d: '#2e1b12',
  T: '#6e4532', U: '#4f2f22', Y: '#f2c445', y: '#c8952c', J: '#f2c445',
  C: '#f4f1e8', c: '#cdc6b6', S: '#e2cfa2', s: '#bba77a', z: '#97845c', K: '#161112', r: '#c8402c',
  '1': '#3b6fe0', '2': '#f2f2f2', '3': '#e04848', '4': '#3fae5a', '5': '#f2d43c',
  G: '#a9afbc', g: '#6f7684', q: '#5f9a8e', H: '#c8915e', O: '#e88a2a', V: '#4f9a3c', k: '#3a3f4a',
  '=': '#7a6152', '-': '#5c473c', X: '#f4f4ff', x: '#8a8fb0', L: '#f3eec8', l: '#cfc9a2',
  A: '#6b7480', R: '#8fb4e0', F: '#ffd56a', f: '#ff9a3a', Z: '#fff4b0', a: '#7c869a',
}
const NIGHT: Record<string, string> = {
  ...DAY,
  E: '#0d0a0c', N: '#c6d0e6', n: '#8a97b6', M: '#2c3450',
  B: '#5e2c1f', b: '#51251b', Q: '#663322', P: '#47201a', W: '#3e281c', w: '#f2b04c', d: '#1a120e',
  T: '#3a2620', U: '#2a1a15', Y: '#a8862e', y: '#86681f', J: '#a8862e',
  C: '#aeb2c2', c: '#8a8c9c', S: '#857a64', s: '#6a604c', z: '#554b38', r: '#7a2a20',
  '1': '#28487e', '2': '#9a9aa8', '3': '#8a3434', '4': '#2c6a3e', '5': '#9a8a3a',
  G: '#5e6270', g: '#444854', q: '#3a5a54', a: '#3a4258', V: '#25502f', k: '#22252e', '=': '#3e322c', '-': '#2e2622',
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

// Draw only over the sky and the mountains (or just `over`), so it stays behind the city
function behind(g: Grid, r: number, c: number, sprite: readonly string[], over = '.NnMaXxLl') {
  sprite.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) if (line[j] !== '.' && over.includes(g[r + i]?.[c + j] ?? 'E')) dot(g, r + i, c + j, line[j] as string)
  })
}

function draw(g: Grid, r: number, c: number, sprite: readonly string[]) {
  sprite.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) if (line[j] !== '.') dot(g, r + i, c + j, line[j] as string)
  })
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

// ---------------------------------------------------------------- the landmarks

// A Newari pagoda, three tiers on a stepped plinth (like Nyatapola): a golden
// pinnacle, dark timber roofs with bells (J) at their corners, brick walls
// with carved windows and a door
const PAGODA = outlined([
  '.........Y.........',
  '........YyY........',
  '.......TTTTT.......',
  '.....UUUUUUUUU.....',
  '.....J.BWwWB.J.....',
  '.....TTTTTTTTT.....',
  '...UUUUUUUUUUUUU...',
  '...J.BWWWBWWWB.J...',
  '.....BWwWBWwWB.....',
  '...TTTTTTTTTTTTT...',
  '.UUUUUUUUUUUUUUUUU.',
  '.J.BWWWBBBBBWWWB.J.',
  '...BWwWBBdBBWwWB...',
  '...BBBBBBdBBBBBB...',
  '..PPPPPPSSSPPPPPP..',
  '.PPPPPPPsssPPPPPPP.',
  'PPPPPPPPSSSPPPPPPPP',
])

// A smaller two-tiered one
const PAGODA2 = outlined([
  '.......Y.......',
  '......YyY......',
  '.....TTTTT.....',
  '...UUUUUUUUU...',
  '...J.BWwWB.J...',
  '...TTTTTTTTT...',
  '.UUUUUUUUUUUUU.',
  '.J.BWWWBWWWB.J.',
  '...BWwWBWwWB...',
  '...BBBBdBBBB...',
  '..PPPPSSSPPPP..',
  '.PPPPPsssPPPPP.',
])

// Swayambhunath: a white dome, the golden harmika with the Buddha's eyes, and
// a spire of thirteen rings under a parasol. The prayer flags hang from its top
const STUPA = outlined([
  '........Y........',
  '.......YYY.......',
  '.......yyy.......',
  '.......YYY.......',
  '.......yyy.......',
  '......YYYYY......',
  '......yyyyy......',
  '......YYYYY......',
  '.....YYYYYYY.....',
  '.....YKKYKKY.....',
  '.....YYYrYYY.....',
  '....CCCCCCCcc....',
  '..CCCCCCCCCCccc..',
  '.CCCCCCCCCCCcccc.',
  'CCCCCCCCCCCCccccc',
  'CCCCCCCCCCCCccccc',
  'ccccccccccccccccc',
])

// Krishna Mandir: a stone shikhara over two pillared galleries with little
// corner towers
const SHIKHARA = outlined([
  '.......Y.......',
  '.......S.......',
  '......zzz......',
  '......SSs......',
  '......Szs......',
  '.....SSzss.....',
  '.....SSzss.....',
  '..S..SSzss..S..',
  '.SSs.SSzss.SSs.',
  '.SSsSSSzsssSSs.',
  'SSSSSSSSSSSSSss',
  '.SKSKSKSKSKSKs.',
  'zzzzzzzzzzzzzzz',
  'SKSKSKSKSKSKSKs',
  'SKSKSKSKSKSKSKs',
  'sssssssssssssss',
])

// Dharahara: a slender white tower with a balcony, a little dome and a spire
const DHARAHARA = outlined([
  '...Y...',
  '...Y...',
  '..YYy..',
  '..CCc..',
  '.CCCcc.',
  '..CKc..',
  '..CCc..',
  '..CCc..',
  '..CKc..',
  '..CCc..',
  '..CCc..',
  '..CKc..',
  '..CCc..',
  '..CCc..',
  '.CCCcc.',
  '.CCCcc.',
  'CCCCccc',
])

type Mark = 'pagoda' | 'pagoda2' | 'stupa' | 'shikhara' | 'dharahara'
const SPRITES: Record<Mark, string[]> = { pagoda: PAGODA, pagoda2: PAGODA2, stupa: STUPA, shikhara: SHIKHARA, dharahara: DHARAHARA }

// Left to right, and how soon each is wanted as the band widens (1 first)
const ROW: [Mark, number][] = [
  ['pagoda2', 5],
  ['pagoda', 2],
  ['stupa', 1],
  ['dharahara', 4],
  ['shikhara', 3],
  ['pagoda2', 6],
  ['shikhara', 7],
]

// A house from its size: brick, a flat roof or a tiled one, carved windows
// (some lit at night) and a door, sometimes a water tank or a pot plant on top
function house(w: number, h: number, seed: number): string[] {
  const brick = 'BbQ'[seed % 3] as string
  const tiled = (seed >>> 3) % 3 === 0
  const rows: string[] = []
  const pad = tiled ? '.' : ''
  if (tiled) {
    rows.push('..' + 'T'.repeat(w - 2) + '..')
    rows.push('U'.repeat(w + 2))
  } else {
    const top = Array<string>(w).fill('.')
    if ((seed >>> 5) % 2) {
      top[1] = 'k'
      top[2] = 'k'
    }
    if ((seed >>> 6) % 3 === 0) top[w - 2] = 'V'
    if (top.some(p => p !== '.')) rows.push(top.join(''))
  }
  const body: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(brick))
  // Windows three wide, a floor every three rows, the ground floor a door
  const across = Math.max(1, Math.floor((w + 1) / 4))
  const left = Math.floor((w - (across * 4 - 1)) / 2)
  for (let r = 1, f = 0; r + 1 < h - 2; r += 3, f++) {
    for (let i = 0; i < across; i++) {
      const c = left + i * 4
      const lit = hash(seed * 7 + f * 13 + i) % 3 !== 0 ? 'w' : 'd'
      body[r]![c] = body[r]![c + 1] = body[r]![c + 2] = 'W'
      body[r + 1]![c] = body[r + 1]![c + 2] = 'W'
      body[r + 1]![c + 1] = lit
    }
  }
  const door = left + 4 * ((seed >>> 8) % across) + 1
  body[h - 2]![door] = body[h - 1]![door] = 'd'
  for (const line of body) rows.push(pad + line.join('') + pad)
  return outlined(rows)
}

// ---------------------------------------------------------------- the layout

type Placed = { x: number; top: number; sprite: string[]; kind?: Mark }
type Layout = {
  base: Grid
  houses: Placed[]
  marks: Placed[]
  perches: [number, number][]
  bells: [number, number, 1 | -1][]
  lamps: [number, number][]
  stupa: Placed | null
  moon: number
}

const layouts = new Map<number, Layout>()

function layout(w: number): Layout {
  const cached = layouts.get(w)
  if (cached) return cached
  if (layouts.size > 8) layouts.clear() // widths change on resize; keep a few
  const g: Grid = Array.from({ length: H }, () => Array<string>(w).fill('.'))

  // The Himalaya: a long snowy ridge with steep peaks rising from it, lit
  // from the left, rock below the snow
  const peaks: { x: number; top: number; slope: number }[] = []
  for (let x = -6, i = 0; x < w + 12; x += 9 + (hash(i * 23 + 5) % 12), i++) {
    peaks.push({ x, top: 1 + (hash(i * 29 + 1) % 4), slope: 1 })
    peaks.push({ x: x + 5 + (hash(i * 3 + 8) % 4), top: 6 + (hash(i * 37 + 2) % 2), slope: 2 })
  }
  for (let c = 0; c < w; c++) {
    let best = peaks[0]!
    let top = H
    for (const p of peaks) {
      const t = p.top + Math.floor(Math.abs(c - p.x) / p.slope)
      if (t < top) {
        top = t
        best = p
      }
    }
    for (let r = top; r < FLOOR; r++) dot(g, r, c, r < best.top + (best.slope === 1 ? 4 : 2) ? (c <= best.x ? 'N' : 'n') : 'M')
  }

  // The landmarks, as many as fit, spread out
  const n = Math.max(1, Math.min(ROW.length, Math.floor((w + 4) / 26)))
  const kinds = ROW.filter(([, rank]) => rank <= n).map(([k]) => k)
  const slot = w / kinds.length
  const marks: Placed[] = kinds.map((kind, i) => {
    const sprite = SPRITES[kind]
    const width = sprite[0]!.length
    const centre = Math.floor(slot * (i + 0.5) + ((hash(i * 7 + w) % 100) / 100 - 0.5) * slot * 0.25)
    return { x: centre - (width >> 1), top: FLOOR + 1 - sprite.length, sprite, kind }
  })

  // A row of houses behind and between them
  const houses: Placed[] = []
  for (let x = -2, i = 0; x < w; i++) {
    const hw = 5 + (hash(i * 11 + 3) % 6)
    const hh = 5 + (hash(i * 13 + 4) % 4)
    const sprite = house(hw, hh, hash(i * 17 + 9))
    houses.push({ x: x - (sprite[0]!.length - hw - 2) / 2, top: FLOOR + 1 - sprite.length, sprite })
    x += hw + 1
  }
  for (const p of [...houses, ...marks]) draw(g, p.top, p.x, p.sprite)

  // Pigeons on some flat roofs clear of the landmarks
  const perches: [number, number][] = []
  houses.forEach((p, i) => {
    const flat = !p.sprite.some(l => /[TkV]/.test(l))
    const free = marks.every(m => p.x + p.sprite[0]!.length + 2 < m.x || p.x - 2 > m.x + m.sprite[0]!.length)
    if (flat && free && hash(i * 5 + 1) % 2 === 0) perches.push([p.x + 2, p.top - 2])
  })
  for (const m of marks) {
    // and on the square in front of the pagodas
    if (m.kind === 'pagoda' || m.kind === 'pagoda2') perches.push([m.x + 2, FLOOR - 1], [m.x + m.sprite[0]!.length - 6, FLOOR - 1])
  }

  // Bells under the pagodas' eaves, butter lamps along the temple steps
  const bells: [number, number, 1 | -1][] = []
  const lamps: [number, number][] = []
  for (const m of marks) {
    const mid = m.sprite[0]!.length >> 1
    m.sprite.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === 'J') bells.push([m.top + r, m.x + c, c < mid ? -1 : 1])
      }
    })
    const last = m.sprite[m.sprite.length - 1]!
    for (let c = 1; c < last.length - 1; c += 2) lamps.push([m.top + m.sprite.length - 1, m.x + c])
  }

  // Where the moon rises at night: the clearest patch of sky on the right
  let moon = w - 7
  let clearest = -1
  for (let c = Math.floor(w * 0.55); c <= w - 7; c++) {
    let clear = 0
    for (let r = 1; r <= 5; r++) for (let j = 0; j < 5; j++) if (g[r]?.[c + j] === '.') clear++
    if (clear > clearest) {
      clearest = clear
      moon = c
    }
  }

  // The street: brick paving
  for (let c = 0; c < w; c++) dot(g, H - 1, c, c % 3 === 2 ? '-' : '=')

  const made = { base: g, houses, marks, perches, bells, lamps, stupa: marks.find(m => m.kind === 'stupa') ?? null, moon }
  layouts.set(w, made)
  return made
}

// ---------------------------------------------------------------- the life

const PIGEON = ['..qG', 'ggGG'] // sitting, facing right
const FLAP = [
  ['G..G', '.GG.'],
  ['.GG.', 'G..G'],
]
// How high the pigeons are, ticks into a jump: a tool call's four-tick hop
// ends low, a message's nine ticks bob up twice and settle
const LIFT = [0, 2, 3, 4, 3, 4, 5, 4, 2, 1]
const flutter = (spin: number) => LIFT[((spin - 1) % 9) + 1] as number

const KITE = [
  ['.a.', 'aab', 'abb', '.b.', '.t.', '..t'],
  ['.a.', 'aab', 'abb', '.b.', '.t.', 't..'],
]
// Little people in the street, outlined so they stand out against the brick
const PEOPLE = ['2', '1', 'O', '4'].map(c => [
  outlined(['.H.', c + c + c, 'w.w']),
  outlined(['.H.', c + c + c, '.w.']),
])
const WISPS = [
  ['....aaaaaa......', 'aaaaaaaaaaaaaaaa'],
  ['..aaaaa...', 'aaaaaaaaaa'],
]
const SPARKLE = ['.Z.', 'Z.Z', '.Z.']
const MOON = ['.LLL.', 'LLlLL', 'LLLLl', 'LlLLL', '.LLL.']

// The prayer flags: strings from the top of the stupa's spire down to the
// ground on either side, in the traditional order, rippling in the wind
function flags(g: Grid, stupa: Placed, t: number) {
  const cx = stupa.x + (stupa.sprite[0]!.length >> 1)
  const top = stupa.top + 1
  const fall = FLOOR - 1 - top
  for (const side of [-1, 1]) {
    for (const reach of [11, 19]) {
      // A string that sags: steep near the spire, flatter near the ground,
      // one flag in every cell it passes through
      let last = ''
      let k = 0
      for (let i = 0; i <= 200; i++) {
        const u = i / 200
        const r = top + Math.round(fall * Math.pow(u, 0.7))
        const c = cx + side * Math.round(reach * u)
        if (`${r},${c}` === last) continue
        last = `${r},${c}`
        const colour = String(1 + (k % 5))
        dot(g, r, c, colour)
        // Every flag hangs a pixel below its string; a gust lifts them in a wave
        if (k > 1 && Math.sin(t / 2.5 - k * 0.7 + reach) < 0.2) dot(g, r + 1, c, colour)
        k++
      }
    }
  }
}

function picture(s: Scene, w: number): string[] {
  const l = layout(w)
  const g = l.base.map(r => r.slice())
  const t = s.tick
  const night = s.isAsleep

  if (night) {
    behind(g, 1, l.moon, MOON, '.')
    for (let i = 0; i < w / 5; i++) {
      const c = hash(i * 41 + 3) % w
      const r = hash(i * 43 + 5) % 8
      if (g[r]?.[c] === '.' && Math.abs(c - l.moon - 2) > 4) dot(g, r, c, (Math.floor(t / 8) + i) % 5 === 0 ? 'x' : 'X')
    }
  }

  if (s.isUpset) {
    for (let c = 0; c < w; c++) {
      const depth = 1 + (Math.sin(c / 4) + Math.sin(c / 2.3 + 1) > 0.4 ? 1 : 0) + (Math.sin(c / 4) > 0.6 ? 1 : 0)
      for (let r = 0; r < depth; r++) dot(g, r, c, 'A')
    }
  }

  if (l.stupa) flags(g, l.stupa, t)
  // The flags hang behind the other landmarks
  for (const m of l.marks) if (m !== l.stupa) draw(g, m.top, m.x, m.sprite)
  if (l.stupa) draw(g, l.stupa.top, l.stupa.x, l.stupa.sprite.slice(0, 11))

  if (night) {
    l.lamps.forEach(([r, c], i) => dot(g, r, c, hash(i * 7 + Math.floor(t / 3)) % 4 === 0 ? 'f' : 'F'))
  }

  // Kites over the valley: one now and then, several when Claude is done
  const kites = s.isHappy ? 3 : (t % 900) < 500 && !night && !s.isUpset ? 1 : 0
  for (let i = 0; i < kites; i++) {
    const c = Math.round(((i + 0.5 + (hash(Math.floor(t / 900) + i) % 50) / 100) * w) / (kites + 0.5) + 6 * Math.sin(t / 37 + i * 2))
    const r = 1 + i % 2 + Math.round(1.2 * Math.sin(t / 13 + i))
    const colours = ['O3', '51', '35'][i] as string
    behind(g, r, c, (KITE[Math.floor(t / 4) % 2] as string[]).map(line => line.replace(/a/g, colours[0]!).replace(/b/g, colours[1]!).replace(/t/g, '2')))
  }

  // Haze drifting slowly along the mountains, behind the city
  WISPS.forEach((wisp, i) => {
    const span = w + 50
    const c = (Math.floor(t / 7) + i * Math.floor(span / 2)) % span - 20
    behind(g, i ? 8 : 5, c, wisp, 'NnM')
  })

  // Claude working: people out in the street, pigeons wheeling round the stupa
  if (s.isWorking) {
    for (let i = 0; i < Math.max(2, Math.floor(w / 30)); i++) {
      const span = w + 4
      const p = ((t >> 1) + hash(i * 3 + 1)) % span
      draw(g, FLOOR - 3, i % 2 ? w + 1 - p : p - 4, PEOPLE[i % PEOPLE.length]![(t >> 1) % 2] as string[])
    }
    const hub = l.stupa ? l.stupa.x + (l.stupa.sprite[0]!.length >> 1) : w >> 1
    for (let i = 0; i < 4; i++) {
      const a = t / 9 + (i * Math.PI) / 2
      draw(g, 4 + Math.round(2.5 * Math.sin(a)), hub - 1 + Math.round(13 * Math.cos(a)), FLAP[(Math.floor(t / 2) + i) % 2] as string[])
    }
  }

  // Pigeons on the roofs fly up when something happens
  l.perches.forEach(([x, r], i) => {
    if (night) return // roosting
    if (s.spin > 0) {
      const lift = Math.min(r, flutter(s.spin) + (i % 2))
      draw(g, r - lift, x + Math.round(2 * Math.sin((t + i * 5) / 2)), FLAP[(Math.floor(t / 2) + i) % 2] as string[])
    } else draw(g, r, x, i % 2 ? mirror(PIGEON, -1) : PIGEON)
  })

  // Claude done: the temple bells ring
  if (s.isHappy) {
    l.bells.forEach(([r, c, side], i) => {
      const swing = (t + i) % 4 < 2
      if (swing) {
        dot(g, r + 1, c + side, 'Z')
        dot(g, r, c + 2 * side, 'Z')
      } else dot(g, r + 1, c + 2 * side, 'Z')
    })
    l.marks.forEach((m, i) => {
      if ((t + i * 3) % 8 < 4 && m.top > 1) draw(g, m.top - 3, m.x + (m.sprite[0]!.length >> 1) - 1 + ((i % 2) * 2 - 1) * 4, SPARKLE)
    })
  }

  // Something went wrong: a monsoon shower
  if (s.isUpset) {
    for (let c = 0; c < w; c++) {
      const h = hash(c * 11 + 9)
      if (h % 2) continue
      const r = (((h >>> 4) % 20) + t * 2) % 20
      if (r >= 2 && r < H - 1) {
        dot(g, r, c, 'R')
        dot(g, r + 1, c, 'R')
      }
    }
  }

  return g.map(r => r.join(''))
}

// ---------------------------------------------------------------- the character

const PX = 6
const CELL = 8
const GROUND = '_.-._,_-.__.-_'

export const kathmandu: Character = {
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
    return { rows: cells, ground, groundColor: 'gray', offset: s.x }
  },

  svg(s, cols) {
    const w = cols * CELL
    const art = Math.floor(w / PX)
    const h = H * PX
    const sky = s.isAsleep ? `<rect x="0" y="0" width="${w}" height="${h}" fill="#141a33"/>` : ''
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
