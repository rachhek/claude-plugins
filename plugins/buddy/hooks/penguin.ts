import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The penguin: a chunky black-and-white penguin, drawn in half blocks in the
// terminal and as pixels on the desktop. Facing right. It waddles, belly-slides
// where others jump, and for a snack it chases a fish flopping on the ice.
//
// Pixels: E outline and eyes, K dark back, k lighter flipper, W white belly and face,
// S shaded white, w eye glint, Y beak and feet, y far foot, P blush,
// B fish, b fish belly

// One size of penguin: its body, feet, flippers, faces, slide and fish
type Art = {
  /** Columns the penguin takes */
  w: number
  body: string[]
  /** Feet planted, the body settled down onto them */
  planted: string[]
  /** A step, the body bobbed up a pixel: the near foot lifted forward, or the far one */
  step: { near: string[]; far: string[] }
  /** The near flipper, laid over the body from a row */
  flipper: Record<'down' | 'out' | 'up', [number, string[]]>
  /** Happy eyes curved shut with a blush, and blinking eyes, laid over the body from a row */
  happy: [number, string[]]
  blink: [number, string[]]
  slide: string[]
  /** The fish, flat then flicking its tail up */
  fish: string[][]
  /** Columns the fish flops in ahead of the penguin */
  lane: number
}

const AIR = 3 // headroom (it slides rather than jumps, so little is needed)

const BODY = [
  '......EEEEE........',
  '....EEKKKKKEE......',
  '...EKKKKKKKKKE.....',
  '...EKKKKKKWWWKE....',
  '..EKKKKKKWWEwWKE...',
  '..EKKKKKKWWEEWWEE..',
  '..EKKKKKKKWWWWWYYE.',
  '..EKKKKKKKWWWWWYE..',
  '..EKKKKKKWWWWWWE...',
  '..EKKKKKKWWWWWWE...',
  '..EKKKKKWWWWWWWE...',
  '..EKKKKWWWWWWWWE...',
  '...EKKKWWWWWWWSE...',
  '...EKKKWWWWWWSE....',
]

// Feet planted, the body settled down onto them
const PLANTED = ['.....EyyEYYYYE.....', '.....EEEEEEEEE.....']
// A step, the body bobbed up a pixel: the near foot lifted forward, or the far one
const STEP = {
  near: ['......EE..EYYYYE...', '.....EyyE.EEEEEE...', '.....EEEE..........'],
  far: ['.........EyyE......', '.....EYYYYEEEE.....', '.....EEEEEE........'],
}

// The near flipper, laid over the body from a row: hanging down, held out a
// little for balance while it waddles, or raised in a happy flap
const FLIPPER: Art['flipper'] = {
  down: [8, ['......EEE.', '.....EkkkE', '.....EkkkE', '.....EkkE.', '.....EkE..', '......E...']],
  out: [8, ['......EEE.', '.....EkkkEE', '.....EkkkkE', '.....EkkEE.', '.....EkE...', '......E....']],
  up: [3, ['EE........', 'EkEE......', '.EkkEE....', '..EkkkEE..', '...EEkkkE.', '.....EEEE.']],
}

// Walking, seen from the side: upright, bobbing up a pixel on each step with
// one foot lifted, then settling back with both down; the feet take turns
// (the step changes with every other column it moves)

// Belly-sliding, flippers back and feet trailing
const SLIDE = [
  '........EEEEE......',
  '.....EEEKKKKKE.....',
  '...EEKKKKKKWWWE....',
  '..EKKKKKKKWWEwWEE..',
  '.EKKkkkkkKWWEEWYYE.',
  'EEEkkkkkEWWWWWWYE..',
  'EYYEEEEEWWWWWWWE...',
  '.EEEEEEEEEEEEEE....',
]

// The fish, flat then flicking its tail up, flopping in a lane this wide ahead of the penguin
const FISH = [
  ['..EEEE.EE', '.EBBBBEBE', 'EBEBBBBBE', 'EBbbbbEBE', '.EEEEE.EE'],
  ['.......EE', '..EEEEEBE', '.EBBBBBE.', 'EBEBBBBE.', 'EBbbbbE..', '.EEEEE...'],
]

const NORMAL: Art = {
  w: 19,
  body: BODY,
  planted: PLANTED,
  step: STEP,
  flipper: FLIPPER,
  happy: [4, ['............E.....', '..........EWWE....', '............P.....']],
  blink: [4, ['...........WW.....']],
  slide: SLIDE,
  fish: FISH,
  lane: 11,
}

