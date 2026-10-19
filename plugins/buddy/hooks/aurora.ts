import type { Scene } from '../types'
import { draw, hash } from './forest'
import type { Grid } from './forest'
import { halfBlocks, mirror, pixels, svgOpen } from './shared'
import type { Character } from './shared'

// The aurora: northern lights over an Arctic night, across the whole band.
// The lights are thin rays of light hanging from a slowly waving hem, each
// brightest just above it and fading upward, flickering one by one, the
// curtains drifting along the sky; a frozen lake catches a few dim streaks of
// them. Below: low snowy hills, a few slim pines at the sides, a little cabin
// with a lit window and a smoking chimney. Now and then a reindeer or an
// arctic fox wanders along the snow, and a shooting star falls.
//
// A message or tool call sends a shooting star and a ripple through the
// lights; Claude working makes them flicker faster and brighter; Claude done
// flushes the lights pink and violet; an error rolls clouds in with snow and
// dims them; asleep they glow softer.
//
// Like the forest it draws the whole band: rows are exactly `cols` wide and
// `offset` cancels the engine's x. In a short band it gives up landscape
// (lake depth, the far hills, the cabin) before sky, so the lights keep most
// of the picture. Everything is a pure function of the scene; the landscape
// is laid out once per width and height.
//
// Pixels: e a n u light (bright mint to dim teal), v w faint violet and pink
// tips, p bright pink (happy tips), U Z reflections, I J ice, h H far hills,
// S s W snow (lit, shade, bright), P L pines and their snow, R roof, B logs,
// Y window, k chimney, m q smoke, X x stars, c C clouds, T reindeer, A
// antlers, M its pale rump, K eyes, F f fox

const FULL = 20 // pixel rows when the band has room

const COLOURS: Record<string, string> = {
  e: '#b8f8d4', a: '#45c98c', n: '#2b8a6a', u: '#1c5c5e', v: '#5e4a96', w: '#8e4f86', p: '#f3a6da',
  U: '#1a4f52', Z: '#143a40', I: '#101a29', J: '#17243a', h: '#33445f', H: '#4c5f80',
  S: '#c3d0e6', s: '#8b9dbd', W: '#eef3fb', P: '#24404e', L: '#9fb0cc', R: '#7a3a30', B: '#5a3a26',
  Y: '#ffcf6a', k: '#3a3a46', m: '#7c8394', q: '#4b5163', X: '#f4f4ff', x: '#8a8fb0', c: '#30384a',
  C: '#4b5469', T: '#9a7050', A: '#e0d2b0', M: '#e8e0cc', K: '#1a120c', F: '#eef0f6', f: '#b4bdd0',
}

// ---------------------------------------------------------------- sprites

// A slim conifer from its widths (at most 5 at the base), a touch of moonlit snow on the left of each tier, on a one-pixel trunk
function pine(widths: number[]): string[] {
  const w = Math.max(...widths)
  const rows = widths.map((n, r) => {
    const above = r > 0 ? (widths[r - 1] as number) : 0
    let line = ''
    for (let c = 0; c < w; c++) {
      const d = Math.abs(c - (w - 1) / 2)
      line += d > (n - 1) / 2 ? '.' : d > (above - 1) / 2 && c < (w - 1) / 2 ? 'L' : 'P'
    }
    return line
  })
  return [...rows, '.'.repeat(w >> 1) + 'P' + '.'.repeat(w >> 1)]
}
const TALL_PINE = pine([1, 1, 3, 1, 3, 3, 5, 3, 5]) // 10 rows
const SMALL_PINE = pine([1, 1, 3, 1, 3, 5]) // 7 rows

const CABIN = ['...W.k.', '..WWWk.', '.WWWWW.', 'RRRRRRR', '.BYBBB.', '.BBBBB.']
const CHIMNEY = 5

// Facing right, two steps each. The reindeer is 7 pixels tall, the fox 4
const REINDEER = [
  ['.....A.A', '.....AA.', '.....TKT', 'MTTTTTT.', '.TTTTT..', '.T.T.T.T', '.T.T.T.T'],
  ['.....A.A', '.....AA.', '.....TKT', 'MTTTTTT.', '.TTTTT..', '..T...T.', '.T.T.T.T'],
]
const FOX = [
  ['.....F.F', 'f....FKF', 'ffFFFFF.', '..F.F.F.'],
  ['.....F.F', 'f....FKF', 'ffFFFFF.', '.F..F..F'],
]

