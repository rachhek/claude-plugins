import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, stamp, svgOpen, turn } from './shared'
import type { Character } from './shared'

// The panda: pixel art for sitting and walking, facing right, drawn one art
// pixel to one half block in the terminal (never resized, so it stays crisp)
// and as pixels on the desktop. Blinking, chewing and the bamboo are drawn
// over the sitting sprite in code.
//
// Pixels: E outline and eyes, K dark fur, k lighter dark fur (far legs),
// W white fur, S shaded white fur, w eye glint, L closed-eye line, R open mouth,
// G bamboo, g bamboo leaf
type Pose = { w: number; h: number; sprite: string[] }

// One size of panda: its poses, and where blinking and the bamboo go on the sitting one
type Art = {
  sit: string[]
  eat: string[]
  /** Sitting-pose row the bamboo starts on */
  eatRow: number
  /** The two pixels the jaw drops into while chewing, in the widened sitting pose */
  jaw: [number, number][]
  /** Eye pixels: shut, the top one goes dark fur and the bottom one a lighter line */
  eyes: [number, number][]
  walk: string[][]
  ball: string[]
}

const SIT = [
  '..EEE.......EEE..',
  '.EKKKE.....EKKKE.',
  '.EKKKKEEEEEKKKKE.',
  '..EKKWWWWWWWKKE..',
  '.EWWKKKWWWKKKWWE.',
  '.EWKEwKWWWKEwKWE.',
  'EWKKEEKWWWKEEKKWE',
  'EWKKKWWKKKWWKKKWE',
  '.EWWWWWWEWWWWWWE.',
  '..EEWWWWWWWWWEE..',
  '.EKKEEEEEEEEEKKE.',
  '.EKKKEWWWWWEKKKE.',
  '.EKKKKEWWWEKKKKE.',
  'EKKEKKEWWWEKKEKKE',
  'EKKKEWWWWWWWEKKKE',
  'EKKKESSSSSSSEKKKE',
  '.EEEEEEEEEEEEEEE.',
]

// Eating, laid over the sitting pose (widened two columns each side) from
// row 3: a stalk of bamboo held in one paw, running up through its mouth and
// out past its cheek, leaves at the top
const EAT = [
  '...................g.',
  '....................g',
  '..................ggG',
  '................ggGG.',
  '..............gGGG...',
  '...........gggGE.....',
  '......EEEggGGG.......',
  '....EEkkgGG..........',
  '....EkkkG............',
  '...gGGkk.............',
  '.ggGE.EE.............',
  '.GG..................',
]

// The walking panda, facing right. One step shows all four legs apart, the
// far ones a shade lighter; the next shows only the near two, hiding the far
const WALK = [
  [
    '..............EEE..EEE.',
    '.............EKKKEEKKKE',
    '.............EKKWWWWKKE',
    '....EEEEEEEEEWWWWWWWWWE',
    '...EWWWWWWKKKKWWWKKKWWE',
    '..EWWWWWWWKKKKWWKEwKWWE',
    '..EWWWWWWWKKKKWKKEEKWKE',
    '.EWWWWWWWWKKKKKWKKKWWE.',
    '.EWWWWWWWWKKKKKKWWWWE..',
    'EKWWWWWWWSKKKKKKEEEE...',
    '.EWWWWWWSSKKKKKKE......',
    '..EKKKSSSKKKKKKE.......',
    'EKKKEkkkEkkkEKKKE......',
    'EKKKEkkkEkkkEKKKE......',
    'EKKKEkkkEkkkEKKKE......',
    '.EEE.EEE.EEE.EEE.......',
  ],
  [
    '..............EEE..EEE.',
    '.............EKKKEEKKKE',
    '.............EKKWWWWKKE',
    '....EEEEEEEEEWWWWWWWWWE',
    '...EWWWWWWKKKKWWWKKKWWE',
    '..EWWWWWWWKKKKWWKEwKWWE',
    '..EWWWWWWWKKKKWKKEEKWKE',
    '.EWWWWWWWWKKKKKWKKKWWE.',
    '.EWWWWWWWWKKKKKKWWWWE..',
    'EKWWWWWWWSKKKKKKEEEE...',
    '.EWWWWWWSSKKKKKKE......',
    '..EKKKSSSKKKKKKE.......',
    '..EKKKKE.EKKKKE........',
    '..EKKKKE.EKKKKE........',
    '.EKKKKE...EKKKKE.......',
    '.EEEEE.....EEEEE.......',
  ],
]

