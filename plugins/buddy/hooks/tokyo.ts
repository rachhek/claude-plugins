import type { Scene } from '../types'
import { blank, city, clearSky, dot, draw, hash, outlined, rect, sliver, tree, windowsIn } from './city'
import type { Grid, Layout } from './city'

// Tokyo: Tokyo Tower and the Skytree over a crowd of office blocks, Mount Fuji
// faint behind, an elevated line across the city, and in front a temple gate
// with its big lantern, a five-storey pagoda and cherry trees dropping petals.
// A bullet train glides along the viaduct now and then, more often while
// Claude works; at night the windows light up and the neon signs flicker on.
//
// Pixels: E outline, f Fuji, F Fuji's snow, b far blocks, g j o office walls,
// w windows, R tower red, r red shade, W white, k roof tiles, K dark, L lantern,
// P p O blossom (and its shade and light), T trunk, v viaduct, V its girder,
// q pavement, B train stripe, N Z U neon (pink, cyan, violet), y spire gold

const H = 20
const STREET = H - 1 // pavement along the bottom
const DECK = 16 // the viaduct's deck, rows 16 and 17, on piers

const DAY = {
  E: '#1b1d24', f: '#6f7f9e', F: '#d9e2ee', b: '#4a5266', g: '#a3abb5', j: '#7f93ab', o: '#bfb29c',
  w: '#3c4d63', R: '#e0482e', r: '#b23422', W: '#f2efe8', k: '#5d6870', K: '#22232a', L: '#d8402e',
  P: '#f2a7c3', p: '#d77fa2', O: '#fbd6e4', T: '#6b4630', v: '#b4b2ac', V: '#85837e', q: '#8d8a84',
  B: '#2f62c4', N: '#b0607e', Z: '#5f99a6', U: '#7f6aa8', y: '#c9a24a', s: '#cfd8e2',
}
const NIGHT = {
  ...DAY,
  E: '#0b0c10', f: '#2b3350', F: '#59627e', b: '#1d2230', g: '#30353f', j: '#2a3242', o: '#38342e',
  w: '#1a1f2a', R: '#a83a26', r: '#7e2a1c', W: '#d8cfb8', k: '#3a3f4a', L: '#ff7a4a', P: '#8c5a70',
  p: '#6c4256', O: '#a87a8e', T: '#3b281c', v: '#4a4945', V: '#34332f', q: '#3a3936', B: '#2a4a8a',
  N: '#ff4fa8', Z: '#3ff0ff', U: '#b77bff', y: '#9a7a3a', s: '#7a8494',
}

// The towers, gate and pagoda, drawn upright and symmetric
const TOWER = outlined([
  '......W......',
  '......R......',
  '......W......',
  '......R......',
  '.....RWR.....',
  '.....WWW.....',
  '.....RrR.....',
  '.....RrR.....',
  '....RRrRR....',
  '....RrRrR....',
  '...WWWWWWW...',
  '...WKWKWKW...',
  '...RrRrRrR...',
  '...RR...RR...',
  '..WWw...wWW..',
  '..RR.....RR..',
  '.RRr.....rRR.',
  'RRr.......rRR',
])

const SKYTREE = outlined([
  '...K...',
  '...K...',
  '...s...',
  '...s...',
  '..sKs..',
  '...s...',
  '...s...',
  '..sss..',
  '.sKKKs.',
  '..sss..',
  '..sss..',
  '..sss..',
  '..sss..',
  '..sss..',
  '.sssss.',
  '.ss.ss.',
  'ss...ss',
  's.....s',
])

const GATE = outlined([
  'k...................k',
  'kkkkkkkkkkkkkkkkkkkkk',
  '.kkkkkkkkkkkkkkkkkkk.',
  '..RRRRRRRRRRRRRRRRR..',
  '..RR......K......RR..',
  '..RR.....LLL.....RR..',
  '..RR....LLLLL....RR..',
  '..RR....LLLLL....RR..',
  '..RR.....KKK.....RR..',
  '..RR.............RR..',
])

