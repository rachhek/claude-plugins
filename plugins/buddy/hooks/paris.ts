import type { Scene } from '../types'
import { blank, city, clearSky, dot, draw, hash, outlined, rect, sliver, tree, windowsIn } from './city'
import type { Grid, Layout } from './city'

// Paris: the Eiffel Tower over the Champ de Mars, rows of cream Haussmann
// buildings under grey-blue zinc roofs and chimney pots, Notre-Dame's twin
// towers, and the Seine along the bottom with a stone bridge. A tour boat
// glides along the river now and then (more of them while Claude works, with a
// cyclist on the quay) and a hot-air balloon drifts over sometimes. At night
// the windows glow warm and the street lamps come on; the tower is a dark
// shape, softly lit.
//
// Pixels: E outline, I i tower (and its shade), C cream stone, Z z zinc roof
// (and its shade), w windows, k iron (balconies, lamp posts), h chimney pots,
// A a awnings (red, green), N n Notre-Dame stone (and its shade), U X rose
// window, K dark doorways, G g H trees (leaf, shade, light), T trunk, Q q quay
// stone (and its joints), v V water (and ripples), W white, B boat hull, l lamp,
// L balloon, Y balloon stripe, P bicycle rider

const H = 20
const BASE = 15 // the city stands on row 15
const QUAY = 16 // the stone quay
const WATER = 17 // the Seine, rows 17 to 19

const DAY = {
  E: '#1d1b1f', I: '#8c7a66', i: '#66574a', C: '#e3d5b6', Z: '#8fa0b6', z: '#6c7c92', w: '#4a4f5e',
  k: '#2c2a30', h: '#c07250', A: '#c8463c', a: '#3f8a5a', N: '#cfc6b2', n: '#a59c88', U: '#4a62c8', X: '#c84a5a',
  K: '#2a2629', G: '#5d9a48', g: '#447a38', H: '#86c060', T: '#6e4a32', Q: '#b8ab92', q: '#968a74',
  v: '#3d6a9a', V: '#7fb0d8', W: '#f2efe8', B: '#2c4f86', l: '#cfc8b0', L: '#e05a4a', Y: '#f2d24b', P: '#d0503e',
}
const NIGHT = {
  ...DAY,
  E: '#0c0b0e', I: '#7a5a34', i: '#5a4226', C: '#3a352c', Z: '#2c3442', z: '#232a36', w: '#1c1d24',
  k: '#121114', h: '#4a3022', A: '#5a2a26', a: '#22402c', N: '#4a463e', n: '#38352e', U: '#2a3470', X: '#6a2a34',
  K: '#0e0d0f', G: '#1f3d22', g: '#18301b', H: '#2a4a2a', T: '#2a1e16', Q: '#4a4436', q: '#38332a',
  v: '#16263c', V: '#c9a24a', W: '#d8d0bc', B: '#1c2c48', l: '#ffd27a', P: '#7a3026'
}

// The Eiffel Tower: four legs curving in to a needle, two platforms, the great arch between the legs
function eiffel(): string[] {
  const R = 16
  const W = 19
  const mid = (W - 1) / 2
  const rows: string[] = []
  for (let r = 0; r < R; r++) {
    // How far each side reaches: a curve that sweeps out towards the ground
    let half = Math.round(8 * Math.pow(r / (R - 1), 2.8))
    if (r === 7 || r === 11) half += 1 // the platforms
    let inner = -1
    if (r >= 12) inner = [1, 3, 4, 5][r - 12] as number // the arch
    let line = ''
    for (let c = 0; c < W; c++) {
      const d = Math.abs(c - mid)
      if (d > half || d <= inner) line += '.'
      else if (r === 7 || r === 11) line += 'I'
      else line += (r + c) % 2 && d < half ? 'i' : 'I'
    }
    rows.push(line)
  }
  return outlined(rows)
}
const EIFFEL = eiffel()

const NOTRE_DAME = outlined([
  '.........z.........',
  '.........z.........',
  '........zzz........',
  'NNNNNN...z...NNNNNN',
  'NKNNKN...z...NKNNKN',
  'NKNNKN..zzz..NKNNKN',
  'NKNNKN..zzz..NKNNKN',
  'NNNNNNNNNNNNNNNNNNN',
  'NnNnNnNnNnNnNnNnNnN',
  'NNNNNNNNNUNNNNNNNNN',
  'NNKNNNNNUXUNNNNNKNN',
  'NNKNNNNNNUNNNNNNKNN',
  'nnnnnnnnnnnnnnnnnnn',
  'NKKKNNNNKKKNNNNKKKN',
  'NKKKNNNNKKKNNNNKKKN',
])

