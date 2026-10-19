import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The penguin: a chunky black-and-white penguin, drawn in half blocks in the
// terminal and as pixels on the desktop. Facing right. It waddles, belly-slides
// where others jump, and for a snack it chases a fish flopping on the ice.
//
// Pixels: E outline and eyes, K dark back, k lighter flipper, W white belly and face,
// S shaded white, w eye glint, Y beak and feet, y far foot, P blush,
// B fish, b fish belly
const W = 18
const H = 16
const AIR = 4

const BODY = [
  '......EEEEE.......',
  '....EEKKKKKEE.....',
  '...EKKKKKKKKKE....',
  '...EKKKKKKWWWKE...',
  '..EKKKKKKWWEwWKE..',
  '..EKKKKKKWWEEWWEE.',
  '..EKKKKKKKWWWWWYYE',
  '..EKKKKKKKWWWWWYE.',
  '..EKKKKKKWWWWWWE..',
  '..EKKKKKKWWWWWWE..',
  '..EKKKKKWWWWWWWE..',
  '..EKKKKWWWWWWWWE..',
  '...EKKKWWWWWWWSE..',
  '...EKKKWWWWWWSE...',
]

const FEET: Record<Exclude<Legs, 'sit'>, string[]> = {
  stand: ['.....EyyEYYYYE....', '.....EEEEEEEEE....'],
  // Waddling: a stride with the far foot back, then feet together
  a: ['...EyyyE..EYYYYE..', '...EEEEE..EEEEEE..'],
  b: ['......EYYYYYE.....', '......EEEEEEE.....'],
}

// The near flipper, laid over the body from a row: hanging down, swung back
// (poking out behind), swung forward, or raised in a happy flap
const FLIPPER: Record<'down' | 'back' | 'fwd' | 'up', [number, string[]]> = {
  down: [8, ['......EEE.', '.....EkkkE', '.....EkkkE', '.....EkkE.', '.....EkE..', '......E...']],
  back: [8, ['.......EEE', '.....EEkkkE', '...EEkkkkE.', '.EEkkkkEE..', 'EkkkEEE....', '.EE........']],
  fwd: [8, ['.....EEE..', '....EkkkE.', '.....EkkkE', '......EkkE', '.......EkE', '........E.']],
  up: [3, ['EE........', 'EkEE......', '.EkkEE....', '..EkkkEE..', '...EEkkkE.', '.....EEEE.']],
}

// Belly-sliding, flippers back and feet trailing; padded to the full height
const SLIDE = [
  ...Array<string>(H - 8).fill('.'.repeat(W)),
  '........EEEEE.....',
  '.....EEEKKKKKE....',
  '...EEKKKKKKWWWE...',
  '..EKKKKKKKWWEwWEE.',
  '.EKKkkkkkKWWEEWYYE',
  'EEEkkkkkEWWWWWWYE.',
  'EYYEEEEEWWWWWWWE..',
  '.EEEEEEEEEEEEEE...',
]

// The fish, flat then flicking its tail up, flopping in a lane this wide ahead of the penguin
const FISH = [
  ['..EEEE.EE', '.EBBBBEBE', 'EBEBBBBBE', 'EBbbbbEBE', '.EEEEE.EE'],
  ['.......EE', '..EEEEEBE', '.EBBBBBE.', 'EBEBBBBE.', 'EBbbbbE..', '.EEEEE...'],
]
const LANE = 11

// Chasing its fish, but not mid-slide (a slide can start while it's still munching)
const chasing = (s: Scene) => s.isMunching && s.spin === 0

function over(rows: string[], top: number, pattern: string[]) {
  pattern.forEach((row, r) => [...row].forEach((p, c) => p !== '.' && put(rows, top + r, c, p)))
}

function sprite(s: Scene): string[] {
  // Penguins don't jump, they slide on their bellies
  if (s.spin > 0) return mirror(SLIDE, s.dir)
  const legs = s.legs === 'sit' ? 'stand' : s.legs
  const rows = [...BODY, ...FEET[legs]]
  const flipper = s.isHappy ? 'up' : legs === 'a' ? 'back' : legs === 'b' ? 'fwd' : 'down'
  over(rows, ...FLIPPER[flipper])
  if (s.isHappy) {
    // Happy: eyes curved shut, a little blush
    over(rows, 4, ['............E.....', '..........EWWE....', '............P.....'])
  } else if (s.isAsleep || s.isBlinking) {
    over(rows, 4, ['...........WW.....'])
  }
  if (!chasing(s)) return mirror(rows, s.dir)
  const fish = FISH[s.legs === 'b' ? 1 : 0] ?? []
  const top = H - fish.length
  const wide = rows.map((r, i) => r + '..' + (fish[i - top] ?? '.'.repeat(LANE - 2)))
  return mirror(wide, s.dir)
}

// Columns the drawing starts left of the penguin: the lane, when the fish is on its left
const offset = (s: Scene) => (chasing(s) && s.dir === -1 ? LANE : 0)

const TERM = {
  E: '#1e2026',
  K: '#3c4452',
  k: '#505866',
  W: '#f0eade',
  S: '#bdb5ad',
  w: '#ffffff',
  Y: '#f2a03d',
  y: '#c27a2c',
  P: '#e98f9a',
  B: '#6aa6d8',
  b: '#c8d6e0',
}
const SVG = {
  E: '#0b0c10',
  K: '#2b3340',
  k: '#3f4753',
  W: '#f0eade',
  S: '#c0b8b0',
  w: '#ffffff',
  Y: '#f0952e',
  y: '#b86e22',
  P: '#e2808c',
  B: '#5b97cc',
  b: '#b9c9d4',
}

const ICE = "_.____-______.___'____-___"

const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['bug? i got it!', '*waddles over*'])
  if (/\b(test|spec)/.test(t)) return pick(['tests! noot!', 'go green!'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['slide it in!', 'ship it!'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['nice and tidy!', 'squeaky clean!'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['noot :)', '*happy flap*'])
  if (/\b(food|lunch|snack|eat|fish)/.test(t)) return pick(['fish?!', 'snack time!'])
  if (text.trim().endsWith('?')) return pick(['noot?', '*tilts head*'])
  return pick(['noot!', 'on it!', '*waddle*', 'ooh!', '*flap flap*'])
}

export const penguin: Character = {
  width: W,
  canMunch: true,
  rolls: true,
  stride: 0.5,
  pace: 2, // a slow waddle
  snackLane: LANE,
  chases: true,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += ICE[(i + s.ground) % ICE.length]
    const sp = sprite(s)
    return {
      rows: halfBlocks(sp, AIR - s.air, sp[0]?.length ?? W, H + AIR, TERM),
      ground,
      groundColor: 'cyan',
      offset: offset(s),
    }
  },

  svg(s, cols) {
    const sp = sprite(s)
    const w = cols * CELL
    const size = W * PX
    const groundY = H * PX + AIR * LIFT + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - H * PX - s.air * LIFT
    const left = ox - offset(s) * PX

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#b8d8e8"/>` +
      shadowSvg(s, ox, size, groundY, PX) +
      // A faint light rim so the dark outline still reads on a dark background
      outline(sp, left, oy, PX, '#5d5658') +
      pixels(sp, left, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, PX) +
      `</svg>`
    )
  },

  lines: {
    hi: 'noot!',
    jump: 'wheee!',
    done: ['noot noot!', 'all done!', '*happy flap*'],
    abort: 'oh. okay.',
    error: 'noot?!',
    snack: ['fish!', '*flop*', 'come here, fish!'],
    react,
  },
}
