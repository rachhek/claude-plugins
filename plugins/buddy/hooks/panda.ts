import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The panda: a compact sprite for the terminal and a bigger one for the
// desktop, so its eyes have room.

// ---------------------------------------------------------------- terminal sprite

// '.' empty, K black fur, W white fur, w eye shine, G bamboo
const W = 16
const H = 14

const HEAD = [
  '..KKK......KKK..',
  '.KKKKWWWWWWKKKK.',
  '.KKWWWWWWWWWWKK.',
  '.WWKKKWWWWKKKWW.',
  'WWKKKwKWWKKKwKWW',
  'WWKKKKKWWKKKKKWW',
  'WWWWWWWKKWWWWWWW',
  '.WWWWWWWWWWWWWW.',
  '..WWWWWWWWWWWW..',
]

const BODY = ['..KKWWWWWWWWKK..', '.KKKWWWWWWWWKKK.', '.KKKWWWWWWWWKKK.']

const FEET: Record<Legs, string[]> = {
  stand: ['...KKWWWWWWKK...', '..KKKK....KKKK..'],
  a: ['...KKWWWWWWKKKK.', '..KKKK..........'],
  b: ['.KKKKWWWWWWKK...', '..........KKKK..'],
  sit: ['KKKKWWWWWWWWKKKK', '................'],
}

function sprite(s: Scene): string[] {
  const rows = [...HEAD, ...BODY, ...FEET[s.legs]]
  if (s.isAsleep || s.isBlinking) {
    rows[3] = '.WWWWWWWWWWWWWW.'
    rows[4] = 'WWKKKKKWWKKKKKWW'
    rows[5] = 'WWWWWWWWWWWWWWWW'
  } else if (s.isHappy) {
    // Shades on
    rows[3] = '.WWWWWWWWWWWWWW.'
    rows[4] = 'KKwKKKKKKKwKKKKK'
    rows[5] = 'WWKKKKKWWKKKKKWW'
  }
  if (s.isMunching) {
    for (let r = 6; r < H - 1; r++) put(rows, r, 13, 'G')
    put(rows, 5, 14, 'G')
    put(rows, 4, 15, 'G')
  }
  return mirror(rows, s.dir)
}

// ---------------------------------------------------------------- desktop sprite

// K black, W white, S belly shade, w white of the eye, E pupil,
// L closed-eye line, R open mouth, G bamboo, g bamboo leaf
const BIG_W = 22
const BIG_H = 21

const BIG_HEAD = [
  '..KKKK..........KKKK..',
  '.KKKKKK........KKKKKK.',
  '.KKKKKWWWWWWWWWWKKKKK.',
  '..KKWWWWWWWWWWWWWWKK..',
  '..WWWWWWWWWWWWWWWWWW..',
  '.WWWWWWWWWWWWWWWWWWWW.',
  '.WWWKKKKWWWWWWKKKKWWW.',
  'WWWKKwwKKWWWWKKwwKKWWW',
  'WWWKKwEKKWWWWKKwEKKWWW',
  'WWKKKKKKKWWWWKKKKKKKWW',
  'WWWKKKKKWWKKWWKKKKKWWW',
  '.WWWWWWWWKWWKWWWWWWWW.',
  '.WWWWWWWWWKKWWWWWWWWW.',
  '..WWWWWWWWWWWWWWWWWW..',
  '...WWWWWWWWWWWWWWWW...',
]

const BIG_BODY = [
  '..KKKWWWWWWWWWWWWKKK..',
  '.KKKKWWWSSSSSSWWWKKKK.',
  '.KKKKWWSSSSSSSSWWKKKK.',
  '..KKKWWWSSSSSSWWWKKK..',
]

const BIG_FEET: Record<Legs, string[]> = {
  stand: ['...KKKKWWWWWWWWKKKK...', '...KKKKK......KKKKK...'],
  a: ['...KKKKWWWWWWWWKKKKK..', '...KKKKK..............'],
  b: ['..KKKKKWWWWWWWWKKKK...', '..............KKKKK...'],
  sit: ['KKKKKWWWWWWWWWWWWKKKKK', '......................'],
}

function bigSprite(s: Scene): string[] {
  const rows = [...BIG_HEAD, ...BIG_BODY, ...BIG_FEET[s.legs]]
  if (s.isAsleep || s.isBlinking) {
    rows[7] = 'WWWKKKKKKWWWWKKKKKKWWW'
    rows[8] = 'WWWKLLLLKWWWWKLLLLKWWW'
  } else if (s.isHappy) {
    // Shades on
    rows[6] = '.WWWWWWWWWWWWWWWWWWWW.'
    rows[7] = 'KKKKKKKKKKKKKKKKKKKKKK'
    rows[8] = 'WWKwwKKKKWWWWKwwKKKKWW'
    rows[9] = 'WWWKKKKKWWWWWWKKKKKWWW'
  }
  if (s.chew) {
    put(rows, 12, 10, 'R')
    put(rows, 12, 11, 'R')
  }
  if (s.isMunching) {
    for (let r = 8; r < BIG_H - 1; r++) {
      put(rows, r, 19, 'G')
      put(rows, r, 20, 'G')
    }
    put(rows, 12, 19, 'g')
    put(rows, 7, 20, 'g')
    put(rows, 6, 21, 'g')
    put(rows, 7, 18, 'g')
    put(rows, 6, 17, 'g')
    // Paws wrapped around the stalk
    for (const c of [16, 17, 18, 19, 20, 21]) put(rows, 15, c, 'K')
    for (const c of [17, 18, 19, 20, 21]) put(rows, 16, c, 'K')
  }
  return mirror(rows, s.dir)
}

// ---------------------------------------------------------------- drawing

const TERM = { K: '#4a4a4a', W: '#f4f4f2', w: '#ffffff', G: '#7bc96f' }

const SVG = {
  K: '#2e2a2b',
  W: '#fdfcf9',
  S: '#e7e2da',
  w: '#ffffff',
  E: '#120f10',
  L: '#9a9093',
  R: '#4a2f33',
  G: '#6fbf5c',
  g: '#9bd67f',
}

const GRASS = ".,..'..,...'.,..,'...,.."

const PX = 4
const CELL = 8
const LIFT = 5

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
  width: W,
  canMunch: true,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GRASS[i % GRASS.length]
    // The terminal jumps half as high, to keep the band short
    return {
      rows: halfBlocks(sprite(s), 2 - Math.round(s.air / 2), W, H + 2, TERM),
      ground,
      groundColor: 'green',
    }
  },

  svg(s, cols) {
    const sp = bigSprite(s)
    const w = cols * CELL
    const size = BIG_W * PX
    const groundY = BIG_H * PX + 4 * LIFT + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - BIG_H * PX - s.air * LIFT

    const grass: string[] = []
    for (let i = 0; i < w; i += 9 * PX) {
      const gx = i + 2 * PX
      grass.push(
        `<rect x="${gx}" y="${groundY - PX}" width="${PX}" height="${PX}" fill="#86b96e"/>` +
          `<rect x="${gx + 2 * PX}" y="${groundY - 2 * PX}" width="${PX}" height="${2 * PX}" fill="#86b96e"/>`,
      )
    }

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="${PX * 0.6}" fill="#a8cf93"/>` +
      grass.join('') +
      shadowSvg(s, ox, size, groundY, PX) +
      outline(sp, ox, oy, PX, '#6e6467') +
      pixels(sp, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, PX) +
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
