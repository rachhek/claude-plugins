import type { Scene } from '../types'
import { halfBlocks, pixels, svgOpen } from './shared'
import type { Character } from './shared'

// What the city skylines (Tokyo, Paris, New York) share. Like the forest, each
// is a whole-band scene: rows exactly `cols` wide, laid out once per width
// from a seeded hash, everything else a pure function of the scene. They all
// react the same way: pigeons take off from the rooftops on a message or a
// tool call, fireworks go up over the skyline when Claude is done, it rains
// when something goes wrong, and asleep it's night, with stars, a moon and
// lit windows. Each city adds its own life (a train, a boat, taxis).
//
// Pixels every city shares: E outline, * : stars, M m moon, | rain, ~ cloud,
// ^ pigeon, " pigeon's neck, 1-5 fireworks, 0 9 lit windows (warm, cool).
// Each city's own letters are everything else.

export type Grid = string[][]
export type Palette = Record<string, string>

export const FX_DAY: Palette = {
  '*': '#f4f4ff', ':': '#8a8fb0', M: '#f3eec8', m: '#cfc9a2', '|': '#8fb4e0', '~': '#6b7480',
  '^': '#8f96a3', '"': '#6f8f7e', '1': '#ff6f8f', '2': '#ffd36a', '3': '#7fe0ff', '4': '#b58cff', '5': '#fff6e0',
  '0': '#ffd27a', '9': '#e8f0ff',
}
export const FX_NIGHT: Palette = { ...FX_DAY, '^': '#5c6270', '"': '#46584e' }

// A 32-bit integer hash, for a layout and timings that are the same every frame
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x5bd1e995, 0x9e3779b1)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca77)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

export function dot(g: Grid, r: number, c: number, p: string) {
  const row = g[r]
  if (row && c >= 0 && c < row.length) row[c] = p
}

// Only where it's still sky, so things in the sky stay behind the buildings
export function sky(g: Grid, r: number, c: number, p: string) {
  if (g[r]?.[c] === '.') dot(g, r, c, p)
}

export function draw(g: Grid, r: number, c: number, sprite: readonly string[]) {
  sprite.forEach((line, i) => {
    for (let j = 0; j < line.length; j++) if (line[j] !== '.') dot(g, r + i, c + j, line[j] as string)
  })
}

export function rect(g: Grid, top: number, left: number, bottom: number, right: number, p: string) {
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) dot(g, r, c, p)
}