const PLANE_TREE = tree([5, 7, 7, 5], 2, 'G', 'g', 'H', 'T')

// A tour boat, glass roof over a white cabin, facing right
const BOAT = outlined([
  '...wWwWwWwWwWwWwW....',
  '..WWWWWWWWWWWWWWWWW..',
  'BBBBBBBBBBBBBBBBBBBBB',
  '.BBBBBBBBBBBBBBBBBBB.',
])

const LAMP = ['klk', '.k.', '.k.']

const BALLOON = outlined(['.LYL.', 'LYLYL', 'LYLYL', '.LYL.', '..k..', '..B..'])

// A cyclist on the quay, two frames of pedalling
const BIKE = [
  ['..P.', '.PP.', 'k.k.'],
  ['..P.', '.PP.', '.k.k'],
]

type Paris = Layout & { lamps: [number, number][] }

function layout(w: number): Paris {
  const g = blank(H, w)
  const front = blank(H, w)
  const windows: number[] = []
  const lamps: [number, number][] = []
  const at = (f: number) => Math.round(w * f)

  const tower = at(0.24)
  const notre = at(0.68)
  const bridge = at(0.88)
  const towerW = EIFFEL[0]!.length
  const notreW = NOTRE_DAME[0]!.length

  // Haussmann blocks: shops under awnings, three floors of tall windows with
  // iron balconies, a zinc mansard roof with dormers and chimney pots
  for (let x = -2, i = 0; x < w; i++) {
    const width = 9 + 2 * (hash(i * 7 + w) % 3)
    const mid = x + (width >> 1)
    const nearTower = Math.abs(mid - tower) < (towerW >> 1) + (width >> 1) - 1
    const nearNotre = Math.abs(mid - notre) < (notreW >> 1) + 3
    const top = nearNotre ? 9 : 6
    const right = x + width - 1
    if (!nearTower && !sliver(x, right, [[notre - (notreW >> 1), notre + (notreW >> 1)]])) {
      rect(g, top, x, BASE, right, 'E')
      // The mansard: two rows of zinc, sloping in, with dormers
      rect(g, top + 1, x + 2, top + 1, right - 2, 'Z')
      rect(g, top + 2, x + 1, top + 2, right - 1, 'z')
      for (let c = x + 3; c <= right - 3; c += 3) dot(g, top + 1, c, 'w')
      // Chimney pots along the ridge
      for (let c = x + 2; c <= right - 2; c += 4 + (hash(c) % 3)) dot(g, top, c, 'h')
      dot(g, top, x + 1, '.')
      dot(g, top, right - 1, '.')
      dot(g, top, x, '.')
      dot(g, top, right, '.')
      dot(g, top + 1, x, '.')
      dot(g, top + 1, right, '.')
      dot(g, top + 1, x + 1, 'E')
      dot(g, top + 1, right - 1, 'E')
      // The stone front
      rect(g, top + 3, x + 1, BASE, right - 1, 'C')
      // Tall windows, two floors of them (one by Notre-Dame), with an iron balcony between
      for (let r = top + 3; r <= BASE - 2; r += 3) {
        windowsIn(g, windows, w, r, x + 2, r, right - 2, 'w')
        windowsIn(g, windows, w, r + 1, x + 2, r + 1, right - 2, 'w')
        if (r + 2 < BASE - 1) for (let c = x + 2; c <= right - 2; c++) dot(g, r + 2, c, 'k')
      }
      // A café or shop under an awning
      const awning = hash(i * 5 + 1) % 2 ? 'A' : 'a'
      for (let c = x + 2; c <= right - 2; c++) dot(g, BASE - 1, c, c % 2 ? awning : 'W')
      for (let c = x + 2; c <= right - 2; c++) dot(g, BASE, c, 'K')
    }
    x += width - 1
  }

  // The Champ de Mars: trees under the tower
  for (const d of [-8, 8]) draw(g, BASE + 1 - PLANE_TREE.length, tower + d - (PLANE_TREE[0]!.length >> 1), PLANE_TREE)
  draw(g, BASE + 1 - EIFFEL.length, tower - (towerW >> 1), EIFFEL)
  draw(g, BASE + 1 - NOTRE_DAME.length, notre - (notreW >> 1), NOTRE_DAME)

  // The quay and the river
  for (let c = 0; c < w; c++) {
    dot(g, QUAY, c, c % 6 === 0 ? 'q' : 'Q')
    for (let r = WATER; r < H; r++) dot(g, r, c, 'v')
  }
  // Lamp posts along the quay
  for (let c = 6; c < w - 2; c += 16) {
    if (Math.abs(c - bridge) < 16) continue
    draw(front, QUAY - 3, c - 1, LAMP)
    lamps.push([QUAY - 3, c])
  }

  // A stone bridge: a deck with a parapet over three arches
  const span = 27
  const left = bridge - (span >> 1)
  for (let c = 0; c < span; c++) {
    const d = c % 9 // each arch is nine wide, piers at 0 and 9
    const arch = [99, 3, 2, 1, 1, 1, 2, 3, 99][d] as number // first open row below the deck
    dot(front, QUAY - 1, left + c, 'E')
    dot(front, QUAY, left + c, 'Q')
    for (let r = QUAY + 1; r < H; r++) if (r < QUAY + arch || d === 0) dot(front, r, left + c, d === 0 ? 'Q' : 'q')
  }
  dot(front, QUAY, left + span, 'Q')
  for (let r = QUAY + 1; r < H; r++) dot(front, r, left + span, 'Q')
  for (const c of [left + 4, left + span - 4]) {
    draw(front, QUAY - 4, c - 1, LAMP)
    lamps.push([QUAY - 4, c])
  }

  // Pigeons on rooftops
  const perches: [number, number][] = []
  for (let c = 3; c < w - 4 && perches.length < (w >= 100 ? 3 : 2); c += 5) {
    const top = g.findIndex(row => row[c] !== '.')
    if (top < 4 || top > 10) continue
    if ([0, 1, 2, 3].some(j => g[top]![c + j] === '.' || g[top - 1]![c + j] !== '.' || g[top - 2]![c + j] !== '.')) continue
    perches.push([c, top - 2])
    c += 22
  }

  return { back: g, front, windows, perches, moon: clearSky(g, w, front), lamps }
}

