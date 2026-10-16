import type { Scene } from '../types'
import { bubbleSvg, halfBlocksFromPixels, mirror, outline, pick, pixels, put, shadowSvg, smoothResize, spriteToRgba, svgOpen } from './shared'
import type { Character } from './shared'

// The panda: pixel art for sitting (art/sit.png) and walking (art/walk-1.png,
// art/walk-2.png), facing right. Blinking, shades, chewing and the bamboo are
// drawn over the sitting sprite in code.
//
// Pixels: E outline and eyes, K dark fur, k lighter dark fur, W white fur,
// S shaded white fur, w eye glint, L closed-eye line, B shades, R open
// mouth, G bamboo, g bamboo leaf
type Pose = { w: number; h: number; sprite: string[] }

const SIT = [
  '.....EEEE..........EEE........',
  '....EEKkkE.EEEEEE.EEkkKE......',
  '...EEkEEkkEWWWWWWkkEkkkE......',
  '...EEEEEkEWWWWWWWWWWEkkE......',
  '...EEEEEESWWWWWWWWWWWEE.......',
  '....EEEESWWWWWWWWWWWWWE.......',
  '.....EESSWWWWWWWWWWWWWEE......',
  '.....ESSWWWkkkWWWWWkkWWE......',
  '....EESSWWkkkkkWWWWkkkWWE.....',
  '....ESSWWkkkEEkWWWWkEkkWE.....',
  '....ESSWWkkkEEkWWWWkEkkWE.....',
  '....ESSWWkkkkkWWWWWWkkkWE.....',
  '....ESSSWWkkkWWWEEEEWkWWE.....',
  '....EKSSWWWWWWWWWEEEWWWWE.....',
  '...EEKSSSWWWWWWWWWEWWWWE......',
  '...EEKKSSSWWWWWEEEEEWWSE......',
  '..EEKKKKKSSWWWWWWWWWWSE.......',
  '..EKKKKKKKSSSSSSSSSSEEE.......',
  '.EEEEKKKKKEkkkkkkkkkEKKE......',
  '.ESSEKKKKKKEkkkkkkkkkEKKE.....',
  '.ESSSEKKKKKEEWWWWWWWWEKKE.....',
  'EESSSEKKKKKKKEWWWWWWWWEKKE....',
  'ESSWSSEKKKKKKKEWWWWWWWEKKE....',
  'ESSWWSEKKKKKKKKEWWWWWWWEKE....',
  'ESSWWWWEEEEEEKKEWWWWWWWEEEEEE.',
  'ESSWWWEkkkkkkEEWWWWWWWWEEkkkkE',
  'ESSSWEKKkkkkkkEWWWWWWWSEkkkkkE',
  'ESSSEKKKkkKKKkEWWWWWWWSEkkkkkE',
  'EESSEKKKkkKKKkEWWWWWWSEKkkkkkE',
  '.ESSEKKKKkKKKkEWWWWWSSEKkkkkE.',
  '..ESEKKKKkKKKkESSSSSSEEKKkkkE.',
  '..EEEEEKKKkkkEESSSSSEEEKKKKE..',
  '.....EEEEEEEEEEEEEEEEEEEEEE...',
]
const SIT_W = SIT[0]?.length ?? 0
const SIT_H = SIT.length

function sitting(s: Scene): Pose {
  const rows = [...SIT]
  const set = (r: number, c0: number, c1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) put(rows, r, c, ch)
  }
  if (s.isAsleep || s.isBlinking) {
    // Pupils gone, a lighter line across each patch
    set(9, 12, 13, 'k')
    set(10, 12, 13, 'k')
    set(9, 20, 20, 'k')
    set(10, 20, 20, 'k')
    set(10, 10, 13, 'L')
    set(10, 19, 22, 'L')
  } else if (s.isHappy) {
    // Shades on: two lenses, a bridge, and arms out to the ears
    for (let r = 8; r <= 10; r++) {
      set(r, 8, 14, 'B')
      set(r, 17, 22, 'B')
    }
    set(9, 15, 16, 'B')
    set(9, 6, 7, 'B')
    put(rows, 9, 23, 'B')
    put(rows, 8, 9, 'w')
    put(rows, 8, 18, 'w')
  }
  if (s.chew) set(16, 16, 18, 'R')
  if (s.isMunching) {
    // A stalk of bamboo held up in the near paw, leaves at the top
    for (let r = 5; r <= 23; r++) set(r, 24, 25, 'G')
    put(rows, 10, 24, 'g')
    put(rows, 17, 25, 'g')
    set(4, 26, 28, 'g')
    set(5, 21, 23, 'g')
    set(18, 22, 26, 'E')
    set(19, 22, 26, 'K')
    set(20, 22, 26, 'K')
    set(21, 22, 26, 'K')
    set(22, 22, 26, 'E')
  }
  return { w: SIT_W, h: SIT_H, sprite: rows }
}

