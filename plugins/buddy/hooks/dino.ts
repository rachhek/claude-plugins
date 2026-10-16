import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, pick, pixels, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The dino: one green sprite, drawn in half blocks in the terminal and as
// pixels on the desktop. D is its body, B its shades, w the glint on them.
const W = 14
const H = 10
const AIR = 4

const BODY = [
  '........DDDDDD',
  '.......DD.DDDD',
  '.......DDDDDDD',
  '.......DDDD...',
  'D.....DDDDDD..',
  'DD...DDDDDD.D.',
  'DDDDDDDDDDD...',
  '.DDDDDDDDD....',
]

const LEGS: Record<Legs, string[]> = {
  stand: ['...D...D......', '...DD..DD.....'],
  a: ['...D...DD.....', '..DD..........'],
  b: ['...DD..D......', '........DD....'],
  sit: ['..DDDDDDDDDD..', '..............'],
}

function sprite(s: Scene): string[] {
  const rows = [...BODY, ...LEGS[s.legs]]
  if (s.isAsleep) rows[1] = '.......DDDDDDD'
  else if (s.isHappy) {
    // Shades on
    rows[1] = '.......DBwBBDD'
    rows[2] = '.......DDBBDDD'
  }
  return mirror(rows, s.dir)
}

const TERM = { D: '#5fb760', B: '#262626', w: '#ffffff' }
const SVG = { D: '#4f9d58', B: '#1d1d1d', w: '#ffffff' }

const GROUND = '______.________,_____ __.____________'

const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*stomps bug*', 'rawr! bugs!', 'bug hunt!'])
  if (/\b(test|spec)/.test(t)) return pick(['tests! yay', 'green pls'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['ship it!', 'to prod!'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['ooh, tidy', 'sweep sweep'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['rawr :)', 'anytime'])
  if (text.trim().endsWith('?')) return pick(['hmm?', 'good q', '...?'])
  return pick(['rawr!', 'ooh!', 'on it!', '*stomp*', '!'])
}

export const dino: Character = {
  width: W,
  canMunch: false,

  terminal(s, cols, _rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    return {
      rows: halfBlocks(sprite(s), AIR - s.air, W, H + AIR, TERM),
      ground,
      groundColor: 'gray',
    }
  },

  svg(s, cols) {
    const sp = sprite(s)
    const w = cols * CELL
    const size = W * PX
    const groundY = H * PX + AIR * LIFT + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - H * PX - s.air * LIFT

    // Little bumps on the ground that scroll while it runs
    const bumps: string[] = []
    for (let i = 0; i < w; i += 37) {
      const bx = (((i - s.ground * CELL) % w) + w) % w
      bumps.push(`<rect x="${bx}" y="${groundY + 3}" width="${i % 2 ? PX : 2 * PX}" height="2" fill="#8b8f87"/>`)
    }

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#8b8f87"/>` +
      bumps.join('') +
      shadowSvg(s, ox, size, groundY, PX) +
      pixels(sp, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, PX) +
      `</svg>`
    )
  },

  lines: {
    hi: 'rawr!',
    jump: 'wheee!',
    done: ['done!', 'ta-da!', 'rawr!!'],
    abort: 'aw.',
    error: 'oh no',
    snack: [],
    react,
  },
}
