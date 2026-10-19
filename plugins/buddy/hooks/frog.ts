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
const W = 18
const H = 14
const AIR = 8 // pixel rows of headroom: it leaps 2 pixels per unit of air

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

// Laid over the eye white (4 × 4, at its top left in each pose)
const SHUT = ['GGGG', 'EGGE', 'GEEG', 'GGGG']
const JOY = ['GGGG', 'GEEG', 'EGGE', 'GGGG']
// Happy and sitting, its throat puffs out (from column 10)
const SAC: [number, string][] = [
  [10, 'ECCCCE.'],
  [11, 'ECCCCCE'],
  [12, 'GECCCE.'],
  [13, 'EEEEE..'],
]
// Its snack is a fly loose in the band (the engine's critter). The frog draws it
// wherever it is; once its tongue has hit it, the catch: the tongue on the fly,
// then halfway back with the fly stuck on the end, then a gulp
const MOUTH: [number, number] = [9, 15]
const REACH = 8 // columns in front its tongue reaches
const FLY = [
  ['.f.', 'FFF'],
  ['f.f', 'FFF'],
]

// The pixels on a straight line from one point to another
function line([r0, c0]: [number, number], [r1, c1]: [number, number]): [number, number][] {
  const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0), 1)
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(r0 + ((r1 - r0) * i) / n), Math.round(c0 + ((c1 - c0) * i) / n)])
}

function sprite(s: Scene): string[] {
  const [base, er, ec]: [string[], number, number] = s.air > 0 ? [LEAP, 1, 11] : s.legs === 'b' ? [HOP, 1, 10] : [CROUCH, 2, 8]
  const rows = [...base]
  if (s.isAsleep || s.isBlinking) stamp(rows, er, ec, SHUT)
  else if (s.isHappy) stamp(rows, er, ec, JOY)
  // The throat bulges when it's happy, and when it gulps down a fly
  const gulping = s.critter !== null && s.critter.caught >= 2
  if (base === CROUCH && (gulping || (s.isHappy && !s.isAsleep && !s.isBlinking))) {
    for (const [r, p] of SAC) stamp(rows, r, 10, [p])
  }
  return mirror(rows, s.dir)
}

// The frog and its fly (and tongue) together, in band columns from `left`,
// with the leap's headroom on top. The fly may be anywhere, or past an edge
function withFly(s: Scene, cols: number): { rows: string[]; left: number } {
  const fly = s.critter && s.critter.caught < 2 ? s.critter : null
  const left = Math.max(0, Math.min(s.x, fly ? fly.x : s.x))
  const right = Math.min(cols, Math.max(s.x + W, fly ? fly.x + 3 : 0))
  const rows = Array.from({ length: H + AIR }, () => '.'.repeat(Math.max(W, right - left)))
  stamp(rows, AIR - 2 * s.air, s.x - left, sprite(s))
  if (!fly) return { rows, left }
  const wings = FLY[fly.age % 2] ?? []
  const [fr, fc] = [AIR + fly.row, fly.x - left]
  if (fly.caught < 0) {
    stamp(rows, fr, fc, wings)
    return { rows, left }
  }
  const mouth: [number, number] = [AIR + MOUTH[0], s.x - left + (s.dir === 1 ? MOUTH[1] : W - 1 - MOUTH[1])]
  const tip: [number, number] = [fr + 1, fc + 1]
  const end: [number, number] =
    fly.caught === 0 ? tip : [Math.round((mouth[0] + tip[0]) / 2), Math.round((mouth[1] + tip[1]) / 2)]
  for (const [r, c] of line(mouth, end)) put(rows, r, c, 'T')
  stamp(rows, end[0] - 1, end[1] - 1, fly.caught === 0 ? wings : ['FFF'])
  return { rows, left }
}

// The fly and tongue on the desktop, in pixels: the frog at ox, its standing top at y0
function flySvg(s: Scene, ox: number, y0: number): string {
  const fly = s.critter && s.critter.caught < 2 ? s.critter : null
  if (!fly) return ''
  const wings = FLY[fly.age % 2] ?? []
  const [fx, fy] = [fly.x * CELL, y0 + fly.row * PX]
  if (fly.caught < 0) return pixels(wings, fx, fy, PX, SVG)
  const [mx, my] = [ox + (s.dir === 1 ? MOUTH[1] : W - 1 - MOUTH[1]) * PX, y0 + MOUTH[0] * PX]
  const [tx, ty] = [fx + PX, fy + PX]
  const [ex, ey] = fly.caught === 0 ? [tx, ty] : [(mx + tx) / 2, (my + ty) / 2]
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(ex - mx), Math.abs(ey - my)) / PX))
  let tongue = ''
  for (let i = 0; i <= n; i++) {
    tongue += `<rect x="${Math.round(mx + ((ex - mx) * i) / n)}" y="${Math.round(my + ((ey - my) * i) / n)}" width="${PX}" height="${PX}" fill="${SVG.T}"/>`
  }
  return tongue + pixels(fly.caught === 0 ? wings : ['FFF'], ex - PX, ey - PX, PX, SVG)
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

const GROUND = "_,._'__~~~~__.,_'___~~~__"

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

export const frog: Character = {
  width: W,
  canMunch: false,
  rolls: false,
  stride: 2, // a frog leaps about a body length
  snackLane: 0,
  chases: false,
  tongue: { mouth: MOUTH, reach: REACH },
  pace: 1,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    const { rows, left } = withFly(s, cols)
    return {
      rows: halfBlocks(rows, 0, rows[0]?.length ?? W, H + AIR, TERM),
      ground,
      groundColor: 'green',
      offset: s.x - left,
    }
  },

  svg(s, cols) {
    const sp = sprite(s)
    const w = cols * CELL
    const size = W * PX
    const groundY = H * PX + AIR * LIFT + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - H * PX - 2 * s.air * LIFT

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#6fae5a"/>` +
      shadowSvg(s, ox, size, groundY, PX) +
      // A faint light rim so the dark outline still reads on a dark background
      outline(sp, ox, oy, PX, '#5d6658') +
      pixels(sp, ox, oy, PX, SVG) +
      flySvg(s, ox, groundY - H * PX) +
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
