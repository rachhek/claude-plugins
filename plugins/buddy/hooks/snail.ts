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
// L lettuce, l lettuce vein, d shaded lettuce, T slime trail, u fading trail, x sparkle,
// Q reading glasses
const W = 19 // columns the snail itself takes
const LANE = 4 // columns its lettuce takes in front, past `width`
const H = 14
const TRAIL = 6 // columns of slime behind it, past `width`

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

// One eye peeking out of the shell, at row 8, column 10
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

// The lettuce leaf in front of its mouth (row 7, column 17 on, so mostly in the
// lane ahead), bitten down as it eats
const LEAF = [
  ['..EE..', '.ELLE.', 'ELlLLE', 'ELLlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['...E..', '..ELE.', '.EllLE', 'ELLlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['......', '...EE.', '..ElLE', '.ELlLE', 'EdLLlE', '.EddE.', '..EE..'],
  ['......', '......', '......', '...EE.', '..ElLE', '.EddE.', '..EE..'],
]

// The slime behind it on the ground row, far end first, running on under its tail
const SLIME = '.uuuTTTT'

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

// Reading glasses: a round lens about each eye on its stalk, the two side by side
// (from a row above and two columns left of each eye's glint)
const LENS = ['.QQ.', 'Q..Q', 'Q..Q', '.QQ.']

// The snail itself, facing right, W columns wide
const hiding = (s: Scene) => (s.spin > 0 && !s.isHappy) || s.isUpset

function pose(s: Scene): string[] {
  // Startled or upset, it hides: in, a peek out near the end, and back out
  if (hiding(s)) {
    if (s.spin === 1 || s.spin >= 9) return [...TUCK]
    const rows = [...SHELL]
    if (s.spin >= 7 || (s.spin === 0 && s.tick % 20 >= 13)) stamp(rows, 8, 10, PEEK)
    return rows
  }
  let rows: string[]
  if (s.isAsleep) rows = [...DROOP, ...STAND.slice(DROOP.length)]
  else if (s.legs === 'a') rows = [...STRETCH]
  else if (s.legs === 'b') rows = [...BUNCH]
  else if (s.isHappy) rows = [...PERK, ...STAND.slice(PERK.length)]
  else rows = [...STAND]

  if (s.isReading && !s.isAsleep) rows.forEach((row, r) => [...row].forEach((p, c) => p === 'w' && stamp(rows, r - 1, c - 2, LENS)))
  // Reading, it keeps its eyes open behind its glasses
  if (s.isAsleep || (s.isBlinking && !s.isReading)) eyes(rows, 'G', 'K')
  else if (s.isHappy) {
    eyes(rows, 'K', 'G')
    // Its shell twinkles
    if (Math.floor(s.tick / 3) % 2) stamp(rows, 1, 5, ['.x.', 'xxx', '.x.'])
    else put(rows, 2, 6, 'x')
  }
  return rows
}

// The whole drawing, facing right: the slime trail behind and the lettuce
// ahead (each only as far as the band reaches), the snail between; and how
// many columns the drawing starts left of the snail once turned to face dir
function drawing(s: Scene, cols: number): { sp: string[]; offset: number } {
  const eating = s.isMunching && !hiding(s)
  const behind = Math.min(TRAIL, roomAhead(s.x, s.dir === 1 ? -1 : 1, W, cols))
  const ahead = eating ? Math.min(LANE, roomAhead(s.x, s.dir, W, cols)) : 0
  const body = pose(s).map(r => r + '.'.repeat(LANE))
  if (eating) {
    stamp(body, 7, 17, LEAF[Math.min(3, Math.floor(s.snack / 15))] ?? [])
    // Mouth open, then shut
    if (s.chew) stamp(body, 9, 14, ['RR', 'EE'])
  }
  // Slime up to under its tail, a sparkle running back along it
  const slime = [...SLIME]
  const spark = slime.length - 1 - (Math.floor(s.tick / 2) % (slime.length + 6))
  if (slime[spark] === 'T' || slime[spark] === 'u') slime[spark] = 'x'
  const rows = Array.from({ length: H }, () => '.'.repeat(TRAIL + W + LANE))
  stamp(rows, H - 1, 0, [slime.join('')])
  stamp(rows, 0, TRAIL, body)
  const sp = rows.map(r => r.slice(TRAIL - behind, TRAIL + W + ahead))
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
  Q: '#e0584f',
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
  Q: '#d04a44',
}

const PATH = ".'..,.'..'.,...,'..'.,."

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

export const snail: Character = {
  width: W,
  canMunch: true,
  rolls: true, // never jumps: a startle sends it into its shell
  stride: 0,
  pace: 4, // the slowest buddy
  snackLane: LANE,
  chases: false,

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += PATH[i % PATH.length]
    const { sp, offset } = drawing(s, cols)
    const pixelRows = Math.min(H, rows - (rows % 2))
    return {
      rows: halfBlocks(sp, pixelRows - H, sp[0]?.length ?? W, pixelRows, TERM),
      ground,
      groundColor: 'green',
      offset,
    }
  },

  svg(s, cols) {
    const { sp, offset } = drawing(s, cols)
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