// Curled into a ball for a roll, eyes shut; turned a quarter every other tick
const BALL = [
  '....EEEEE....',
  '..EEKKWWWEE..',
  '.EKKKWWWWWWE.',
  '.EKKWWWWKKWE.',
  'EWWWWWWKKKKWE',
  'EWWWWWWKLLKWE',
  'EWWWWWWWKKWWE',
  'EWWWWWWWWWEWE',
  'EKKKWWWWWWWWE',
  '.EKKKKWWWKKE.',
  '.EKKKKKKKKKE.',
  '..EEKKKKKEE..',
  '....EEEEE....',
]

const NORMAL: Art = {
  sit: SIT,
  eat: EAT,
  eatRow: 3,
  jaw: [[10, 8], [10, 9]],
  eyes: [[5, 4], [5, 5], [5, 11], [5, 12]],
  walk: WALK,
  ball: BALL,
}

// The small panda (/buddy size small): the same poses redrawn smaller, never shrunk
const SMALL: Art = {
  sit: [
    '.EEE.....EEE.',
    'EKKKE...EKKKE',
    'EKKKEEEEEKKKE',
    '.EKWWWWWWWKE.',
    'EWWKKKWKKKWWE',
    'EWKEwKWKEwKWE',
    'EWKKKWEWKKKWE',
    '.EWWWWWWWWWE.',
    '..EEWWWWWEE..',
    '.EKKEEEEEKKE.',
    'EKKKEWWWEKKKE',
    'EKKKEWWWEKKKE',
    'EKKKESSSEKKKE',
    '.EEEEEEEEEEE.',
  ],
  eat: [
    '................g',
    '..............gG.',
    '...........GGG...',
    '.......GGGG......',
    '.....kkG.........',
    '....kkG..........',
    '..GGkk...........',
    '.GG..............',
    'GG...............',
  ],
  eatRow: 4,
  jaw: [[8, 8], [8, 9]],
  eyes: [[5, 3], [5, 4], [5, 8], [5, 9]],
  walk: [
    [
      '...........EE.EE.',
      '..........EKKEKKE',
      '..........EKWWWKE',
      '...EEEEEEEWWWWWWE',
      '..EWWWWWKKKWWKKWE',
      '.EWWWWWWKKKWKEwKE',
      '.EWWWWWWKKKWWKKWE',
      'EKWWWWWWKKKKWWWE.',
      '.EWWWWWSKKKKEEE..',
      '..EKKSSKKKKE.....',
      'EKKEkkEkkEKKE....',
      'EKKEkkEkkEKKE....',
      '.EE.EE.EE.EE.....',
    ],
    [
      '...........EE.EE.',
      '..........EKKEKKE',
      '..........EKWWWKE',
      '...EEEEEEEWWWWWWE',
      '..EWWWWWKKKWWKKWE',
      '.EWWWWWWKKKWKEwKE',
      '.EWWWWWWKKKWWKKWE',
      'EKWWWWWWKKKKWWWE.',
      '.EWWWWWSKKKKEEE..',
      '..EKKSSKKKKE.....',
      '..EKKE.EKKE......',
      '.EKKE...EKKE.....',
      '.EEE.....EEE.....',
    ],
  ],
  ball: [
    '...EEEE...',
    '.EEKKWWEE.',
    '.EKWWWKKE.',
    'EWWWWKLLKE',
    'EWWWWWKKWE',
    'EWWWWWWWWE',
    'EKKWWWWWWE',
    '.EKKKWWKE.',
    '.EEKKKKEE.',
    '...EEEE...',
  ],
}

function sitting(a: Art, s: Scene): Pose {
  const rows = [...a.sit]
  const w = a.sit[0]?.length ?? 0
  if (s.isAsleep || s.isBlinking) {
    // Each eye a lighter line in its patch
    for (const [r, c] of a.eyes) {
      put(rows, r, c, 'K')
      put(rows, r + 1, c, 'L')
    }
  }
  if (!s.isMunching) return { w, h: rows.length, sprite: rows }
  const wide = rows.map(r => `..${r}..`)
  stamp(wide, a.eatRow, 0, a.eat)
  // The jaw drops while it chews
  if (s.chew) for (const [r, c] of a.jaw) put(wide, r, c, 'R')
  return { w: w + 4, h: rows.length, sprite: wide }
}

function walking(a: Art, s: Scene): Pose {
  const frame = a.walk[s.legs === 'b' ? 1 : 0] ?? a.walk[0] ?? []
  return { w: frame[0]?.length ?? 0, h: frame.length, sprite: [...frame] }
}

function rolling(a: Art, s: Scene): Pose {
  let sprite = a.ball
  for (let i = 0; i < Math.floor(s.spin / 2) % 4; i++) sprite = turn(sprite)
  return { w: a.ball.length, h: a.ball.length, sprite }
}

function pose(a: Art, s: Scene): Pose {
  // Pandas don't jump, they roll
  if (s.spin > 0) return rolling(a, s)
  // Asleep, it sits with its eyes closed; the bubble says zZz
  if (s.isAsleep) return sitting(a, s)
  if (s.air === 0 && (s.legs === 'a' || s.legs === 'b')) return walking(a, s)
  return sitting(a, s)
}