// Five storeys of red wall under wide roofs with upturned corners, a gold spire on top
function pagoda(): string[] {
  const W = 15
  const line = (n: number, p: string) => '.'.repeat((W - n) / 2) + p.repeat(n) + '.'.repeat((W - n) / 2)
  const rows = [line(1, 'y'), line(1, 'y'), line(3, 'y'), line(1, 'y')]
  const eaves = [9, 11, 11, 13, 15]
  const walls = [3, 5, 5, 5, 7]
  eaves.forEach((n, i) => {
    // The roof's corners turn up beside the wall above
    const tips = rows[rows.length - 1]!.split('')
    tips[(W - n) / 2] = 'k'
    tips[(W + n) / 2 - 1] = 'k'
    rows[rows.length - 1] = tips.join('')
    rows.push('.'.repeat((W - n) / 2 + 1) + 'k'.repeat(n - 2) + '.'.repeat((W - n) / 2 + 1))
    rows.push(line(walls[i] as number, 'R'))
  })
  return rows
}
const PAGODA = pagoda()

const CHERRY = tree([5, 9, 11, 11, 11, 9, 5], 3, 'P', 'p', 'O', 'T')

// The bullet train: three white cars with a blue stripe, a long nose at each end
function train(cars: number): string[] {
  const len = cars * 16
  const rows = ['', '', '', '']
  for (let c = 0; c < len; c++) {
    const end = Math.min(c, len - 1 - c) // distance from the nearer tip
    const gap = c % 16 === 0 && c > 0
    rows[0] += end < 9 ? '.' : gap ? 'E' : 'W'
    rows[1] += end < 6 ? '.' : end < 9 ? (end === 6 ? 'W' : 'K') : gap ? 'E' : c % 3 === 0 ? 'K' : 'W'
    rows[2] += end < 3 ? '.' : gap ? 'E' : 'B'
    rows[3] += gap ? 'E' : 'W'
  }
  return outlined(rows)
}
const TRAIN = train(3)

type Tokyo = Layout & { neon: [number, number, string][] }

function layout(w: number): Tokyo {
  const g = blank(H, w)
  const front = blank(H, w)
  const windows: number[] = []
  const neon: [number, number, string][] = []
  const at = (f: number) => Math.round(w * f)

  // The landmarks' centres: Fuji peeks over the temple gate
  const tower = at(0.17)
  const fuji = at(0.5)
  const gate = at(0.5)
  const pagoda = at(0.66)
  const skytree = at(0.85)

  // Mount Fuji, faint on the horizon: a flat summit, slopes that flatten out, a snow cap
  for (let d = 0; d + 4 < H; d++) {
    const half = 2 + Math.round(d * 1.2 + d * d * 0.1)
    for (let c = fuji - half; c <= fuji + half; c++) {
      const snow = d < 2 || (d === 2 && (c - fuji + 40) % 3 !== 0) || (d === 3 && (c - fuji + 40) % 3 === 1)
      dot(g, 4 + d, c, snow ? 'F' : 'f')
    }
  }

  // Low blocks far off
  for (let x = -3, i = 0; x < w; i++) {
    const width = 5 + (hash(i * 3 + 1) % 6)
    const top = 11 + (hash(i * 5 + 2) % 3)
    rect(g, top + (Math.abs(x - fuji) < 14 ? 2 : 0), x, H - 1, x + width - 1, 'b')
    x += width
  }

  const half = (sprite: string[]) => sprite[0]!.length >> 1
  const spans: [number, number][] = [
    [tower - half(TOWER), tower + half(TOWER)],
    [skytree - half(SKYTREE), skytree + half(SKYTREE)],
    [pagoda - half(PAGODA), pagoda + half(PAGODA)],
  ]

  // Office blocks, tall towers among low ones, kept low round the landmarks so they show
  for (let x = -2, i = 0; x < w; i++) {
    const width = 7 + 2 * (hash(i * 7 + w) % 3)
    const mid = x + (width >> 1)
    const near = (c: number, d: number) => Math.abs(mid - c) < d
    let top = hash(i * 11 + 3) % 3 ? 2 + (hash(i * 5) % 5) : 8 + (hash(i * 5) % 3)
    if (near(tower, 9) || near(skytree, 6) || near(pagoda, 9)) top = Math.max(top, 9 + (hash(i) % 3))
    if (near(fuji, 9)) top = 12
    const wall = 'gjo'[hash(i * 13 + 5) % 3] as string
    if (sliver(x, x + width - 1, spans)) {
      x += width - 1
      continue
    }
    rect(g, top, x, H - 1, x + width - 1, 'E')
    rect(g, top + 1, x + 1, H - 1, x + width - 2, wall)
    windowsIn(g, windows, w, top + 2, x + 2, H - 2, x + width - 3, 'w')
    // A red light on the roof of the tall ones
    if (top < 6) dot(g, top - 1, mid, 'R')
    // A neon sign down one side of some blocks
    if (hash(i * 17 + 9) % 2 === 0 && top < 11) {
      const c = hash(i) % 2 ? x + 1 : x + width - 2
      const p = 'NZU'[hash(i * 19) % 3] as string
      for (let r = top + 2; r < top + 6; r++) neon.push([r, c, p])
    }
    x += width - 1
  }
  for (const [r, c, p] of neon) dot(g, r, c, p)

  draw(g, 0, tower - (TOWER[0]!.length >> 1), TOWER)
  draw(g, 0, skytree - (SKYTREE[0]!.length >> 1), SKYTREE)
  draw(g, DECK - PAGODA.length, pagoda - (PAGODA[0]!.length >> 1), PAGODA)

  // The elevated line across the city, on piers
  for (let c = 0; c < w; c++) {
    dot(g, DECK, c, 'v')
    dot(g, DECK + 1, c, 'V')
    if (c % 14 === 3 || c % 14 === 4) for (let r = DECK + 2; r < STREET; r++) dot(g, r, c, c % 14 === 3 ? 'v' : 'V')
    dot(g, STREET, c, 'q')
  }

  // In front: the temple gate and cherry trees
  const place = (sprite: string[], centre: number) => draw(front, STREET - sprite.length, centre - (sprite[0]!.length >> 1), sprite)
  place(GATE, gate)
  place(CHERRY, at(0.02))
  place(CHERRY, at(0.98))
  if (w >= 110) place(CHERRY, at(0.33))

  // Pigeons on flat rooftops that are still clear
  const perches: [number, number][] = []
  for (let c = 4; c < w - 4 && perches.length < (w >= 100 ? 3 : 2); c += 5) {
    const top = g.findIndex(row => row[c] !== '.')
    const clear = (r: number, j: number) => g[r]?.[c + j] === '.' && front[r]?.[c + j] === '.'
    if (top < 3 || top > 12) continue
    if ([0, 1, 2, 3].some(j => g[top]![c + j] !== 'E' || !clear(top - 1, j) || !clear(top - 2, j) || front[top]![c + j] !== '.')) continue
    perches.push([c, top - 2])
    c += 20
  }

  return { back: g, front, windows, perches, moon: clearSky(g, w, front), neon }
}

