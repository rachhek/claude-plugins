import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The panda: pixel art for sitting and walking, facing right, drawn one art
// pixel to one half block in the terminal (never resized, so it stays crisp)
// and as pixels on the desktop. Blinking, chewing and the bamboo are drawn
// over the sitting sprite in code.
//
// Pixels: E outline and eyes, K dark fur, k lighter dark fur (far legs),
// W white fur, S shaded white fur, w eye glint, L closed-eye line, R open mouth,
// G bamboo, g bamboo leaf
export type Pose = { w: number; h: number; sprite: string[] }

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
const SIT_W = SIT[0]?.length ?? 0
const SIT_H = SIT.length

function sitting(s: Scene): Pose {
  const rows = [...SIT]
  const set = (r: number, c0: number, c1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) put(rows, r, c, ch)
  }
  if (s.isAsleep || s.isBlinking) {
    // Each eye a lighter line in its patch
    set(5, 4, 5, 'K')
    set(5, 11, 12, 'K')
    set(6, 4, 5, 'L')
    set(6, 11, 12, 'L')
  }
  if (s.chew) set(8, 7, 9, 'R')
  if (s.isMunching) {
    // A stalk of bamboo held up in the near paw, leaves at the top
    for (let r = 2; r <= 12; r++) put(rows, r, 15, 'G')
    put(rows, 1, 16, 'g')
    put(rows, 3, 16, 'g')
    put(rows, 2, 14, 'g')
    put(rows, 6, 16, 'g')
    set(10, 13, 16, 'E')
    set(11, 13, 16, 'K')
    set(12, 13, 16, 'E')
  }
  return { w: SIT_W, h: SIT_H, sprite: rows }
}

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

function walking(s: Scene): Pose {
  const frame = WALK[s.legs === 'b' ? 1 : 0] ?? WALK[0] ?? []
  return { w: frame[0]?.length ?? 0, h: frame.length, sprite: [...frame] }
}

function pose(s: Scene): Pose {
  // Asleep, it sits with its eyes closed; the bubble says zZz
  if (s.isAsleep) return sitting(s)
  if (s.air === 0 && (s.legs === 'a' || s.legs === 'b')) return walking(s)
  return sitting(s)
}

// ---------------------------------------------------------------- drawing

const TERM_W = 23 // the walking pose's width; the sitting one is centred in it
const TERM_ROWS = SIT_H + 5 // pixel rows: the sitting pose, the highest jump and one spare to keep it even

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

const GRASS = ".,..'..,...'.,..,'...,.."

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

// Any panda: its poses (at most 23 wide and SIT_H tall) and what it says
export const pandaWith = (pose: (s: Scene) => Pose, lines: Character['lines']): Character => ({
  width: TERM_W,
  canMunch: true,

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GRASS[i % GRASS.length]
    const p = pose(s)
    const pad = '.'.repeat(Math.floor((TERM_W - p.w) / 2))
    const sp = mirror(p.sprite, s.dir).map(r => pad + r)
    // As many pixel rows as the band allows, up to the cap; feet on the bottom row
    const pixelRows = Math.min(TERM_ROWS, rows - (rows % 2))
    const lift = Math.max(0, Math.min(s.air, pixelRows - p.h))
    return {
      rows: halfBlocks(sp, pixelRows - p.h - lift, TERM_W, pixelRows, TERM),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const p = pose(s)
    const sp = mirror(p.sprite, s.dir)
    const w = cols * CELL
    const size = p.w * PX
    const groundY = (SIT_H + 1) * PX + AIR * LIFT + 2 * UNIT
    const h = groundY + 3 * UNIT
    const ox = s.x * CELL
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

  lines,
})

export const panda = pandaWith(pose, {
  hi: 'yo.',
  jump: 'hup!',
  done: ['nailed it.', 'done.', 'ez.'],
  abort: 'k.',
  error: 'oof.',
  snack: ['*munch*', 'nom', '*crunch*'],
  react,
})