export const blank = (h: number, w: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'))

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

// A round tree crown from its row widths (odd, centred) over a trunk, lit from the top left
export function tree(widths: number[], trunkRows: number, leaf: string, shade: string, light: string, trunk: string): string[] {
  const w = Math.max(...widths)
  const rows = widths.map((n, r) => {
    const left = (w - n) / 2
    let line = ''
    for (let c = 0; c < w; c++) {
      if (c < left || c >= left + n) line += '.'
      else {
        const u = (c - (w - 1) / 2) / (w / 2) + (r - (widths.length - 1) / 2) / (widths.length / 2)
        line += u > 0.75 ? shade : u < -0.95 ? light : leaf
      }
    }
    return line
  })
  const left = (w - 1) / 2
  for (let i = 0; i < trunkRows; i++) rows.push('.'.repeat(left) + trunk + '.'.repeat(left))
  return outlined(rows)
}

// ---------------------------------------------------------------- the layout

export type Layout = {
  /** Everything that stands still, behind the city's own life */
  back: Grid
  /** What stands in front of that life (trees, a gate, a bridge), '.' where clear */
  front: Grid
  /** Window pixels (drawn as `w`), as row * width + column, which light up at night */
  windows: number[]
  /** Where pigeons sit: [column, row] of the top left of a perched pigeon */
  perches: [number, number][]
  /** Column of the moon's left edge, over a clear patch of sky */
  moon: number
}

// Office windows: every other pixel of a block's wall, inside a one-pixel margin
export function windowsIn(g: Grid, wins: number[], w: number, top: number, left: number, bottom: number, right: number, win: string) {
  for (let r = top; r <= bottom; r += 2)
    for (let c = left; c <= right; c += 2)
      if (c >= 0 && c < w && r >= 0 && r < g.length) {
        dot(g, r, c, win)
        wins.push(r * w + c)
      }
}

// Whether a block from column x to right, standing behind landmarks spanning
// these columns, would show only a sliver (one or two columns) beside one
export function sliver(x: number, right: number, spans: [number, number][]): boolean {
  if (!spans.some(([a, b]) => a <= right && b >= x)) return false
  let run = 0
  for (let c = x; c <= right + 1; c++) {
    if (c <= right && !spans.some(([a, b]) => c >= a && c <= b)) run++
    else if (run > 0 && run < 3) return true
    else run = 0
  }
  return false
}

// Where the moon goes: the rightmost patch of sky clear seven rows down, else the clearest
export function clearSky(g: Grid, w: number, front: Grid): number {
  const top = (c: number) => {
    const r = g.findIndex((row, i) => (row[c] ?? '.') !== '.' || (front[i]![c] ?? '.') !== '.')
    return r === -1 ? g.length : r
  }
  const tops = Array.from({ length: w + 2 }, (_, c) => top(c - 1))
  let best = Math.max(0, w - 10)
  let bestTop = -1
  for (let c = w - 8; c >= 1; c--) {
    const lowest = Math.min(...tops.slice(c, c + 8))
    if (bestTop < 7 && lowest > bestTop) {
      bestTop = lowest
      best = c
    }
  }
  return best
}

// ---------------------------------------------------------------- what every city does

const PERCHED = ['..^"', '^^^.'] // a pigeon, facing right
const FLAP = [
  ['^...^', '.^"^.'],
  ['.^"^.', '^...^'],
]
const MOON = ['.MMM.', 'MMmMM', 'MMMMm', 'MmMMM', '.MMM.']
const LIFT = [0, 2, 3, 3, 2, 3, 4, 3, 2, 1]
const flutter = (spin: number) => LIFT[((spin - 1) % 9) + 1] as number

function night(g: Grid, w: number, t: number, l: Layout, lit: number, twinkle: number) {
  for (let i = 0; i < MOON.length; i++)
    for (let j = 0; j < 5; j++) if (MOON[i]![j] !== '.') sky(g, 1 + i, l.moon + j, MOON[i]![j] as string)
  for (let i = 0; i < w / 5; i++) {
    const c = hash(i * 41 + 3) % w
    const r = hash(i * 43 + 5) % 8
    if (Math.abs(c - l.moon - 2) > 4) sky(g, r, c, (Math.floor(t / 8) + i) % 6 === 0 ? ':' : '*')
  }
  // Windows come on and off, each on its own slow clock
  l.windows.forEach((at, i) => {
    const h = hash(i * 7 + 1)
    const period = twinkle + (h % twinkle)
    const on = hash(i * 13 + Math.floor((t + (h >>> 8) % period) / period)) % 100 < lit * 100
    if (on) g[Math.floor(at / w)]![at % w] = (h >>> 4) % 4 ? '0' : '9'
  })
}

// Bursts over the skyline, a few at a time: a rocket goes up, opens into
// eight rays in its colour with white tips, then droops and twinkles out
const RAYS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]
function fireworks(g: Grid, w: number, t: number, open: number[]) {
  const n = Math.max(3, Math.round(w / 28))
  for (let i = 0; i < n && open.length; i++) {
    const u = (t + i * 9) % 22
    const h = hash(Math.floor((t + i * 9) / 22) * 5 + i * 101)
    // Somewhere over the low roofs, each burst in its own stretch of the band
    const c = open[Math.floor(((i + (h % 100) / 100) * open.length) / n)] as number
    const top = 2 + ((h >>> 8) % 2)
    const p = '1234'[(h >>> 12) % 4] as string
    if (u < 5) {
      sky(g, top + 9 - u * 2, c, '5') // the rocket going up, with a spark of trail
      sky(g, top + 10 - u * 2, c, p)
    } else if (u === 5) {
      for (const [dr, dc] of RAYS.slice(0, 4)) sky(g, top + (dr as number), c + (dc as number), '5')
      sky(g, top, c, '5')
    } else if (u < 17) {
      const reach = Math.min(3, u - 5) // grows to three
      const droop = u >= 12 ? 1 : 0
      RAYS.forEach(([dr, dc], j) => {
        for (let d = Math.max(1, reach - 1); d <= reach; d++) {
          if (u >= 14 && (j + d + t) % 2) continue // twinkling out
          const diagonal = dr !== 0 && dc !== 0
          const k = diagonal && d === 3 ? 2 : d // keep the burst round
          sky(g, top + (dr as number) * k + droop, c + (dc as number) * k, d === reach && u < 14 ? '5' : p)
        }
      })
    }
  }
}

export type City<L extends Layout> = {
  /** Pixel rows, even */
  H: number
  day: Palette
  night: Palette
  /** The night sky behind it all on the desktop */
  nightSky: string
  layout: (w: number) => L
  /** The city's own life, drawn behind its front layer (a train, a boat) */
  behind?: (g: Grid, s: Scene, l: L, w: number) => void
  /** And in front of it (petals, steam, lamps) */
  over?: (g: Grid, s: Scene, l: L, w: number) => void
  /** Share of windows lit at night, and ticks each stays on or off at least */
  lit: number
  twinkle: number
  ground: string
  groundColor: string
}