// ---------------------------------------------------------------- drawing

const TERM = {
  E: '#1e2026',
  K: '#3c4452',
  k: '#505866',
  P: '#505866',
  W: '#f0eade',
  S: '#bdb5ad',
  w: '#ffffff',
  N: '#1e2026',
  L: '#9aa0a8',
  B: '#101216',
  R: '#a04a5a',
  G: '#7bc96f',
  g: '#a5dc8f',
}

const SVG = {
  O: '#0b0c10',
  E: '#0b0c10',
  K: '#2b3340',
  k: '#3f4753',
  P: '#3f4753',
  W: '#f0eade',
  S: '#c0b8b0',
  w: '#ffffff',
  N: '#0b0c10',
  L: '#8a9099',
  B: '#07080a',
  R: '#9c3f52',
  G: '#5fae45',
  g: '#93d07a',
}


const PX = 6
const UNIT = 4 // grass, shadow and speech bubble keep their own pixel size
const CELL = 8
const LIFT = 5
const AIR = 4

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*cracks knuckles*', 'bug? easy.'])
  if (/\b(test|spec)/.test(t)) return pick(['tests. nice.', 'go green.'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['ship it.', 'send it.'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['clean.', 'respect.'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['anytime.', 'np.'])
  if (/\b(food|lunch|snack|eat)/.test(t)) return pick(['bamboo?', 'snack break.'])
  if (text.trim().endsWith('?')) return pick(['hmm.', 'good q.', '*thinks*'])
  return pick(['on it.', 'yep.', "let's go.", 'bet.', '*nods*'])
}

function build(a: Art): Character {
  const sitH = a.sit.length
  const termW = a.walk[0]?.[0]?.length ?? 0 // the walking pose's width; the sitting one is centred in it
  // Pixel rows: the sitting pose and the highest jump, kept even
  const termRows = sitH + AIR + ((sitH + AIR) % 2)
  return {
    width: termW,
    canMunch: true,
    rolls: true,
    stride: 0.5,
    snackLane: 0,
    chases: false,
    pace: 2, // pandas take it easy

    terminal(s, cols, rows) {
      const p = pose(a, s)
      const pad = '.'.repeat(Math.floor((termW - p.w) / 2))
      const sp = mirror(p.sprite, s.dir).map(r => pad + r)
      // As many pixel rows as the band allows, up to the cap; feet on the bottom row
      const pixelRows = Math.min(termRows, rows - (rows % 2))
      const lift = Math.max(0, Math.min(s.air, pixelRows - p.h))
      return {
        rows: halfBlocks(sp, pixelRows - p.h - lift, termW, pixelRows, TERM),
      }
    },

    svg(s, cols) {
      const p = pose(a, s)
      const sp = mirror(p.sprite, s.dir)
      const w = cols * CELL
      const size = p.w * PX
      const groundY = (sitH + 1) * PX + AIR * LIFT + 2 * UNIT
      const h = groundY + 3 * UNIT
      // Centred in the widest pose, as in the terminal
      const ox = s.x * CELL + Math.floor((termW - p.w) / 2) * PX
      // The bottom row is the outline, so it sinks one pixel into the ground
      const oy = groundY - p.h * PX + PX - s.air * LIFT

      const grass: string[] = []
      for (let i = 0; i < w; i += 9 * UNIT) {
        const gx = i + 2 * UNIT
        grass.push(
          `<rect x="${gx}" y="${groundY - UNIT}" width="${UNIT}" height="${UNIT}" fill="#86b96e"/>` +
            `<rect x="${gx + 2 * UNIT}" y="${groundY - 2 * UNIT}" width="${UNIT}" height="${2 * UNIT}" fill="#86b96e"/>`,
        )
      }

      return (
        svgOpen(w, h) +
        `<rect x="0" y="${groundY}" width="${w}" height="${UNIT * 0.6}" fill="#a8cf93"/>` +
        grass.join('') +
        shadowSvg(s, ox, size, groundY, UNIT) +
        // A faint light rim so the dark outline still reads on a dark background
        outline(sp, ox, oy, PX, '#5d5658') +
        pixels(sp, ox, oy, PX, SVG) +
        bubbleSvg(s, ox, oy, size, w, UNIT) +
        `</svg>`
      )
    },

    lines: {
      hi: 'yo.',
      jump: 'wheee~',
      done: ['nailed it.', 'done.', 'ez.'],
      abort: 'k.',
      error: 'oof.',
      snack: ['*munch*', 'nom', '*crunch*'],
      react,
    },
  }
}

export const panda = build(NORMAL)
export const pandaSmall = build(SMALL)