// The walking panda is pixel art too (art/walk-1.png and art/walk-2.png),
// two steps, facing right
const WALK = [
  [
    '................EEEEEEEEEEE.......................',
    '............EEEEWWWWWWWSKKKEEEEEE...EE............',
    '..........EESSSWWWWWWWWSKKKKKKKSSEEEWWEEEE........',
    '.........ESSWWWWWWWWWWSKKKKKKKKSWWWWWWWKKEE.......',
    '........ESWWWWWWWWWWWWSKKKKKKKKKSWWWWWKKKESE......',
    '.......EWWWWWWWWWWWWWWSKKKKKKKKKKSWWWEKKEESE......',
    '......EWWWWWWWWWWWWWWWSKKKKKKKKKKSWWWEEESSWWE.....',
    '.....ESWWWWWWWWSWWWWWSSKKKKKKKKKKESWSSESWWWWWSE...',
    '.....EWWWWWWSWWWSWWWWSKKKKKKKKKKKKSWWSSWWWWWWWE...',
    '....ESSSSSSSSSWWWWWWWKKKKKKKKKKKKKSWWWWWWWkkWSE...',
    '....ESSSSkkkkSSWWWWWSKKKKKKKKKKKKKKWWSWWWkKEEWE...',
    '...ESSSSkkkkkkSSWWWSSKKKKKKKKKKKKKKSWSWWWkEEEWWE..',
    '...ESSSEKkkkkkkSSSSSKKKKKKKKKKKKKEESWSWWkkEEWWWWE.',
    '...ESSSEKKKKkKKKkSSSKKKKKKKKKKKKEEESSSSWWkkWWWWWE.',
    '....ESSEKKKKKKKKKSSEKKKKKKKKKKKEEEEEEEESSWWWWWkEE.',
    '...EEEEEEKKKKKKKKESEEEKKKKKKKEEEEEEKEEEEEESSSEE...',
    '..EKKKKKEKKKKKKKKESEEEKKKKKEEEEEEKKEE.....EEE.....',
    '.EKKKKKKEEEKKKKKKEEEEKKKKKE...EEKKKKKE............',
    'EKKKKKKE..EKKKKKEE.EEKKKKKE....EEKKKKKEE..........',
    'EKKKKEE....EKKKKEE..EKKKKEE.....EEKKKKKKE.........',
    'EKKKKE.....EEKKKKKE.EEKKKE........EEKKKKkE........',
    '.EEEEE......EEEEEEE..EEEkKEE.......EEEEEEE........',
  ],
  [
    '................EEEEEEEEEEE.......................',
    '.............EEEWWWWWWWSKKKEEEEEEE...EE...........',
    '..........EEESSWWWWWWWWSKKKKKKKSSSEEEWWEEEE.......',
    '.........ESSSWWWWWWWWWWKKKKKKKKKSWWWWWWWKKKE......',
    '........ESWWWWWWWWWWWWWKKKKKKKKKKSWWWWWEKKKSE.....',
    '.......EWWWWWWWWWWWWWWWKKKKKKKKKKSWWWWEKKEESEE....',
    '......EWWWWWWWWWWWWWWWSKKKKKKKKKKKSWWWEKKkSWWEE...',
    '.....ESWWWWWWWWSWWWWWWSKKKKKKKKKKKESWSSESWWWWWSE..',
    '....EkWWWWWWSWWWSWWWWWSKKKKKKKKKKKKSWWSSWWWWWWWE..',
    '....EWWWSSSSSSWWWWWWWWKKKKKKKKKKKKKSWWWWWWWkkWSE..',
    '....EWWSSkkkkkSWWWWWWSKKKKKKKKKKKKKKWWWWWWkEEEWE..',
    '...EWWWSkkkkkkkSWWWWSSKKKKKKKKKKKKKKSWSWWWkEEEWWE.',
    '...EWWSKKKkkkkKkSSSSSKKKKKKKKKKKKKKESSSWWkkEEWWWWE',
    '...ESSSEKKKKkkKKKSSSSKKKKKKKKKKKKKEEESSSWWkkWWWWWE',
    '....EEEEEKKKKKKKKSSSKKKKKKKKKKKKEEEEEEESSSSWWSWWE.',
    '...EEKKEEKKKKKKKKESSKKKKKKKKKKKEEEEEE..EEEESSSEE..',
    '..EKKKKKEEKKKKKKKESSKKKKKKKKKE.EEEKKE......EEE....',
    '.EKKKKKEEEEKKKKKKEEEEEEKKKKKEE.EEKKKKEE...........',
    'EKKKKKEE..EEKKKKKE.....EKKKKKE..EEKKKKEE..........',
    'EKKKEE.....EKKKKEKE....EKKKKE.....EKKKKKE.........',
    'EKKKKE.....EEKKKKKKE....EKKkEE.....EKKKKkE........',
    '.EEEEE......EEEEEkEE....EEEEkE......EEEEEE........',
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

const TERM_W = 36 // columns the terminal strip may take
const TERM_MAX_ROWS = 34 // pixel rows at most, two per text row: the art at full size

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
      // A real picture: the art at full detail, in a box of cells sized so a
      // text row holds the same share of the panda as in half-block mode
      // (a cell is about half as wide as it is tall)
      const textRows = Math.max(2, Math.round((p.h / SIT_H) * (pixelRows / 2)))
      const columns = Math.max(2, Math.round((p.w / SIT_H) * pixelRows))
      const factor = 6
      return {
        rows: [],
        ground,
        groundColor: 'green',
        image: { ...spriteToRgba(mirror(native, s.dir), TERM, factor), columns, rows: textRows },
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