// ---------------------------------------------------------------- the landscape

// How a band of `h` pixel rows is shared out, from the bottom up
function bands(h: number) {
  const lake = h >= 18 ? 3 : h >= 14 ? 2 : 1
  const bank = h >= 16 ? 2 : 1
  const sky = Math.max(0, h - lake - bank)
  const hills = h >= 18 ? 3 : h >= 14 ? 2 : 0
  return { sky, bank, lake, hills }
}

type Layout = { base: Grid; sky: number; hem: number; cabin: [number, number] | null }
const layouts = new Map<string, Layout>()

function layout(w: number, h: number): Layout {
  const key = `${w}x${h}`
  const cached = layouts.get(key)
  if (cached) return cached
  if (layouts.size > 8) layouts.clear() // sizes change on resize; keep a few
  const { sky, bank, hills } = bands(h)
  const g: Grid = Array.from({ length: h }, () => Array<string>(w).fill('.'))
  const set = (r: number, c: number, p: string) => {
    if (r >= 0 && r < h && c >= 0 && c < w) g[r]![c] = p
  }

  // Low far hills along the bottom of the sky, moonlit along their tops
  for (let c = 0; c < w && hills > 0; c++) {
    const top = sky - Math.round(hills * (0.55 + 0.3 * Math.sin(c / 12 + 0.5) + 0.15 * Math.sin(c / 5 + 1.3)))
    for (let r = top; r < sky; r++) set(r, c, r === top ? 'H' : 'h')
  }

  // The snow along the shore, then the frozen lake, its near edge lighter
  for (let c = 0; c < w; c++) {
    for (let r = sky; r < sky + bank; r++) set(r, c, r === sky ? 'S' : 's')
    for (let r = sky + bank; r < h; r++) set(r, c, r === sky + bank ? 'J' : 'I')
  }

  // A few slim pines at the sides, standing on the snow
  const stand = (sprite: string[], centre: number) => {
    if (sprite.length > sky) sprite = sprite.slice(sprite.length - sky)
    draw(g, sky + 1 - sprite.length, centre - (sprite[0]!.length >> 1), sprite)
  }
  const big = sky >= 12 ? TALL_PINE : SMALL_PINE
  stand(big, 3)
  stand(big, w - 4)
  if (w >= 40) {
    stand(SMALL_PINE, 8)
    stand(SMALL_PINE, w - 9)
  }

  // Room for a cabin when the band is tall enough
  const cabin: [number, number] | null = w >= 40 && h >= 14 ? [sky + 1 - CABIN.length, Math.floor(w * 0.64)] : null
  if (cabin) draw(g, cabin[0], cabin[1], CABIN)

  const made = { base: g, sky, hem: sky - hills - 2, cabin }
  layouts.set(key, made)
  return made
}

// ---------------------------------------------------------------- the lights

// Two curtains: a far one higher up and fainter, a near one lower and brighter.
// Each lights its own columns, so their rays fall between each other
const CURTAINS = [
  { lift: 3, bright: 0.6, phase: 2.1, span: 0.7, seed: 17 },
  { lift: 0, bright: 1, phase: 0, span: 1.1, seed: 3 },
]

