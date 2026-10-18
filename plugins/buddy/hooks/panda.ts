import type { Scene } from '../types'
import { bubbleSvg, halfBlocksFromPixels, mirror, outline, pick, pixels, put, shadowSvg, smoothResize, spriteToRgba, svgOpen } from './shared'
import type { Character } from './shared'

// The panda: pixel art for sitting and walking (art/panda.png), facing right. Blinking, shades, chewing and the bamboo are
// drawn over the sitting sprite in code.
//
// Pixels: E outline and eyes, K dark fur, k lighter dark fur, W white fur,
// S shaded white fur, w eye glint, L closed-eye line, B shades, R open
// mouth, G bamboo, g bamboo leaf
type Pose = { w: number; h: number; sprite: string[] }

const SIT = [
  '...KKK.....KKK...',
  '..KKKKEWWWEKKKK..',
  '..KKKSWWWWWWKKK..',
  '..KKWWWWWWWWWKK..',
  '...WWWWWWWWWWW...',
  '..KWKKKWWWKKKWK..',
  '..KWkKKWWWkKKWK..',
  '..KWWKWKKKWKWWK..',
  '...EWWWWEWWWWE...',
  '...KKEWWWWWWKK...',
  '..EKKEEEEEEEKKE..',
  '..EKKKWWWWWKKKE..',
  '.EEKKKEWWWEKKKEE.',
  'KKKKKEEWWWEEEKKKK',
  'KKKESWWWWWWWSEKKK',
  'KKKEEWWWWWWWEEKKK',
  '.EEEEESSSSSEEEEE.',
]
const SIT_W = SIT[0]?.length ?? 0
const SIT_H = SIT.length

