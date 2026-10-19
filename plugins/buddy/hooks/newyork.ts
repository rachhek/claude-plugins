import type { Scene } from '../types'
import { blank, city, clearSky, dot, draw, hash, outlined, rect, sliver, windowsIn } from './city'
import type { Grid, Layout } from './city'

// New York: Midtown from the East River. The Empire State Building with its
// spire, the Chrysler Building's stepped crown, glass towers, brick walk-ups
// with wooden water towers on their roofs, a tower of the Brooklyn Bridge at
// one side and the Statue of Liberty small at the other. Yellow taxis run
// along the riverside drive (a stream of them while Claude works, with a
// helicopter overhead), steam rises from a manhole, and at night thousands of
// windows twinkle on and off.
//
// Pixels: E outline, e Empire State stone, S s Chrysler steel (and its shade),
// o stone towers, g G glass (and its light), b brick, w windows, T t water tank
// (and its bands), r its roof, k dark (wheels, antennas), K arches, q Q bridge stone (and its shade), c cables,
// L l Liberty's copper green (and its light), F torch flame, Y taxi, n taxi
// glass, d road, D lane marks, v V river (and ripples), p P steam (and thinning), H helicopter

const H = 20
const BASE = 15 // the city stands on row 15
const ROAD = 16 // the riverside drive
const WATER = 17 // the East River, rows 17 to 19

const DAY = {
  E: '#18191e', e: '#cdc4ae', S: '#d8dde4', s: '#a4acb8', o: '#b3a690', g: '#5f86b0', G: '#9cc0e0',
  b: '#a0583e', w: '#2f3a4c', T: '#8a5a36', k: '#2a2a30', q: '#b9ab90', Q: '#8e8270', c: '#b8c0c8', K: '#1c1d22', r: '#6a6460', t: '#6a4428',
  L: '#5fae9a', l: '#8fd4c0', F: '#ffcf4a', Y: '#f5c518', n: '#7fa8c8', d: '#3a3b40', D: '#d8d4c0',
  v: '#2f5f86', V: '#7fb0d8', p: '#e4e8ec', P: '#9aa0a8', H: '#c8443a',
}
const NIGHT = {
  ...DAY,
  E: '#0a0b0e', e: '#3a372f', S: '#5a6068', s: '#3c424a', o: '#34302a', g: '#1c2a3c', G: '#2a3e56',
  b: '#3a2a24', w: '#141820', T: '#2e2018', k: '#101014', q: '#3e3a30', Q: '#2e2a22', c: '#4a5058', K: '#0c0c10', r: '#2a2826', t: '#24180f',
  L: '#2a5a4e', l: '#3c7a68', F: '#ffcf4a', Y: '#c8a018', n: '#ffe9a0', d: '#1a1b1e', D: '#5a584e',
  v: '#121e30', V: '#d8b24a', p: '#7a7e84', P: '#4a4e54', H: '#7a2a24',
}

const EMPIRE = outlined([
  '....k....',
  '....e....',
  '....e....',
  '...eGe...',
  '...eee...',
  '..eeeee..',
  '..ewewe..',
  '.eeeeeee.',
  '.ewewewe.',
  '.ewewewe.',
  '.ewewewe.',
  '.ewewewe.',
  'eeeeeeeee',
  'ewewewewe',
  'ewewewewe',
  'ewewewewe',
])

const CHRYSLER = outlined([
  '....k....',
  '....S....',
  '....S....',
  '...SSS...',
  '...SkS...',
  '..SSSSS..',
  '..SkSkS..',
  '.SSSSSSS.',
  '.SkSkSkS.',
  '.sssssss.',
  '.swswsws.',
  '.swswsws.',
  '.swswsws.',
  '.swswsws.',
  '.swswsws.',
  '.swswsws.',
])

const WATER_TOWER = outlined(['..r..', '.rrr.', 'TTTTT', 'TtTtT', 'TTTTT', 'r.r.r'])

// A tower of the Brooklyn Bridge: stone, two pointed arches, standing in the river
const BRIDGE_TOWER = outlined([
  'qqqqqqqqq',
  'qQQQQQQQq',
  'qqqqqqqqq',
  'qqKqqqKqq',
  'qKKKqKKKq',
  'qKKKqKKKq',
  'qKKKqKKKq',
  'qKKKqKKKq',
  'qKKKqKKKq',
  'qqqqqqqqq',
  'qqqqqqqqq',
  'qQqqqqqQq',
  'qqqqqqqqq',
  'QQQQQQQQQ',
  'QQQQQQQQQ',
])

