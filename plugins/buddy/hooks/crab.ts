import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The crab: a coral crab seen from the front, claws up and eyes on stalks,
// drawn one art pixel to one half block in the terminal and as pixels on the
// desktop. Crabs face you and walk sideways, so it's drawn symmetric and
// flipping it changes nothing. Instead of jumping it burrows into the sand;
// for a snack it sits and nibbles a strip of seaweed.
//
// Pixels: E outline and closed-eye line, R shell, r lighter shell (top, claws),
// D darker underside and legs, W eye white, K pupil, w glint, G seaweed,
// g lighter seaweed, O bubble, S sand, s darker sand

// Half a row and its mirror image: the crab is symmetric
const both = (half: string[]) => half.map(r => r + [...r].reverse().join(''))
const flip = (rows: string[]) => mirror(rows, -1)
const pair = (left: string[], right: string[]) => left.map((l, i) => l + [...(right[i] ?? '')].reverse().join(''))

// Burrowing, a frame a tick: sinks into the sand, peeks out with just its
// eyes (looking about), and comes back up. `depth` is the rows it has sunk
type Dig = { depth: number; look?: string[]; puff?: boolean }

// One size of crab: its sprites, and where the eyes, claws, snack and sand go
type Art = {
  w: number
  /** Pixel rows: the crab and the rows above it for raised claws and bubbles */
  h: number
  /** Claws, eyes and shell, without legs */
  body: string[]
  feet: Record<Exclude<Legs, 'sit'>, string[]>
  sitFeet: string[]
  /** The inside of each eye, for blinking, smiling and looking about */
  shut: string[]
  joy: string[]
  lookL: string[]
  lookR: string[]
  /** Column of the left eye's inside */
  eye: number
  /** Columns from each side to where the eyes start, and the eyes' rows from the body's top */
  eyeEdge: number
  eyeRows: number
  /** Claw rows, how far it throws them up when happy, and the arm left below */
  claw: number
  raise: number
  arm: string
  /** Bubbles over the raised claws: [row from the body's top, column, pixels] */
  bubbles: [number, number, string[]][]
  /** The left side with the raised claw and arm taken away */
  armless: string[]
  /** The claw holding seaweed to its mouth, and where it goes from the body's top */
  nibble: string[]
  nibbleAt: [number, number]
  /** Where the claws tuck in when asleep, from the body's top */
  tuck: number
  burrow: Dig[]
  /** Sunk deeper than this, only the eyestalks stick out */
  deep: number
  mound: string
  peekMound: string
  /** Sand thrown up while digging: [row, column], mirrored */
  puff: [number, number][]
}

// Three legs a side (left half): standing straight, splayed out, lifted
const STRAIGHT = ['.EDEDEDEEE', '..D.D.D...']
const SPLAYED = ['.EDEDEDEEE', '.D.D.D....']
const LIFTED = ['.EDEDEDEEE', '..........']

// The inside of each eye (3 × 3), for looking about, blinking and smiling
const LOOK_L = ['WWW', 'KwW', 'KKW']
const LOOK_R = ['WWW', 'WwK', 'WKK']

const NORMAL: Art = {
  w: 20,
  h: 14, // the 12-row crab and two rows above it for raised claws and bubbles
  body: both([
    '.E.E..EEE.',
    'ErErEEWWWE',
    'ErrrEEWwKE',
    'ERRREEWKKE',
    '.ERE..ERE.',
    '.ERE.EEREE',
    '.EREErrrrr',
    '.ERERRRRER',
    '.ERRRRRRRE',
    '.EDDDDDDDD',
  ]),
  // Scuttling sideways: one side's legs reach out while the other side's lift
  feet: {
    stand: pair(STRAIGHT, STRAIGHT),
    a: pair(SPLAYED, LIFTED),
    b: pair(LIFTED, SPLAYED),
  },
  sitFeet: both(['.EDEDEDEEE']),
  shut: ['rrr', 'EEE', 'RRR'],
  joy: ['WWW', 'WEW', 'EWE'],
  lookL: LOOK_L,
  lookR: LOOK_R,
  eye: 6,
  eyeEdge: 5,
  eyeRows: 4,
  claw: 4,
  raise: 2,
  arm: '.ERE.',
  bubbles: [
    [-2, 6, ['Ow', 'OO']],
    [-2, 13, ['O']],
  ],
  armless: ['.....', '.....', '.....', '.....', '.....', '.....', '....E', '...ER', '..ERR', '..EDD'],
  // Its left claw (in the lighter shade, to stand out from the shell) brought
  // round to its mouth with a strip of seaweed
  nibble: [
    '.EEE......',
    'ErrrE.....',
    'ErEEgggg..',
    'ErrrGGGGg.',
    '.ErE......',
  ],
  nibbleAt: [5, 1],
  tuck: 6,
  burrow: [
    { depth: 5 },
    { depth: 7, puff: true },
    { depth: 7 },
    { depth: 7, look: LOOK_L },
    { depth: 7, look: LOOK_R },
    { depth: 7 },
    { depth: 7, puff: true },
    { depth: 5 },
    { depth: 3 },
  ],
  deep: 5,
  mound: '..sSSSSSSSSSSSSSSs..',
  peekMound: '....sSSSSSSSSSSs....',
  puff: [
    [11, 2],
    [12, 1],
    [10, 3],
  ],
}

