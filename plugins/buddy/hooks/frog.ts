import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The frog: a green frog, drawn in half blocks in the terminal and as pixels
// on the desktop. Facing right. It hop-walks, leaps twice as high as the
// others, and for a snack zaps a fly with its tongue when it comes within reach.
//
// Pixels: E outline, pupil line and closed eyes, G skin, g folded and
// stretched legs, Y belly, C croak sac, W eye white, K pupil, w eye glint,
// T tongue, F fly, f fly wings

// One size of frog: its poses, where the eye and croak sac go on them, its
// tongue, and its fly
type Art = {
  /** Every pose is w × h; the leap's headroom (air) goes on top */
  w: number
  h: number
  air: number
  crouch: string[]
  hop: string[]
  leap: string[]
  /** Top left of the eye white in the crouch, hop and leap */
  eye: { crouch: [number, number]; hop: [number, number]; leap: [number, number] }
  shut: string[]
  joy: string[]
  /** The croak sac and its top left on the crouch */
  sac: string[]
  sacAt: [number, number]
  mouth: [number, number]
  /** Columns in front its tongue reaches */
  reach: number
  /** The fly's two flaps, and the fly stuck on the tongue */
  fly: string[][]
  stuck: string[]
}

// Sitting with its legs folded; also standing, the first walk step and asleep
const CROUCH = [
  '..................',
  '........EEEE......',
  '.......EWWWWE.....',
  '.......EWKwWE.....',
  '....EEEEWKKWEE....',
  '...EGGGEWWWWEGE...',
  '..EGGGGGEEEEGGGE..',
  '.EGGGGGGGGGGGGGE..',
  'EGGGGGGGGEGGGGGE..',
  'EGGGEEEGGGEEEEEE..',
  'EGGEgggEGGEYYYE...',
  'EGEgggggEGEYYE....',
  'EGEgggggEGGEEE....',
  '.EEEEEEEEEEEEE....',
]

// The second walk step: a little hop, raised up on its stretched legs
const HOP = [
  '..........EEEE....',
  '.........EWWWWE...',
  '.........EWKwWE...',
  '......EEEEWKKWEE..',
  '.....EGGGEWWWWEGE.',
  '....EGGGGGEEEEGGGE',
  '...EGGGGGGGGGGGGGE',
  '..EGGGGGGGGEGGGGGE',
  '..EGGGGGGGGGEEEEEE',
  '..EggGGGGGGEYYYYE.',
  '.EgggEGGGGEYYYYE..',
  'EggEE.EEEEGGEEE...',
  'EgE.......EGGE....',
  'EEEE.......EEEE...',
]

// In the air: stretched out flat, legs kicked back, arms reaching down
const LEAP = [
  '...........EEEE...',
  '..........EWWWWE..',
  '..........EWKwWE..',
  '.......EEEEWKKWEE.',
  '......EGGGEWWWWEGE',
  '.....EGGGGGEEEEGGE',
  '....EGGGGGGGGGGGGE',
  '..EEGGGGGGGGEGGGGE',
  '.EggEGGGGGGGGEEEEE',
  'EgggEGGGGGGGEYYYYE',
  'EggggEEGGGGEYYYYEE',
  '.EEgggEEEEEEEEEEGE',
  '...EEEE.......EGE.',
  '..............EE..',
]

const NORMAL: Art = {
  w: 18,
  h: 14,
  air: 8, // pixel rows of headroom: it leaps 2 pixels per unit of air
  crouch: CROUCH,
  hop: HOP,
  leap: LEAP,
  // Laid over the eye white (4 × 4, at its top left in each pose)
  eye: { crouch: [2, 8], hop: [1, 10], leap: [1, 11] },
  shut: ['GGGG', 'EGGE', 'GEEG', 'GGGG'],
  joy: ['GGGG', 'GEEG', 'EGGE', 'GGGG'],
  // Happy and sitting, its throat puffs out
  sac: ['ECCCCE.', 'ECCCCCE', 'GECCCE.', 'EEEEE..'],
  sacAt: [10, 10],
  // Its snack is a fly loose in the band (the engine's critter). The frog draws it
  // wherever it is; once its tongue has hit it, the catch: the tongue on the fly,
  // then halfway back with the fly stuck on the end, then a gulp
  mouth: [9, 15],
  reach: 8,
  fly: [
    ['.f.', 'FFF'],
    ['f.f', 'FFF'],
  ],
  stuck: ['FFF'],
}

