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
const W = 20
const H = 14 // the 12-row crab and two rows above it for raised claws and bubbles

// Half a row and its mirror image: the crab is symmetric
const both = (half: string[]) => half.map(r => r + [...r].reverse().join(''))
const flip = (rows: string[]) => mirror(rows, -1)

// Claws, eyes and shell, without legs
const BODY = both([
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
])

// Three legs a side (left half): standing straight, splayed out, lifted
const STRAIGHT = ['.EDEDEDEEE', '..D.D.D...']
const SPLAYED = ['.EDEDEDEEE', '.D.D.D....']
const LIFTED = ['.EDEDEDEEE', '..........']
const pair = (left: string[], right: string[]) => left.map((l, i) => l + [...(right[i] ?? '')].reverse().join(''))

// Scuttling sideways: one side's legs reach out while the other side's lift
const FEET: Record<Exclude<Legs, 'sit'>, string[]> = {
  stand: pair(STRAIGHT, STRAIGHT),
  a: pair(SPLAYED, LIFTED),
  b: pair(LIFTED, SPLAYED),
}
const SIT_FEET = both(['.EDEDEDEEE'])

// The inside of each eye (3 × 3), for looking about, blinking and smiling
const SHUT = ['rrr', 'EEE', 'RRR']
const JOY = ['WWW', 'WEW', 'EWE']
const LOOK_L = ['WWW', 'KwW', 'KKW']
const LOOK_R = ['WWW', 'WwK', 'WKK']

// Overwrite row r from column c with `text`, '.' included
function lay(rows: string[], r: number, c: number, text: string) {
  const row = rows[r] ?? ''
  rows[r] = row.slice(0, c) + text + row.slice(c + text.length)
}

function eyes(rows: string[], top: number, inside: string[]) {
  stamp(rows, top + 1, 6, inside)
  stamp(rows, top + 1, 11, inside)
}

const blank = (n: number) => Array<string>(n).fill('.'.repeat(W))

// Standing on its legs, or sat down with them folded; `top` is the body's first row
const standing = (legs: Exclude<Legs, 'sit'>) => ({ top: 2, rows: [...blank(2), ...BODY, ...FEET[legs]] })
const sitting = () => ({ top: 3, rows: [...blank(3), ...BODY, ...SIT_FEET] })

// Both claws thrown up two rows higher, bubbles floating up between them
function cheer(rows: string[], top: number) {
  for (const c of [0, W - 5]) {
    const claw = rows.slice(top, top + 4).map(r => r.slice(c, c + 5))
    for (let i = 0; i < 4; i++) lay(rows, top + i, c, '.ERE.')
    claw.forEach((part, i) => lay(rows, top - 2 + i, c, part))
  }
  eyes(rows, top, JOY)
  stamp(rows, top - 2, 6, ['Ow', 'OO'])
  put(rows, top - 2, 13, 'O')
}

// Its left claw (in the lighter shade, to stand out from the shell) brought
// round to its mouth with a strip of seaweed; `chew` swaps to the other claw
const NIBBLE = [
  '.EEE......',
  'ErrrE.....',
  'ErEEgggg..',
  'ErrrGGGGg.',
  '.ErE......',
]
// The left side's columns with the raised claw and arm taken away
const ARMLESS = ['.....', '.....', '.....', '.....', '.....', '.....', '....E', '...ER', '..ERR', '..EDD']

function nibbling(s: Scene): string[] {
  const { top, rows } = sitting()
  ARMLESS.forEach((a, i) => lay(rows, top + i, 0, a))
  stamp(rows, top + 5, 1, NIBBLE)
  return s.chew ? flip(rows) : rows
}

// Asleep: sat down, eyes shut and lowered onto the shell, claws tucked in at its sides
function sleeping(): string[] {
  const { top, rows } = sitting()
  const middle = ['.'.repeat(W - 10), ...rows.slice(top, top + 4).map(r => r.slice(5, W - 5))]
  middle.forEach((m, i) => lay(rows, top + i, 5, m))
  ARMLESS.forEach((a, i) => {
    lay(rows, top + i, 0, a)
    lay(rows, top + i, W - 5, [...a].reverse().join(''))
  })
  eyes(rows, top + 1, SHUT)
  const claw = BODY.slice(0, 4).map(r => r.slice(0, 5))
  stamp(rows, top + 6, 0, claw)
  stamp(rows, top + 6, W - 5, claw)
  return rows
}

// Burrowing, a frame a tick: sinks into the sand, peeks out with just its
// eyes (looking about), and comes back up. `depth` is the rows it has sunk
type Dig = { depth: number; look?: string[]; puff?: boolean }
const BURROW: Dig[] = [
  { depth: 5 },
  { depth: 7, puff: true },
  { depth: 7 },
  { depth: 7, look: LOOK_L },
  { depth: 7, look: LOOK_R },
  { depth: 7 },
  { depth: 7, puff: true },
  { depth: 5 },
  { depth: 3 },
]
const MOUND = '..sSSSSSSSSSSSSSSs..'
const PEEK_MOUND = '....sSSSSSSSSSSs....'

function burrowing(spin: number): string[] {
  const dig = BURROW[(spin - 1) % BURROW.length] ?? { depth: 5 }
  const { top, rows: body } = standing('stand')
  if (dig.look) eyes(body, top, dig.look)
  let rows = [...blank(dig.depth), ...body.slice(0, H - dig.depth)]
  // Deep down, only the eyestalks stick out
  const deep = dig.depth > 5
  if (deep) rows = rows.map(r => '.....' + r.slice(5, W - 5) + '.....')
  rows[H - 1] = deep ? PEEK_MOUND : MOUND
  if (dig.puff)
    for (const [r, c] of [
      [H - 3, 2],
      [H - 2, 1],
      [H - 4, 3],
    ] as const) {
      put(rows, r, c, 's')
      put(rows, r, W - 1 - c, 's')
    }
  return rows
}

function sprite(s: Scene): string[] {
  if (s.spin > 0) return burrowing(s.spin)
  if (s.isAsleep) return sleeping()
  if (s.isMunching) return nibbling(s)
  const { top, rows } = s.legs === 'sit' ? sitting() : standing(s.legs)
  // Happy, its eyes are already shut in a smile, so it doesn't blink
  if (s.isHappy) cheer(rows, top)
  else if (s.isBlinking) eyes(rows, top, SHUT)
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

const SAND = '..,.~...,..~.,...~..,.'

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

export const crab: Character = {
  width: W,
  canMunch: true,
  rolls: true, // it burrows where others jump
  stride: 0,
  pace: 1,
  snackLane: 0,
  chases: false,

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += SAND[(i + s.ground) % SAND.length]
    // As many pixel rows as the band allows (the headroom goes first); feet on the bottom row
    const pixelRows = Math.min(H, rows - (rows % 2))
    return {
      rows: halfBlocks(sprite(s), pixelRows - H, W, pixelRows, TERM),
      ground,
      groundColor: 'yellow',
    }
  },

  svg(s, cols) {
    const sp = sprite(s)
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
