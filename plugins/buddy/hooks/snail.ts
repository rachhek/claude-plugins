import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, roomAhead, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The snail: the slowest buddy, a spiral shell on a soft body, facing right.
// It inches along (front pushes forward, then the tail catches up), leaves a
// shiny slime trail behind it, nibbles a lettuce leaf for a snack, and pulls
// into its shell when startled or when something goes wrong.
//
// Pixels: E outline and mouth, B shell, b shaded shell, Y spiral, h shine,
// G body, g belly edge, K eyes, w eye glint, P blush, R open mouth,
// L lettuce, l lettuce vein, d shaded lettuce, T slime trail, u fading trail, x sparkle

// One size of snail: its poses, its props, and where they go
type Art = {
  stand: string[]
  stretch: string[]
  bunch: string[]
  tuck: string[]
  shell: string[]
  /** One eye peeking out of the shell, and the row and column it goes at */
  peek: string[]
  peekAt: [number, number]
  /** Stalks for the top rows of the standing pose: drooping asleep, perked up happy */
  droop: string[]
  perk: string[]
  /** The lettuce, bitten down as it eats, and the row and column its frames go at */
  leaf: string[][]
  leafAt: [number, number]
  /** Where the mouth opens while it chews */
  mouth: [number, number]
  /** The middle of the twinkle on its shell */
  twinkle: [number, number]
  /** The slime on the ground row, far end first, running on under its tail */
  slime: string
  /** Columns of slime behind it, past `width` */
  trail: number
  /** Columns its lettuce takes in front, past `width` */
  lane: number
}

const STAND = [
  '............EE.EE..',
  '....EEEE...EKwEKwE.',
  '..EEhhBBEE.EKKEKKE.',
  '..EhYYYYBE..EGEEGE.',
  '.EhYBBBBYBE.EGEGE..',
  '.EBYBYYBYBE.EGGGE..',
  '.EBYBYBBYBEEGGGGGE.',
  '.EBYBBYYBbEEGGGGGE.',
  '.EBBYBBBbbEEGEGPPE.',
  '..EbbYYbbEEGGGEEGE.',
  '..EEEbbbbEEGGGGGGE.',
  '.EGGGEEEEGGGGGGGGE.',
  'EggggggggggggggggE.',
  '.EEEEEEEEEEEEEEEE..',
]

// Walking: stretched out, head pushed forward and eyes leaning ahead...
const STRETCH = [
  '...................',
  '....EEEE.....EE.EE.',
  '..EEhhBBEE..EKwEKwE',
  '..EhYYYYBE..EKKEKKE',
  '.EhYBBBBYBE..EGEGE.',
  '.EBYBYYBYBE..EGGGE.',
  '.EBYBYBBYBEEGGGGGGE',
  '.EBYBBYYBbEEGGGGGGE',
  '.EBBYBBBbbEEGGEGPPE',
  '..EbbYYbbEEGGGGEEGE',
  '..EEEbbbbEEGGGGGGGE',
  '.EGGGEEEEGGGGGGGGGE',
  'EgggggggggggggggggE',
  '.EEEEEEEEEEEEEEEEE.',
]

// ...then bunched up, the tail caught up, shell raised and stalks upright
const BUNCH = [
  '....EEEE....EE.EE..',
  '..EEhhBBEE.EKwEKwE.',
  '..EhYYYYBE.EKKEKKE.',
  '.EhYBBBBYBE.EGEEGE.',
  '.EBYBYYBYBE.EGEEGE.',
  '.EBYBYBBYBE.EGGGGE.',
  '.EBYBBYYBbEEGGGGGE.',
  '.EBBYBBBbbEEGGGGGE.',
  '..EbbYYbbEEGGEGPPE.',
  '..EEEbbbbEEGGGEEGE.',
  '...EEEEEEGGGGGGGGE.',
  '..EGGGGGGGGGGGGGGE.',
  '.EgggggggggggggggE.',
  '..EEEEEEEEEEEEEEE..',
]

// Halfway into its shell (or back out of it)
const TUCK = [
  '...................',
  '...................',
  '....EEEE...........',
  '..EEhhBBEE.........',
  '..EhYYYYBE.........',
  '.EhYBBBBYBE........',
  '.EBYBYYBYBE........',
  '.EBYBYBBYBE........',
  '.EBYBBYYBbEEE......',
  '.EBBYBBBbbEGGE.....',
  '..EbbYYbbEGGGGE....',
  '..EEEbbbbEGGGGE....',
  '.EgggEEEEggggE.....',
  '..EEEEEEEEEEE......',
]