// The small penguin (/buddy size small): the same poses redrawn smaller, never shrunk
const SMALL: Art = {
  w: 16,
  body: [
    '....EEEEE.......',
    '...EKKKKKEE.....',
    '..EKKKKKKWWKE...',
    '..EKKKKKWEwWKE..',
    '..EKKKKKWEEWWEE.',
    '..EKKKKKKWWWWYYE',
    '..EKKKKKKWWWWYE.',
    '..EKKKKKWWWWWE..',
    '..EKKKKWWWWWSE..',
    '...EKKKWWWWSE...',
  ],
  planted: ['....EyEYYYE.....', '....EEEEEEE.....'],
  step: {
    near: ['.....E..EYYYE...', '....EyE.EEEEE...', '....EEE.........'],
    far: ['........EyE.....', '....EYYYEEE.....', '....EEEEE.......'],
  },
  flipper: {
    down: [5, ['.....EE.', '....EkkE', '....EkkE', '....EkE.', '.....E..']],
    out: [5, ['.....EE..', '....EkkEE', '....EkkkE', '....EkEE.', '.....E...']],
    up: [1, ['EE......', 'EkEE....', '.EkkEE..', '..EEkkE.', '....EEE.']],
  },
  happy: [3, ['..........E.....', '........EWWE....', '..........P.....']],
  blink: [3, ['.........WW.....']],
  slide: [
    '.......EEEE.....',
    '....EEEKKKWWE...',
    '..EEKKKKKWWEwEE.',
    '.EKKkkkkKWWEEYYE',
    'EEEkkkkEWWWWWYE.',
    'EYEEEEEWWWWWWE..',
    '.EEEEEEEEEEEE...',
  ],
  fish: [
    ['.EEEE.EE', 'EBEBBBBE', 'EbbbbBBE', '.EEEE.EE'],
    ['......EE', '.EEEEEBE', 'EBEBBBE.', 'EbbbbE..', '.EEEE...'],
  ],
  lane: 10,
}

// Chasing its fish, but not mid-slide (a slide can start while it's still munching)
const chasing = (s: Scene) => s.isMunching && s.spin === 0

function over(rows: string[], top: number, pattern: string[]) {
  pattern.forEach((row, r) => [...row].forEach((p, c) => p !== '.' && put(rows, top + r, c, p)))
}

/** Pixel rows of the sprite: the body, a pixel to bob up into, and its feet */
const height = (a: Art) => a.body.length + 3

function sprite(a: Art, s: Scene): string[] {
  const h = height(a)
  // Penguins don't jump, they slide on their bellies; padded to the full height
  if (s.spin > 0) return mirror([...Array<string>(h - a.slide.length).fill('.'.repeat(a.w)), ...a.slide], s.dir)
  const legs = s.legs === 'sit' ? 'stand' : s.legs
  const body = [...a.body]
  const flipper = s.isHappy ? 'up' : legs === 'stand' ? 'down' : 'out'
  over(body, ...a.flipper[flipper])
  if (s.isHappy) {
    // Happy: eyes curved shut, a little blush
    over(body, ...a.happy)
  } else if (s.isAsleep || s.isBlinking) {
    over(body, ...a.blink)
  }
  const rows =
    legs === 'a'
      ? [...body, ...a.step[Math.floor(s.x / 2) % 2 ? 'near' : 'far']]
      : ['.'.repeat(a.w), ...body, ...a.planted]
  if (!chasing(s)) return mirror(rows, s.dir)
  const fish = a.fish[s.legs === 'b' ? 1 : 0] ?? []
  const top = h - fish.length
  const wide = rows.map((r, i) => r + '..' + (fish[i - top] ?? '.'.repeat(a.lane - 2)))
  return mirror(wide, s.dir)
}

// Columns the drawing starts left of the penguin: the lane, when the fish is on its left
const offset = (a: Art, s: Scene) => (chasing(s) && s.dir === -1 ? a.lane : 0)

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

function build(a: Art): Character {
  const W = a.w
  const H = height(a)
  return {
    width: W,
    canMunch: true,
    rolls: true,
    stride: 0.5,
    pace: 2, // a slow waddle
    snackLane: a.lane,
    chases: true,

    terminal(s, cols) {
      const sp = sprite(a, s)
      return {
        rows: halfBlocks(sp, AIR - s.air, sp[0]?.length ?? W, H + AIR, TERM),
        offset: offset(a, s),
      }
    },

    svg(s, cols) {
      const sp = sprite(a, s)
      const w = cols * CELL
      const size = W * PX
      const groundY = H * PX + AIR * LIFT + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - H * PX - s.air * LIFT
      const left = ox - offset(a, s) * PX

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
}

export const penguin = build(NORMAL)
export const penguinSmall = build(SMALL)