export function city<L extends Layout>(c: City<L>): Character {
  // Laid out once per width, with the columns that have clear sky six rows
  // down round them (for the fireworks; any column if none has)
  const layouts = new Map<number, [L, number[]]>()
  const layout = (w: number): [L, number[]] => {
    const cached = layouts.get(w)
    if (cached) return cached
    if (layouts.size > 8) layouts.clear() // widths change on resize; keep a few
    const l = c.layout(w)
    const top = (col: number) => l.back.findIndex((row, r) => row[col] !== '.' || l.front[r]![col] !== '.')
    const tops = Array.from({ length: w }, (_, col) => (top(col) === -1 ? c.H : top(col)))
    const clear = tops.map((_, col) => col).filter(col => col > 2 && col < w - 3 && tops.slice(col - 3, col + 4).every(r => r >= 6))
    const open = clear.length ? clear : tops.map((_, col) => col)
    // Only windows still showing light up: not ones a landmark or the front was drawn over
    l.windows = l.windows.filter(a => l.back[Math.floor(a / w)]![a % w] === 'w' && l.front[Math.floor(a / w)]![a % w] === '.')
    layouts.set(w, [l, open])
    return [l, open]
  }

  const picture = (s: Scene, w: number): string[] => {
    const [l, open] = layout(w)
    const g = l.back.map(r => r.slice())
    const t = s.tick
    if (s.isAsleep) night(g, w, t, l, c.lit, c.twinkle)
    if (s.isHappy) fireworks(g, w, t, open)
    c.behind?.(g, s, l, w)
    l.front.forEach((row, r) => row.forEach((p, col) => p !== '.' && ((g[r] as string[])[col] = p)))
    c.over?.(g, s, l, w)

    // Pigeons on the rooftops take off when something happens (a couple fly over if there's no roof for them)
    const flock: [number, number][] = l.perches.length || !s.spin ? l.perches : [[Math.floor(w / 3), 5], [Math.floor((2 * w) / 3), 6]]
    flock.forEach(([x, r], i) => {
      if (s.spin > 0) {
        const lift = Math.min(r, flutter(s.spin) + (i % 2) + 1)
        draw(g, r - lift, x + Math.round(2 * Math.sin((t + i * 5) / 2)), FLAP[(Math.floor(t / 2) + i) % 2] as string[])
      } else draw(g, r, x, i % 2 ? PERCHED.map(line => [...line].reverse().join('')) : PERCHED)
    })

    // Something went wrong: a grey cloud and rain
    if (s.isUpset) {
      for (let col = 0; col < w; col++) {
        const depth = 1 + (Math.sin(col / 4) + Math.sin(col / 2.3 + 1) > 0.4 ? 1 : 0) + (Math.sin(col / 4) > 0.6 ? 1 : 0)
        for (let r = 0; r < depth; r++) dot(g, r, col, '~')
        const h = hash(col * 11 + 9)
        if (h % 3) continue
        const r = (((h >>> 4) % c.H) + t * 2) % c.H
        if (r >= 2 && r < c.H - 1) {
          dot(g, r, col, '|')
          dot(g, r + 1, col, '|')
        }
      }
    }
    return g.map(r => r.join(''))
  }

  const day = { ...FX_DAY, ...c.day }
  const dark = { ...FX_NIGHT, ...c.night }
  const PX = 6
  const CELL = 8

  return {
    width: 0,
    canMunch: false,
    rolls: true,
    stride: 0,
    pace: 1,
    snackLane: 0,
    chases: false,

    terminal(s, cols, rows) {
      // At most the band's height, cut from the top (never squeezed)
      const fit = Math.max(0, Math.min(c.H, rows - (rows % 2)))
      const sp = picture(s, cols).slice(c.H - fit)
      const cells = halfBlocks(sp, 0, cols, fit, s.isAsleep ? dark : day)
      let ground = ''
      for (let i = 0; i < cols; i++) ground += c.ground[i % c.ground.length]
      return { rows: cells, ground, groundColor: c.groundColor, offset: s.x }
    },

    svg(s, cols) {
      const w = cols * CELL
      const art = Math.floor(w / PX)
      const h = c.H * PX
      const back = s.isAsleep ? `<rect x="0" y="0" width="${w}" height="${h}" fill="${c.nightSky}"/>` : ''
      return svgOpen(w, h) + back + pixels(picture(s, art), 0, 0, PX, s.isAsleep ? dark : day) + '</svg>'
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
}