// A boat now and then, k ticks in; null when none is on the river
function boat(t: number, w: number, period: number, seed: number): { x: number; dir: 1 | -1 } | null {
  const k = Math.floor(t / period)
  const L = BOAT[0]!.length
  const u = (t % period) - (hash(k * 3 + seed) % 100)
  if (u < 0 || u / 2 > w + L) return null
  const dir: 1 | -1 = hash(k + seed * 7) % 2 ? 1 : -1
  return { x: dir === 1 ? Math.floor(u / 2) - L : w - Math.floor(u / 2), dir }
}

function behind(g: Grid, s: Scene, _l: Paris, w: number) {
  const t = s.tick
  // Ripples on the river
  for (let c = 0; c < w; c++) {
    const r = WATER + (hash(c * 5) % 3)
    if ((hash(c * 3) + Math.floor(t / 8)) % 9 === 0) dot(g, r, c, 'V')
  }
  // The balloon drifts across the sky now and then
  const period = 1800 + w * 4
  const u = (t % period) - 200
  if (!s.isAsleep && u >= 0 && u / 4 < w + 8) draw(g, 1 + Math.round(Math.sin(t / 30)), w - Math.floor(u / 4), BALLOON)

  for (const b of [boat(t, w, 500 + w * 2, 1), s.isWorking ? boat(t + 300, w, 160 + w * 2, 2) : null]) {
    if (!b) continue
    const sprite = b.dir === 1 ? BOAT : BOAT.map(r => [...r].reverse().join(''))
    draw(g, H - sprite.length, b.x, sprite)
  }

  // Claude working: a cyclist pedals along the quay
  if (s.isWorking) {
    const span = w + 8
    const x = (t % span) - 4
    draw(g, QUAY - 3, x, BIKE[Math.floor(t / 2) % 2] as string[])
  }
}

function over(g: Grid, s: Scene, l: Paris) {
  // The lamps glow at night
  if (s.isAsleep) for (const [r, c] of l.lamps) dot(g, r, c, 'l')
}

export const paris = city({
  H,
  day: DAY,
  night: NIGHT,
  nightSky: '#141a2e',
  layout,
  behind,
  over,
  lit: 0.5,
  twinkle: 400,
  ground: ". ' . : ' ",
  groundColor: 'gray',
})