// The small frog (/buddy size small): the same poses redrawn smaller, never
// shrunk. Its leap is capped at its 7 rows of headroom
const SMALL: Art = {
  w: 14,
  h: 11,
  air: 7,
  crouch: [
    '..............',
    '......EEEE....',
    '.....EWKwWE...',
    '..EEEEWKKWEE..',
    '.EGGGEWWWWEGE.',
    'EGGGGGEEEEGGE.',
    'EGGGGGGGEGGGE.',
    'EGGEEEGGGEEEE.',
    'EGEgggEGEYYE..',
    'EGEgggEGGEE...',
    '.EEEEEEEEEE...',
  ],
  hop: [
    '.......EEEE...',
    '......EWKwWE..',
    '...EEEEWKKWEE.',
    '..EGGGEWWWWEGE',
    '.EGGGGGEEEEGGE',
    '.EGGGGGGGEGGGE',
    '.EggGGGGGGEEEE',
    'EgggEGGGGEYYE.',
    'EggEEEEEGGEE..',
    'EgE....EGGE...',
    'EEE.....EEEE..',
  ],
  leap: [
    '.......EEEE...',
    '......EWKwWE..',
    '....EEEWKKWEE.',
    '...EGGEWWWWEGE',
    '..EGGGGEEEEGGE',
    '.EEGGGGGGGEGGE',
    'EggEGGGGGGGEEE',
    'EgggEGGGGGEYYE',
    '.EEggEEEEEEEGE',
    '...EEE.....EGE',
    '...........EE.',
  ],
  // The eye white is 4 × 3 here
  eye: { crouch: [2, 6], hop: [1, 7], leap: [1, 7] },
  shut: ['EGGE', 'GEEG', 'GGGG'],
  joy: ['GEEG', 'EGGE', 'GGGG'],
  sac: ['ECCCE', 'GECCE', 'EEEEE'],
  sacAt: [8, 8],
  mouth: [7, 12],
  reach: 6, // the engine holds the fly about 6 columns ahead of the mouth
  fly: [
    ['f.', 'FF'],
    ['.f', 'FF'],
  ],
  stuck: ['FF'],
}

// The pixels on a straight line from one point to another
function line([r0, c0]: [number, number], [r1, c1]: [number, number]): [number, number][] {
  const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0), 1)
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(r0 + ((r1 - r0) * i) / n), Math.round(c0 + ((c1 - c0) * i) / n)])
}

function sprite(a: Art, s: Scene): string[] {
  const [base, [er, ec]]: [string[], [number, number]] = s.air > 0 ? [a.leap, a.eye.leap] : s.legs === 'b' ? [a.hop, a.eye.hop] : [a.crouch, a.eye.crouch]
  const rows = [...base]
  if (s.isAsleep || s.isBlinking) stamp(rows, er, ec, a.shut)
  else if (s.isHappy) stamp(rows, er, ec, a.joy)
  // The throat bulges when it's happy, and when it gulps down a fly
  const gulping = s.critter !== null && s.critter.caught >= 2
  if (base === a.crouch && (gulping || (s.isHappy && !s.isAsleep && !s.isBlinking))) {
    stamp(rows, a.sacAt[0], a.sacAt[1], a.sac)
  }
  return mirror(rows, s.dir)
}

// Pixel rows it's lifted off the ground: 2 per unit of air, up to its headroom
const lift = (a: Art, s: Scene) => Math.min(2 * s.air, a.air)

// The frog and its fly (and tongue) together, in band columns from `left`,
// with the leap's headroom on top. The fly may be anywhere, or past an edge
function withFly(a: Art, s: Scene, cols: number): { rows: string[]; left: number } {
  const fly = s.critter && s.critter.caught < 2 ? s.critter : null
  const left = Math.max(0, Math.min(s.x, fly ? fly.x : s.x))
  const right = Math.min(cols, Math.max(s.x + a.w, fly ? fly.x + (a.fly[0]?.[0]?.length ?? 0) : 0))
  const rows = Array.from({ length: a.h + a.air }, () => '.'.repeat(Math.max(a.w, right - left)))
  stamp(rows, a.air - lift(a, s), s.x - left, sprite(a, s))
  if (!fly) return { rows, left }
  const wings = a.fly[fly.age % 2] ?? []
  const [fr, fc] = [a.air + fly.row, fly.x - left]
  if (fly.caught < 0) {
    stamp(rows, fr, fc, wings)
    return { rows, left }
  }
  const mouth: [number, number] = [a.air + a.mouth[0], s.x - left + (s.dir === 1 ? a.mouth[1] : a.w - 1 - a.mouth[1])]
  const tip: [number, number] = [fr + 1, fc + 1]
  const end: [number, number] =
    fly.caught === 0 ? tip : [Math.round((mouth[0] + tip[0]) / 2), Math.round((mouth[1] + tip[1]) / 2)]
  for (const [r, c] of line(mouth, end)) put(rows, r, c, 'T')
  stamp(rows, end[0] - 1, end[1] - 1, fly.caught === 0 ? wings : a.stuck)
  return { rows, left }
}