// Light the empty sky with rays; returns how strong the near curtain is over each column, for the lake
function lights(g: Grid, base: Grid, s: Scene, hem: number): number[] {
  const w = g[0]!.length
  const t = s.tick
  const power = s.isUpset ? 0.45 : s.isHappy ? 1.25 : s.isWorking ? 1.15 : s.isAsleep ? 0.8 : 1
  const pace = s.isWorking ? 2 : s.isAsleep ? 0.6 : 1 // how fast the rays flicker
  const ripple = s.spin > 0 ? (((s.spin - 1) % 9) / 8) * w : -99
  const near: number[] = Array<number>(w).fill(0)
  const tall = Math.max(2, hem)

  for (const { lift, bright, phase, span, seed } of CURTAINS) {
    const fade = 0.75 + 0.25 * Math.sin(t / 45 + phase) // the curtain waxes and wanes
    let lastRay = -2
    for (let c = 0; c < w; c++) {
      const h = hash(c * 31 + seed)
      // Most columns stay dark: a ray in about one of every two or three
      if (h % 8 < 5) continue
      // Where along the sky the curtain hangs, drifting over a minute or so
      const reach = 0.25 + 0.375 * (1 + Math.sin((c / w) * Math.PI * 2 * span + t / 150 + phase))
      // Each ray flickers on its own beat
      const flicker = 0.55 + 0.45 * Math.sin((t * pace) / (5 + (h % 7)) + (h % 100))
      const own = 0.4 + 0.6 * (((h >>> 8) % 100) / 100)
      const rip = 0.4 * Math.exp(-(((c - ripple) / 5) ** 2))
      const strength = Math.min(1, reach * flicker * own * fade * bright * power * 1.5 + rip)
      if (strength < 0.25) continue
      if (lift === 0) near[c] = strength
      // Hanging from a slowly waving hem
      const bottom = Math.round(hem - lift - 1.2 * (0.5 + 0.5 * Math.sin(c / 9 + t / 40 + phase)) - 0.6 * Math.sin(c / 4 - t / 30))
      const length = Math.round(1 + strength * (tall - lift))
      // Short rays side by side read as a blob: keep a gap unless both are strong
      if (length < 3 || (c - lastRay === 1 && strength < 0.7)) continue
      lastRay = c
      for (let j = 0; j < length; j++) {
        const r = bottom - j
        if (r < 0 || base[r]?.[c] !== '.') continue
        // Brightest just above the hem, fading upward
        const glow = strength * 3 * (1 - j / length)
        const p = glow >= 2.1 ? 'e' : glow >= 1.4 ? 'a' : glow >= 0.8 ? 'n' : glow >= 0.35 ? 'u' : ''
        if (p && (g[r]![c] === '.' || 'unae'.indexOf(g[r]![c]!) < 'unae'.indexOf(p))) g[r]![c] = p
        // A faint violet tint on the tips of the tallest rays; when Claude is done, pink and violet run further down
        else if (!p && j === length - 1 && length >= 6 && g[r]![c] === '.') g[r]![c] = 'v'
        if (s.isHappy && length >= 4 && j >= length - 3 && base[r]?.[c] === '.') g[r]![c] = j === length - 1 ? 'p' : j === length - 2 ? 'w' : 'v'
      }
    }
  }
  return near
}

// A shooting star `u` ticks into its fall, from a place picked by `seed`
function shootingStar(g: Grid, base: Grid, seed: number, u: number) {
  const w = g[0]!.length
  const h = hash(seed)
  const x0 = Math.round(w * (0.3 + (h % 50) / 100))
  const y0 = (h >>> 8) % 3
  const head = x0 - 2 * u
  ;['X', 'X', 'X', 'x', 'x', 'x', 'q', 'q'].forEach((p, k) => {
    const c = head + k
    const r = y0 + Math.floor((x0 - c) / 4)
    if (c <= x0 && base[r]?.[c] === '.') g[r]![c] = p
  })
}

// ---------------------------------------------------------------- the picture