function sitting(s: Scene): Pose {
  const rows = [...SIT]
  const set = (r: number, c0: number, c1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) put(rows, r, c, ch)
  }
  if (s.isAsleep || s.isBlinking) {
    // A lighter line across each eye patch
    set(5, 4, 6, 'K')
    set(5, 10, 12, 'K')
    set(6, 4, 6, 'L')
    set(6, 10, 12, 'L')
  } else if (s.isHappy) {
    // Shades on: two lenses, a bridge, and arms out to the ears
    for (let r = 5; r <= 6; r++) {
      set(r, 3, 7, 'B')
      set(r, 9, 13, 'B')
    }
    put(rows, 5, 8, 'B')
    put(rows, 5, 2, 'B')
    put(rows, 5, 14, 'B')
    put(rows, 5, 4, 'w')
    put(rows, 5, 10, 'w')
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

// The walking panda is pixel art too (art/walk.png), facing right; the
// second step is the first with its legs moved
const WALK = [
  [
    '..................KKK..',
    '............KKKK..KKK..',
    '...........EKKKKEWWKKK.',
    '.....EEEEEEEKKKWWWWWKK.',
    '...EKWWWWWWEKKWWWWWWWK.',
    '..KWWWWWWWWKEWWWWkkWWW.',
    'EKKWWWWWWWKKEWWWkkEEWW.',
    'EKKWWWWWWWKKEWWWkkEEWKE',
    '.KWWWWWWWWKKKKWWkkkWWWE',
    '..KKKWWWWWKKKKWWWkkWWW.',
    '..KKKWWWWWSKKKKWWWWWWE.',
    '.KKKKKSSSSSKKKKKKWWW...',
    '.KKKKKKK..KEKKKKKSS....',
    'EKKKKEEE..EEEKKKK......',
    'EKKKEEEEE.KEE.KKKKK....',
    'EEEE.EEEE..KKK.KKKK....',
  ],
  [
    '..................KKK..',
    '............KKKK..KKK..',
    '...........EKKKKEWWKKK.',
    '.....EEEEEEEKKKWWWWWKK.',
    '...EKWWWWWWEKKWWWWWWWK.',
    '..KWWWWWWWWKEWWWWkkWWW.',
    'EKKWWWWWWWKKEWWWkkEEWW.',
    'EKKWWWWWWWKKEWWWkkEEWKE',
    '.KWWWWWWWWKKKKWWkkkWWWE',
    '..KKKWWWWWKKKKWWWkkWWW.',
    '..KKKWWWWWSKKKKWWWWWWE.',
    '.KKKKKSSSSSKKKKKKWWW...',
    '..KKKKKKK..KKKKKSS.....',
    '.EKKKKEEE..EKKKK.......',
    '.EKKKEEEEE.E.KKKKK.....',
    '.EEEE.EEEE.KK.KKKK.....',
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

const TERM_W = 24 // columns the terminal strip may take
// The hd picture's canvas: wide enough for the walking pose, tall enough for
// the sitting one plus the highest jump
const CANVAS_W = 24
const CANVAS_H = SIT_H + 4

function onCanvas(sprite: string[], air: number): string[] {
  const h = sprite.length
  const w = sprite[0]?.length ?? 0
  const left = Math.floor((CANVAS_W - w) / 2)
  const top = CANVAS_H - h - Math.min(air, CANVAS_H - h)
  const rows: string[] = []
  for (let r = 0; r < CANVAS_H; r++) {
    const src = sprite[r - top]
    if (src === undefined) {
      rows.push('.'.repeat(CANVAS_W))
    } else {
      rows.push('.'.repeat(left) + src + '.'.repeat(CANVAS_W - left - w))
    }
  }
  return rows
}
const TERM_MAX_ROWS = 18 // pixel rows at most, two per text row: the art at full size

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

const PX = 2.5 // the unit the sitting height is measured in
const UNIT = 4 // grass, shadow and speech bubble keep chunkier pixels
const CELL = 8
const LIFT = 5
const SIT_HEIGHT = 45 // the sitting pose is drawn this many PX tall
const TALLEST = SIT_HEIGHT + 2 // with its outline

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

export const panda: Character = {
  width: TERM_W,
  canMunch: true,

  terminal(s, cols, rows, hd) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GRASS[i % GRASS.length]
    const p = pose(s)
    // As many pixel rows as the band allows, up to the cap; the sitting pose
    // sets the scale, so the other poses come out in proportion to it
    const pixelRows = Math.max(8, Math.min(TERM_MAX_ROWS, rows - (rows % 2)))
    // Draw at full detail, then shrink with colour blending so edges stay smooth
    const native = p.sprite
    if (hd) {
      // A real picture. Every pose is drawn onto the same canvas, feet on the
      // bottom row, so the picture keeps one size while it changes pose or
      // jumps; the box of cells holds the canvas at the band's height
      // (a cell is about half as wide as it is tall)
      const canvas = onCanvas(mirror(native, s.dir), s.air)
      const textRows = Math.max(2, Math.round((CANVAS_H / SIT_H) * (pixelRows / 2)))
      const columns = Math.max(2, Math.round((CANVAS_W / SIT_H) * pixelRows))
      const factor = 6
      return {
        rows: [],
        ground,
        groundColor: 'green',
        image: { ...spriteToRgba(canvas, TERM, factor), columns, rows: textRows },
      }
    }
    const scale = Math.min(pixelRows / SIT_H, TERM_W / p.w, pixelRows / p.h)
    const px = smoothResize(mirror(native, s.dir), TERM, Math.round(p.w * scale), Math.round(p.h * scale))
    // Feet on the bottom row, lifted while jumping as far as the band allows
    const lift = Math.min(s.air, pixelRows - px.length)
    return {
      rows: halfBlocksFromPixels(px, pixelRows - px.length - lift, TERM_W, pixelRows),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const p = pose(s)
    // Every pose is drawn at the pixel size that makes the sitting one SIT_HEIGHT rows tall
    const px = (SIT_HEIGHT * PX) / SIT_H
    const sp = mirror(p.sprite, s.dir)
    const w = cols * CELL
    const size = (sp[0]?.length ?? 0) * px
    const groundY = TALLEST * PX + 4 * LIFT + 2 * UNIT
    const h = groundY + 3 * UNIT
    const ox = s.x * CELL
    const oy = groundY - sp.length * px + px - s.air * LIFT

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
      outline(sp, ox, oy, px, '#5d5658') +
      pixels(sp, ox, oy, px, SVG) +
      bubbleSvg(s, ox, oy, size, w, UNIT) +
      `</svg>`
    )
  },

  lines: {
    hi: 'yo.',
    jump: 'hup!',
    done: ['nailed it.', 'done.', 'ez.'],
    abort: 'k.',
    error: 'oof.',
    snack: ['*munch*', 'nom', '*crunch*'],
    react,
  },
}