// The Statue of Liberty on her pedestal, torch held high
const LIBERTY = outlined([
  '.F.....',
  '.L.....',
  '.L.lll.',
  '.LLLLL.',
  '..LLL..',
  '..LLLL.',
  '..LLlL.',
  '..LLL..',
  '.LLLLL.',
  '.qqqqq.',
  '.qQqQq.',
  '.qqqqq.',
  'qqqqqqq',
  'qqqqqqq',
])

// A yellow cab, facing right, two frames of wheels
const TAXI = [
  outlined(['...YY...', '..YnnY..', 'YYYYYYYY', 'YkYYYYkY']),
  outlined(['...YY...', '..YnnY..', 'YYYYYYYY', 'kYYYYYYk']),
]

const HELI = [
  ['ccccccc..', '...c.....', '.HHHH....', 'HnHHHcccc', '.HHHH....', '.c..c....'],
  ['..ccc....', '...c.....', '.HHHH....', 'HnHHHcccc', '.HHHH....', '.c..c....'],
]

const REACH = 18 // how far the bridge's cables reach from its tower

const PUFF = [['.p.'], ['pp.'], ['.p.', 'ppp'], ['P.P']]

type NewYork = Layout & { manholes: number[] }

function layout(w: number): NewYork {
  const g = blank(H, w)
  const front = blank(H, w)
  const windows: number[] = []
  const at = (f: number) => Math.round(w * f)

  const bridge = w >= 60 ? at(0.06) + 2 : -99
  const empire = at(0.42)
  const chrysler = at(0.6)
  const liberty = w >= 60 ? at(0.95) : -99

  const half = (sprite: string[]) => sprite[0]!.length >> 1
  const spans: [number, number][] = [
    [empire - half(EMPIRE), empire + half(EMPIRE)],
    [chrysler - half(CHRYSLER), chrysler + half(CHRYSLER)],
  ]

  // Blocks of every kind: glass towers, stone towers, brick walk-ups with water tanks
  const tanks: [number, number][] = []
  for (let x = bridge > 0 ? bridge + REACH - 3 : -2, i = 0; x < w; i++) {
    const width = 5 + 2 * (hash(i * 7 + w) % 4)
    const mid = x + (width >> 1)
    const kind = hash(i * 13 + 5) % 3 // 0 glass, 1 stone, 2 brick
    let top = kind === 2 ? 9 + (hash(i * 3) % 3) : 2 + (hash(i * 11 + 3) % 6)
    if (Math.abs(mid - empire) < 9 || Math.abs(mid - chrysler) < 7) top = Math.max(top, 6 + (hash(i) % 3))
    if (liberty > 0 && mid > liberty - 8) top = Math.max(top, 9)
    const right = x + width - 1
    if (sliver(x, right, spans)) {
      x += width - 1
      continue
    }
    rect(g, top, x, BASE, right, 'E')
    if (kind === 0) {
      // Glass: a light edge down one side and a grid of panes
      rect(g, top + 1, x + 1, BASE, right - 1, 'g')
      windowsIn(g, windows, w, top + 2, x + 2, BASE - 1, right - 2, 'w')
      for (let r = top + 1; r <= BASE; r++) dot(g, r, x + 1, 'G')
      if (top < 5) dot(g, top - 1, mid, 'k')
    } else {
      rect(g, top + 1, x + 1, BASE, right - 1, kind === 1 ? 'o' : 'b')
      windowsIn(g, windows, w, top + 2, x + 2, BASE - 1, right - 2, 'w')
      if (kind === 2 && width >= 7) tanks.push([top, x + 1 + (hash(i) % (width - 5))])
    }
    x += width - 1
  }
  for (const [top, c] of tanks) draw(g, top - WATER_TOWER.length, c, WATER_TOWER)

  draw(g, BASE + 1 - EMPIRE.length, empire - (EMPIRE[0]!.length >> 1), EMPIRE)
  draw(g, BASE + 1 - CHRYSLER.length, chrysler - (CHRYSLER[0]!.length >> 1), CHRYSLER)
  // Their windows light up too
  for (const [sprite, centre] of [[EMPIRE, empire], [CHRYSLER, chrysler]] as const) {
    const top = BASE + 1 - sprite.length
    const left = centre - (sprite[0]!.length >> 1)
    sprite.forEach((line, r) => [...line].forEach((p, c) => p === 'w' && left + c >= 0 && left + c < w && windows.push((top + r) * w + left + c)))
  }

  // The drive along the river, and the river
  for (let c = 0; c < w; c++) {
    dot(g, ROAD, c, c % 6 < 3 && c % 12 < 6 ? 'D' : 'd')
    for (let r = WATER; r < H; r++) dot(g, r, c, 'v')
  }

  // The Brooklyn Bridge: a tower in the river, the deck, and its cables sweeping down either side
  if (bridge > 0) {
    const tw = BRIDGE_TOWER[0]!.length
    const top = H - BRIDGE_TOWER.length
    const deck = top + 9
    for (let c = 0; c < bridge + REACH; c++) {
      dot(front, deck, c, 'Q')
      dot(front, deck - 1, c, 'E')
    }
    for (const side of [-1, 1]) {
      for (let d = tw >> 1; d < REACH; d++) {
        const c = bridge + side * d
        const r = Math.min(deck - 2, top + 1 + Math.round((1 - (1 - (d - (tw >> 1)) / (REACH - (tw >> 1))) ** 2) * (deck - top - 2)))
        dot(front, r, c, 'c')
        if (d % 3 === 0) for (let k = r + 1; k < deck - 1; k++) dot(front, k, c, 'c')
      }
    }
    draw(front, top, bridge - (tw >> 1), BRIDGE_TOWER)
    // The roadway runs through the arches
    for (let c = bridge - (tw >> 1) + 1; c < bridge + (tw >> 1); c++) dot(front, deck, c, 'Q')
  }

  // Liberty on her island
  if (liberty > 0) {
    for (let c = liberty - 6; c <= liberty + 6; c++) dot(front, WATER, c, c === liberty - 6 || c === liberty + 6 ? 'E' : 'L')
    draw(front, WATER - LIBERTY.length, liberty - (LIBERTY[0]!.length >> 1), LIBERTY)
  }

  // Pigeons on rooftops
  const perches: [number, number][] = []
  for (let c = 3; c < w - 4 && perches.length < (w >= 100 ? 3 : 2); c += 5) {
    const top = g.findIndex(row => row[c] !== '.')
    const clear = (r: number, j: number) => g[r]?.[c + j] === '.' && front[r]?.[c + j] === '.'
    if (top < 4 || top > 11) continue
    if ([0, 1, 2, 3].some(j => g[top]![c + j] !== 'E' || !clear(top - 1, j) || !clear(top - 2, j) || front[top]![c + j] !== '.')) continue
    perches.push([c, top - 2])
    c += 22
  }

  const manholes = [at(0.3), at(0.7)]
  return { back: g, front, windows, perches, moon: clearSky(g, w, front), manholes }
}