// All the way in: just the shell, resting on the ground
const SHELL = [
  '...................',
  '...................',
  '...................',
  '....EEEE...........',
  '..EEhhBBEE.........',
  '..EhYYYYBE.........',
  '.EhYBBBBYBE........',
  '.EBYBYYBYBE........',
  '.EBYBYBBYBE........',
  '.EBYBBYYBbE........',
  '.EBBYBBBbbE........',
  '..EbbYYbbE.........',
  '..EEbbbbEE.........',
  '....EEEE...........',
]

// One eye peeking out of the shell
const PEEK = ['..EE.', '.EKwE', '.EKKE', '.EGE.', 'EGE..', 'E....']

// Stalks for the top five rows of the standing pose: drooping asleep, perked up happy
const DROOP = [
  '...................',
  '....EEEE.....EE.EE.',
  '..EEhhBBEE..EKwEKwE',
  '..EhYYYYBE..EKKEKKE',
  '.EhYBBBBYBE..EGEGE.',
]
const PERK = [
  '............EE.EE..',
  '....EEEE...EKwEKwE.',
  '..EEhhBBEE.EKKEKKE.',
  '..EhYYYYBE..EGEEGE.',
  '.EhYBBBBYBE.EGEEGE.',
  '.EBYBYYBYBE.EGGGGE.',
]