// The small crab (/buddy size small): the same crab redrawn smaller, never
// shrunk. Two legs a side, 2 × 2 eyes, and its claws go up one row
const S_LOOK_L = ['WW', 'KW']
const S_LOOK_R = ['WW', 'WK']
const S_STEP = ['.EDEDEEE']

const SMALL: Art = {
  w: 16,
  h: 10,
  body: both([
    '.E.E.EE.',
    'ErErEWWE',
    'ERRREWKE',
    '.ERE.ERE',
    '.ERRErrr',
    '.ERRRRRE',
    '.EDDDDDD',
  ]),
  feet: {
    stand: pair([...S_STEP, '..D.D...'], [...S_STEP, '..D.D...']),
    a: pair([...S_STEP, '.D.D....'], [...S_STEP, '........']),
    b: pair([...S_STEP, '........'], [...S_STEP, '.D.D....']),
  },
  sitFeet: both(S_STEP),
  shut: ['rr', 'EE'],
  joy: ['WW', 'EE'],
  lookL: S_LOOK_L,
  lookR: S_LOOK_R,
  eye: 5,
  eyeEdge: 4,
  eyeRows: 3,
  claw: 3,
  raise: 1,
  arm: '.ERE', // the claw's right edge is also the eye's
  bubbles: [
    [-1, 6, ['O']],
    [-1, 10, ['O']],
  ],
  armless: ['....', '....', '....', '....', '....', '...E', '..ED'],
  nibble: [
    '.EE....',
    'ErEggg.',
    'ErrGGGg',
    '.ErE...',
  ],
  nibbleAt: [3, 0],
  tuck: 4,
  burrow: [
    { depth: 4 },
    { depth: 5, puff: true },
    { depth: 5 },
    { depth: 5, look: S_LOOK_L },
    { depth: 5, look: S_LOOK_R },
    { depth: 5 },
    { depth: 5, puff: true },
    { depth: 4 },
    { depth: 2 },
  ],
  deep: 4,
  mound: '..sSSSSSSSSSSs..',
  peekMound: '...sSSSSSSSSs...',
  puff: [
    [7, 2],
    [8, 1],
  ],
}

// Overwrite row r from column c with `text`, '.' included
function lay(rows: string[], r: number, c: number, text: string) {
  const row = rows[r] ?? ''
  rows[r] = row.slice(0, c) + text + row.slice(c + text.length)
}

function eyes(a: Art, rows: string[], top: number, inside: string[]) {
  stamp(rows, top + 1, a.eye, inside)
  stamp(rows, top + 1, a.w - a.eye - (inside[0]?.length ?? 0), inside)
}

const blank = (a: Art, n: number) => Array<string>(n).fill('.'.repeat(a.w))

// Standing on its legs, or sat down with them folded; `top` is the body's first row
function standing(a: Art, legs: Exclude<Legs, 'sit'>) {
  const top = a.h - a.body.length - a.feet[legs].length
  return { top, rows: [...blank(a, top), ...a.body, ...a.feet[legs]] }
}
function sitting(a: Art) {
  const top = a.h - a.body.length - a.sitFeet.length
  return { top, rows: [...blank(a, top), ...a.body, ...a.sitFeet] }
}

// Both claws thrown up higher, bubbles floating up between them
function cheer(a: Art, rows: string[], top: number) {
  for (const c of [0, a.w - 5]) {
    const claw = rows.slice(top, top + a.claw).map(r => r.slice(c, c + 5))
    for (let i = 0; i < a.claw; i++) lay(rows, top + i, c ? a.w - a.arm.length : 0, c ? [...a.arm].reverse().join('') : a.arm)
    claw.forEach((part, i) => lay(rows, top - a.raise + i, c, part))
  }
  eyes(a, rows, top, a.joy)
  for (const [r, c, b] of a.bubbles) stamp(rows, top + r, c, b)
}

// The left claw brought round to its mouth with seaweed; `chew` swaps to the other claw
function nibbling(a: Art, s: Scene): string[] {
  const { top, rows } = sitting(a)
  a.armless.forEach((m, i) => lay(rows, top + i, 0, m))
  stamp(rows, top + a.nibbleAt[0], a.nibbleAt[1], a.nibble)
  return s.chew ? flip(rows) : rows
}