function picture(s: Scene, w: number, h: number): string[] {
  const { base, sky, hem, cabin } = layout(w, h)
  const g = base.map(r => r.slice())
  const t = s.tick

  const near = lights(g, base, s, hem)

  // Stars in the dark between the rays, a few twinkling
  for (let i = 0; i < w / 5; i++) {
    const c = hash(i * 41 + 3) % w
    const r = hash(i * 43 + 5) % Math.max(1, sky - 2)
    if (g[r]?.[c] === '.') g[r]![c] = (Math.floor(t / 8) + i) % 5 === 0 ? 'x' : 'X'
  }

  // A shooting star now and then, and one for each message or tool call
  const fall = t % 280
  const start = 40 + (hash(Math.floor(t / 280)) % 200)
  if (fall >= start && fall < start + 10) shootingStar(g, base, Math.floor(t / 280) * 7 + 1, fall - start)
  if (s.spin > 0) shootingStar(g, base, t - s.spin, s.spin)

  // Something went wrong: a lumpy grey overcast drifts over the lights
  if (s.isUpset) {
    for (let c = 0; c < w; c++) {
      const edge = Math.round(sky / 4 + 1.2 * Math.sin(c / 6 + t / 25) + 0.7 * Math.sin(c / 2.5 - t / 15))
      for (let r = 0; r <= edge; r++) if (base[r]?.[c] === '.') g[r]![c] = r < edge - 1 ? 'C' : 'c'
    }
  }

  // Smoke curling up from the cabin's chimney
  if (cabin) {
    for (let k = 0; k < 3; k++) {
      const age = (Math.floor(t / 6) + k * 3) % 9
      const r = cabin[0] - 1 - age
      const c = cabin[1] + CHIMNEY + Math.floor(age / 3) + Math.round(0.6 * Math.sin((t + k * 9) / 10))
      if (r >= 0 && c >= 0 && c < w && base[r]![c] === '.') g[r]![c] = age < 4 ? 'm' : 'q'
    }
  }

  // A reindeer or an arctic fox wanders along the snow now and then
  const period = 900 + w
  const k = Math.floor(t / period)
  const hk = hash(k + 5)
  const u = (t % period) - (100 + (hk % 300))
  if (u >= 0 && sky >= 4) {
    const fox = k % 2 === 1
    const dir: 1 | -1 = (hk >>> 3) & 1 ? 1 : -1
    const frames = fox ? FOX : REINDEER
    const width = frames[0]![0]!.length
    // The reindeer ambles and stops a while to look up at the lights; the fox trots
    const stop = Math.floor(w * 0.3)
    const pause = dir === 1 ? stop + width : w - stop
    let along = fox ? u : Math.floor(u / 3)
    let still = false
    if (!fox && along >= pause) {
      still = u - 3 * pause < 80
      along = still ? pause : Math.floor((u - 80) / 3)
    }
    if (along <= w + width) {
      const sprite = mirror(frames[still ? 0 : Math.floor(along / (fox ? 2 : 1)) % 2] as string[], dir)
      draw(g, sky - sprite.length + 1, dir === 1 ? along - width : w - along, sprite)
    }
  }

  // A few dim streaks of the lights on the ice
  for (let c = 0; c < w; c++) {
    const strength = near[c] as number
    if (strength < 0.5) continue
    for (let r = sky; r < h; r++) {
      if (!'IJ'.includes(g[r]![c]!) || Math.sin(c * 0.7 + r * 2.1 + t / 7) < 0.2) continue
      g[r]![c] = strength > 0.85 && g[r]![c] === 'J' ? 'U' : 'Z'
    }
  }

  // ...and snow falls
  if (s.isUpset) {
    for (let i = 0; i < w / 3; i++) {
      const r = ((hash(i) % h) + Math.floor(t / 3)) % h
      const c = (hash(i * 7 + 1) % w) + Math.round(1.5 * Math.sin((t + i * 13) / 12))
      if (c >= 0 && c < w) g[r]![c] = 'W'
    }
  }

  return g.map(r => r.join(''))
}

// ---------------------------------------------------------------- the character

const PX = 6
const CELL = 8
const GROUND = '._.-._..-_.'

export const aurora: Character = {
  width: 0,
  canMunch: false,
  rolls: true,
  stride: 0,
  pace: 1,
  snackLane: 0,
  chases: false,

  terminal(s, cols, rows) {
    // A shorter band gives up landscape first (see `bands`), never squeezing pixels
    const h = Math.max(2, Math.min(FULL, rows - (rows % 2)))
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[i % GROUND.length]
    return { rows: halfBlocks(picture(s, cols, h), 0, cols, h, COLOURS), ground, groundColor: 'white', offset: s.x }
  },

  svg(s, cols) {
    const w = cols * CELL
    const h = FULL * PX
    return (
      svgOpen(w, h) +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="#0b1226"/>` +
      pixels(picture(s, Math.floor(w / PX), FULL), 0, 0, PX, COLOURS) +
      '</svg>'
    )
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