function behind(g: Grid, s: Scene, l: NewYork, w: number) {
  const t = s.tick
  // Ripples on the river
  for (let c = 0; c < w; c++) {
    const r = WATER + (hash(c * 5) % 3)
    if ((hash(c * 3) + Math.floor(t / 8)) % 9 === 0) dot(g, r, c, 'V')
  }

  // Steam from the manholes: puffs that swell as they rise, drift and thin out
  l.manholes.forEach((c, i) => {
    dot(g, ROAD, c, 'k')
    for (let j = 0; j < 3; j++) {
      const v = (t + j * 8 + i * 11) % 24
      const r = ROAD - 1 - Math.floor(v / 3)
      const x = c + Math.floor(v / 8) + Math.round(Math.sin((t + j * 7) / 5) * 0.6)
      draw(g, r, x - 1, PUFF[Math.floor(v / 6)] as string[])
    }
  })

  // Taxis along the drive: now and then, a stream of them while Claude works
  const gap = s.isWorking ? 18 : 90
  const L = TAXI[0]![0]!.length
  const lane = w + L + gap
  for (let k = 0; k * gap < lane; k++) {
    const id = Math.floor((t + k * gap) / lane)
    if (!s.isWorking && hash(id * 3 + k) % 3) continue
    const x = ((t + k * gap) % lane) - L
    const sprite = TAXI[Math.floor(t / 2) % 2] as string[]
    draw(g, ROAD + 1 - sprite.length, x, sprite)
  }

  // A helicopter crosses now and then, more often while Claude works
  const period = (s.isWorking ? 200 : 700) + w
  const u = (t % period) - 40
  if (u >= 0 && u < w + 12) {
    const sprite = HELI[t % 2] as string[]
    draw(g, 2 + Math.round(Math.sin(t / 9)), w - u, sprite)
  }
}

export const newyork = city({
  H,
  day: DAY,
  night: NIGHT,
  nightSky: '#141a2e',
  layout,
  behind,
  lit: 0.55,
  twinkle: 40,
  ground: '_ _ _  ',
  groundColor: 'gray',
})