// Asleep: sat down, eyes shut and lowered onto the shell, claws tucked in at its sides
function sleeping(a: Art): string[] {
  const { top, rows } = sitting(a)
  const e = a.eyeEdge
  const middle = ['.'.repeat(a.w - 2 * e), ...rows.slice(top, top + a.eyeRows).map(r => r.slice(e, a.w - e))]
  middle.forEach((m, i) => lay(rows, top + i, e, m))
  const n = a.armless[0]?.length ?? 0
  a.armless.forEach((m, i) => {
    lay(rows, top + i, 0, m)
    lay(rows, top + i, a.w - n, [...m].reverse().join(''))
  })
  eyes(a, rows, top + 1, a.shut)
  const claw = a.body.slice(0, a.claw).map(r => r.slice(0, 5))
  stamp(rows, top + a.tuck, 0, claw)
  stamp(rows, top + a.tuck, a.w - 5, claw)
  return rows
}

function burrowing(a: Art, spin: number): string[] {
  const dig = a.burrow[(spin - 1) % a.burrow.length] ?? { depth: a.deep }
  const { top, rows: body } = standing(a, 'stand')
  if (dig.look) eyes(a, body, top, dig.look)
  let rows = [...blank(a, dig.depth), ...body.slice(0, a.h - dig.depth)]
  // Deep down, only the eyestalks stick out
  const deep = dig.depth > a.deep
  const e = a.eyeEdge
  if (deep) rows = rows.map(r => '.'.repeat(e) + r.slice(e, a.w - e) + '.'.repeat(e))
  rows[a.h - 1] = deep ? a.peekMound : a.mound
  if (dig.puff)
    for (const [r, c] of a.puff) {
      put(rows, r, c, 's')
      put(rows, r, a.w - 1 - c, 's')
    }
  return rows
}

function sprite(a: Art, s: Scene): string[] {
  if (s.spin > 0) return burrowing(a, s.spin)
  if (s.isAsleep) return sleeping(a)
  if (s.isMunching) return nibbling(a, s)
  const { top, rows } = s.legs === 'sit' ? sitting(a) : standing(a, s.legs)
  // Happy, its eyes are already shut in a smile, so it doesn't blink
  if (s.isHappy) cheer(a, rows, top)
  else if (s.isBlinking) eyes(a, rows, top, a.shut)
  return rows
}

// ---------------------------------------------------------------- drawing

const TERM = {
  E: '#2a1214',
  R: '#e8604c',
  r: '#f79a7e',
  D: '#b23a2c',
  W: '#f4ece0',
  K: '#33304a',
  w: '#ffffff',
  G: '#3f9a4a',
  g: '#7cc96a',
  O: '#9fd8f0',
  S: '#e6c98a',
  s: '#c9a764',
}

const SVG = {
  E: '#1f0c0e',
  R: '#e05a46',
  r: '#f2907a',
  D: '#a8352a',
  W: '#f4ece0',
  K: '#2c2940',
  w: '#ffffff',
  G: '#368c41',
  g: '#72bf60',
  O: '#8fcde8',
  S: '#dcc083',
  s: '#bf9d5c',
}


const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*snaps at bug*', 'snip snip!'])
  if (/\b(test|spec)/.test(t)) return pick(['tests? *clack*', 'pinch-tested!'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['ship it sideways', 'to the sea!'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['*tidies shell*', 'neat and snappy'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['*happy clacks*', 'shucks!'])
  if (/\b(food|lunch|snack|eat)/.test(t)) return pick(['seaweed?', 'snack time!'])
  if (text.trim().endsWith('?')) return pick(['hmm? *blinks*', '*tilts eyes*'])
  return pick(['sideways!', '*snaps claws*', '*click clack*', 'on it!', '*scuttles*'])
}

function build(a: Art): Character {
  const { w: W, h: H } = a
  return {
    width: W,
    canMunch: true,
    rolls: true, // it burrows where others jump
    stride: 0,
    pace: 1,
    snackLane: 0,
    chases: false,

    terminal(s, cols, rows) {
      // As many pixel rows as the band allows (the headroom goes first); feet on the bottom row
      const pixelRows = Math.min(H, rows - (rows % 2))
      return {
        rows: halfBlocks(sprite(a, s), pixelRows - H, W, pixelRows, TERM),
      }
    },

    svg(s, cols) {
      const sp = sprite(a, s)
      const w = cols * CELL
      const size = W * PX
      const groundY = H * PX + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - H * PX - s.air * LIFT

      return (
        svgOpen(w, h) +
        `<rect x="0" y="${groundY}" width="${w}" height="3" fill="#d8bd7e"/>` +
        // No shadow while it's under the sand
        (s.spin > 0 ? '' : shadowSvg(s, ox, size, groundY, PX)) +
        // A faint light rim so the dark outline still reads on a dark background
        outline(sp, ox, oy, PX, '#5d5658') +
        pixels(sp, ox, oy, PX, SVG) +
        bubbleSvg(s, ox, oy, size, w, PX) +
        `</svg>`
      )
    },

    lines: {
      hi: '*click clack*',
      jump: '*burrows*',
      done: ['*snip snip!*', 'done! *clack*', 'shell yeah.'],
      abort: '*hides in sand*',
      error: '*pinches it*',
      snack: ['*nibble*', 'seaweed!', '*munch munch*'],
      react,
    },
  }
}

export const crab = build(NORMAL)
export const crabSmall = build(SMALL)