// The fly and tongue on the desktop, in pixels: the frog at ox, its standing top at y0
function flySvg(a: Art, s: Scene, ox: number, y0: number): string {
  const fly = s.critter && s.critter.caught < 2 ? s.critter : null
  if (!fly) return ''
  const wings = a.fly[fly.age % 2] ?? []
  const [fx, fy] = [fly.x * CELL, y0 + fly.row * PX]
  if (fly.caught < 0) return pixels(wings, fx, fy, PX, SVG)
  const [mx, my] = [ox + (s.dir === 1 ? a.mouth[1] : a.w - 1 - a.mouth[1]) * PX, y0 + a.mouth[0] * PX]
  const [tx, ty] = [fx + PX, fy + PX]
  const [ex, ey] = fly.caught === 0 ? [tx, ty] : [(mx + tx) / 2, (my + ty) / 2]
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(ex - mx), Math.abs(ey - my)) / PX))
  let tongue = ''
  for (let i = 0; i <= n; i++) {
    tongue += `<rect x="${Math.round(mx + ((ex - mx) * i) / n)}" y="${Math.round(my + ((ey - my) * i) / n)}" width="${PX}" height="${PX}" fill="${SVG.T}"/>`
  }
  return tongue + pixels(fly.caught === 0 ? wings : a.stuck, ex - PX, ey - PX, PX, SVG)
}

const TERM = {
  E: '#1b3d20',
  G: '#5cbf4a',
  g: '#46a03c',
  Y: '#d6e98f',
  C: '#eef6c4',
  W: '#f4f2e8',
  w: '#ffffff',
  K: '#0e1a10',
  T: '#ef7f9a',
  F: '#6a6a78',
  f: '#d8eef8',
}
const SVG = { ...TERM, E: '#12301a', G: '#4fae40', g: '#3c8e34', T: '#e26e8a', F: '#5a5a66' }


const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*eyes the bug*', 'bugs? yum.'])
  if (/\b(test|spec)/.test(t)) return pick(['ribbit. tests.', 'green is good.'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['leap of faith.', 'hop to it.'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['tidy pond.', 'ribbit.'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['ribbit :)', '*happy croak*'])
  if (/\b(food|lunch|snack|eat|fly)/.test(t)) return pick(['fly?', '*licks lips*'])
  if (text.trim().endsWith('?')) return pick(['ribbit?', '*blinks slowly*'])
  return pick(['ribbit.', '*blinks slowly*', 'croak.', '*sits*', 'mm.'])
}

function build(a: Art): Character {
  return {
    width: a.w,
    canMunch: false,
    rolls: false,
    stride: 2, // a frog leaps about a body length
    snackLane: 0,
    chases: false,
    tongue: { mouth: a.mouth, reach: a.reach },
    pace: 1,

    terminal(s, cols) {
      const { rows, left } = withFly(a, s, cols)
      return {
        rows: halfBlocks(rows, 0, rows[0]?.length ?? a.w, a.h + a.air, TERM),
        offset: s.x - left,
      }
    },

    svg(s, cols) {
      const sp = sprite(a, s)
      const w = cols * CELL
      const size = a.w * PX
      const groundY = a.h * PX + a.air * LIFT + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - a.h * PX - lift(a, s) * LIFT

      return (
        svgOpen(w, h) +
        `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#6fae5a"/>` +
        shadowSvg(s, ox, size, groundY, PX) +
        // A faint light rim so the dark outline still reads on a dark background
        outline(sp, ox, oy, PX, '#5d6658') +
        pixels(sp, ox, oy, PX, SVG) +
        flySvg(a, s, ox, groundY - a.h * PX) +
        bubbleSvg(s, ox, oy, size, w, PX) +
        `</svg>`
      )
    },

    lines: {
      hi: 'ribbit',
      jump: 'boing!',
      done: ['ribbit!!', '*happy croak*', 'hop hop!'],
      abort: '*plop*',
      error: 'croak...',
      snack: ['*zap*', 'gulp', 'mmm fly'],
      react,
    },
  }
}

export const frog = build(NORMAL)
export const frogSmall = build(SMALL)