function behind(g: Grid, s: Scene, l: Tokyo, w: number) {
  const t = s.tick
  // Neon flickers at night
  if (s.isAsleep)
    l.neon.forEach(([r, c], i) => {
      if (hash(i * 3 + Math.floor(t / 6)) % 23 === 0) dot(g, r, c, 'w')
    })

  // The bullet train: a fast pass now and then, more often while Claude works
  const L = TRAIN[0]!.length
  const period = s.isWorking ? 60 + Math.ceil((w + L) / 3) : 420 + w
  const k = Math.floor(t / period)
  const u = (t % period) - (s.isWorking ? 30 : 60 + (hash(k) % 200))
  if (u >= 0 && u * 3 < w + L) {
    const x = hash(k * 7 + 3) % 2 ? u * 3 - L : w - u * 3
    draw(g, DECK - TRAIN.length, x, TRAIN)
  }
}

function over(g: Grid, s: Scene, l: Tokyo, w: number) {
  const t = s.tick
  // Petals drifting down and along on the breeze
  const n = Math.max(3, Math.round(w / 14))
  for (let i = 0; i < n; i++) {
    const h = hash(i * 29 + 7)
    const life = 60 + (h % 40)
    const v = (t + (h >>> 8)) % life
    const r = 4 + Math.floor((v * (STREET - 5)) / life)
    const c = (h >>> 3) % w + Math.floor(v / 2) + Math.round(Math.sin((t + i * 9) / 5))
    dot(g, r, c % w, i % 3 ? 'O' : 'P')
  }
  void l
}

export const tokyo = city({
  H,
  day: DAY,
  night: NIGHT,
  nightSky: '#141a2e',
  layout,
  behind,
  over,
  lit: 0.45,
  twinkle: 300,
  ground: '-- -- -- ',
  groundColor: 'gray',
})