// The lettuce leaf in front of its mouth (mostly in the lane ahead), bitten
// down as it eats
const LEAF = [
  ['..EE..', '.ELLE.', 'ELlLLE', 'ELLlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['...E..', '..ELE.', '.EllLE', 'ELLlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['......', '...EE.', '..ElLE', '.ELlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['......', '......', '......', '...EE.', '..ElLE', '.EddE.', '..EE..'],
]

const NORMAL: Art = {
  stand: STAND,
  stretch: STRETCH,
  bunch: BUNCH,
  tuck: TUCK,
  shell: SHELL,
  peek: PEEK,
  peekAt: [8, 10],
  droop: DROOP,
  perk: PERK,
  leaf: LEAF,
  leafAt: [7, 17],
  mouth: [9, 14],
  twinkle: [2, 6],
  slime: '.uuuTTTT',
  trail: 6,
  lane: 4,
}

// The small snail (/buddy size small): the same poses redrawn smaller, never shrunk
const SMALL: Art = {
  stand: [
    '..........EE.EE..',
    '...EEEE..EKwEKwE.',
    '..EhhBBE.EKKEKKE.',
    '.EhYYYYBE.EGEEGE.',
    '.EBYBBYBE.EGEGE..',
    '.EBYBYYbEEGGGGE..',
    '.EBBYBbbEEGEGPPE.',
    '..EbbbbEEGGGEEGE.',
    '.EGEEEEGGGGGGGGE.',
    'EggggggggggggggE.',
    '.EEEEEEEEEEEEEE..',
  ],
  stretch: [
    '.................',
    '...EEEE....EE.EE.',
    '..EhhBBE..EKwEKwE',
    '.EhYYYYBE.EKKEKKE',
    '.EBYBBYBE..EGEGE.',
    '.EBYBYYbE.EGGGGE.',
    '.EBBYBbbEEGGEGPPE',
    '..EbbbbEEGGGGEEGE',
    '.EGEEEEGGGGGGGGGE',
    'EgggggggggggggggE',
    '.EEEEEEEEEEEEEEE.',
  ],
  bunch: [
    '...EEEE...EE.EE..',
    '..EhhBBE.EKwEKwE.',
    '.EhYYYYBEEKKEKKE.',
    '.EBYBBYBE.EGEEGE.',
    '.EBYBYYbE.EGEEGE.',
    '.EBBYBbbEEGGGGGE.',
    '..EbbbbEEGGEGPPE.',
    '...EEEEEGGGGEEGE.',
    '..EGGGGGGGGGGGGE.',
    '.EgggggggggggggE.',
    '..EEEEEEEEEEEEE..',
  ],
  tuck: [
    '.................',
    '.................',
    '...EEEE..........',
    '..EhhBBE.........',
    '.EhYYYYBE........',
    '.EBYBBYBE........',
    '.EBYBYYbEEE......',
    '.EBBYBbbEGGE.....',
    '..EbbbbEGGGGE....',
    '.EgEEEEggggE.....',
    '..EEEEEEEEE......',
  ],
  shell: [
    '.................',
    '.................',
    '.................',
    '...EEEE..........',
    '..EhhBBE.........',
    '.EhYYYYBE........',
    '.EBYBBYBE........',
    '.EBYBYYbE........',
    '.EBBYBbbE........',
    '..EbbbbE.........',
    '...EEEE..........',
  ],
  peek: PEEK,
  peekAt: [5, 8],
  droop: [
    '.................',
    '...EEEE....EE.EE.',
    '..EhhBBE..EKwEKwE',
    '.EhYYYYBE.EKKEKKE',
    '.EBYBBYBE..EGEGE.',
  ],
  perk: [
    '..........EE.EE..',
    '...EEEE..EKwEKwE.',
    '..EhhBBE.EKKEKKE.',
    '.EhYYYYBE.EGEEGE.',
    '.EBYBBYBE.EGEEGE.',
    '.EBYBYYbEEGGGGGE.',
  ],
  leaf: [
    ['.EE..', 'ELLE.', 'ElLLE', 'ELlLE', '.EdlE', '..EE.'],
    ['..E..', '.ELE.', 'ElLLE', 'ELlLE', '.EdlE', '..EE.'],
    ['.....', '.....', '..EEE', '.ElLE', '.EdlE', '..EE.'],
    ['.....', '.....', '.....', '...E.', '..EdE', '..EE.'],
  ],
  leafAt: [5, 15],
  mouth: [7, 12],
  twinkle: [2, 5],
  slime: '.uuTTTT',
  trail: 5,
  lane: 3,
}

// Each eye is 2 × 2 with its glint (w) top right: redraw both rows
function eyes(rows: string[], top: string, bottom: string) {
  rows.forEach((row, r) =>
    [...row].forEach((p, c) => {
      if (p !== 'w') return
      put(rows, r, c - 1, top)
      put(rows, r, c, top)
      put(rows, r + 1, c - 1, bottom)
      put(rows, r + 1, c, bottom)
    }),
  )
}

// The snail itself, facing right, as wide as its standing pose
const hiding = (s: Scene) => (s.spin > 0 && !s.isHappy) || s.isUpset

function pose(a: Art, s: Scene): string[] {
  // Startled or upset, it hides: in, a peek out near the end, and back out
  if (hiding(s)) {
    if (s.spin === 1 || s.spin >= 9) return [...a.tuck]
    const rows = [...a.shell]
    if (s.spin >= 7 || (s.spin === 0 && s.tick % 20 >= 13)) stamp(rows, a.peekAt[0], a.peekAt[1], a.peek)
    return rows
  }
  let rows: string[]
  if (s.isAsleep) rows = [...a.droop, ...a.stand.slice(a.droop.length)]
  else if (s.legs === 'a') rows = [...a.stretch]
  else if (s.legs === 'b') rows = [...a.bunch]
  else if (s.isHappy) rows = [...a.perk, ...a.stand.slice(a.perk.length)]
  else rows = [...a.stand]

  if (s.isAsleep || s.isBlinking) eyes(rows, 'G', 'K')
  else if (s.isHappy) {
    eyes(rows, 'K', 'G')
    // Its shell twinkles
    const [r, c] = a.twinkle
    if (Math.floor(s.tick / 3) % 2) stamp(rows, r - 1, c - 1, ['.x.', 'xxx', '.x.'])
    else put(rows, r, c, 'x')
  }
  return rows
}

// The whole drawing, facing right: the slime trail behind and the lettuce
// ahead (each only as far as the band reaches), the snail between; and how
// many columns the drawing starts left of the snail once turned to face dir
function drawing(a: Art, s: Scene, cols: number): { sp: string[]; offset: number } {
  const W = a.stand[0]?.length ?? 0
  const H = a.stand.length
  const { trail, lane } = a
  const eating = s.isMunching && !hiding(s)
  const behind = Math.min(trail, roomAhead(s.x, s.dir === 1 ? -1 : 1, W, cols))
  const ahead = eating ? Math.min(lane, roomAhead(s.x, s.dir, W, cols)) : 0
  const body = pose(a, s).map(r => r + '.'.repeat(lane))
  if (eating) {
    stamp(body, a.leafAt[0], a.leafAt[1], a.leaf[Math.min(3, Math.floor(s.snack / 15))] ?? [])
    // Mouth open, then shut
    if (s.chew) stamp(body, a.mouth[0], a.mouth[1], ['RR', 'EE'])
  }
  // Slime up to under its tail, a sparkle running back along it
  const slime = [...a.slime]
  const spark = slime.length - 1 - (Math.floor(s.tick / 2) % (slime.length + 6))
  if (slime[spark] === 'T' || slime[spark] === 'u') slime[spark] = 'x'
  const rows = Array.from({ length: H }, () => '.'.repeat(trail + W + lane))
  stamp(rows, H - 1, 0, [slime.join('')])
  stamp(rows, 0, trail, body)
  const sp = rows.map(r => r.slice(trail - behind, trail + W + ahead))
  return { sp: mirror(sp, s.dir), offset: s.dir === 1 ? behind : ahead }
}

const TERM = {
  E: '#2a1f1a',
  B: '#c98543',
  b: '#97592b',
  Y: '#f0c27a',
  h: '#fff1d0',
  G: '#bcd2b2',
  g: '#e4eedb',
  K: '#1a1614',
  w: '#ffffff',
  P: '#eba3a3',
  R: '#a04a5a',
  L: '#6fbf5f',
  l: '#b4e39a',
  d: '#4e9a48',
  T: '#a8d4e6',
  u: '#5f7f8c',
  x: '#ffffff',
}

const SVG = {
  E: '#1f1612',
  B: '#bd7a3a',
  b: '#8c5024',
  Y: '#e8b56a',
  h: '#fbe8c2',
  G: '#b2c9a8',
  g: '#dde9d2',
  K: '#14100e',
  w: '#ffffff',
  P: '#e2939a',
  R: '#9c3f52',
  L: '#5fae45',
  l: '#a3d68a',
  d: '#3f8a37',
  T: '#9ccbe0',
  u: '#6d8c99',
  x: '#ffffff',
}


const PX = 6
const CELL = 8
const LIFT = 5
const AIR = 4 // it never leaves the ground, but keeps the band as tall as the others'

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['slowly, carefully', "we'll find it"])
  if (/\b(test|spec)/.test(t)) return pick(['slow and steady', 'one at a time'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['no rush...', 'gently now'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['nice and tidy', 'mm, neater'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['*happy slime*', 'any time...'])
  if (/\b(food|lunch|snack|eat|salad)/.test(t)) return pick(['lettuce?', 'mm, leaves'])
  if (text.trim().endsWith('?')) return pick(['hmm... let me see', 'mm, I see'])
  return pick(['no rush', 'slow and steady', 'mm, I see', '*inches along*'])
}

function build(a: Art): Character {
  const W = a.stand[0]?.length ?? 0 // columns the snail itself takes
  const H = a.stand.length
  // Pixel rows, kept even so its foot stays on the ground row
  const termRows = H + (H % 2)
  return {
    width: W,
    canMunch: true,
    rolls: true, // never jumps: a startle sends it into its shell
    stride: 0,
    pace: 4, // the slowest buddy
    snackLane: a.lane,
    chases: false,

    terminal(s, cols, rows) {
      const { sp, offset } = drawing(a, s, cols)
      const pixelRows = Math.min(termRows, rows - (rows % 2))
      return {
        rows: halfBlocks(sp, pixelRows - H, sp[0]?.length ?? W, pixelRows, TERM),
        offset,
      }
    },

    svg(s, cols) {
      const { sp, offset } = drawing(a, s, cols)
      const w = cols * CELL
      const groundY = H * PX + AIR * LIFT + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - H * PX
      return (
        svgOpen(w, h) +
        `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#8fa886"/>` +
        // A faint light rim so the dark outline still reads on a dark background
        outline(sp, ox - offset * PX, oy, PX, '#5d5658') +
        pixels(sp, ox - offset * PX, oy, PX, SVG) +
        bubbleSvg(s, ox, oy, W * PX, w, PX) +
        `</svg>`
      )
    },

    lines: {
      hi: 'oh, hello...',
      jump: 'eep!',
      done: ['made it... slowly', 'one step at a time', '*happy slime*'],
      abort: 'oh... okay.',
      error: '*hides*',
      snack: ['*munch*', 'lettuce...'],
      react,
    },
  }
}

export const snail = build(NORMAL)
export const snailSmall = build(SMALL)
