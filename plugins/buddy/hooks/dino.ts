import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, pick, pixels, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The dino: one green sprite, drawn in half blocks in the terminal and as
// pixels on the desktop. D is its body, B its shades, w the glint on them.
// One size of dino: its body, its legs, and the eye row that shuts or gets shades
type Art = {
  body: string[]
  /** Legs, the same number of rows in every pose */
  legs: Record<Legs, string[]>
  /** Pixel rows of headroom above it for jumping */
  air: number
  /** Body row the eye is on */
  eyeRow: number
  /** The eye row, asleep */
  shut: string
  /** Shades on: the eye row and the one under it */
  shades: [string, string]
}

const NORMAL: Art = {
  body: [
    '........DDDDDD',
    '.......DD.DDDD',
    '.......DDDDDDD',
    '.......DDDD...',
    'D.....DDDDDD..',
    'DD...DDDDDD.D.',
    'DDDDDDDDDDD...',
    '.DDDDDDDDD....',
  ],
  legs: {
    stand: ['...D...D......', '...DD..DD.....'],
    a: ['...D...DD.....', '..DD..........'],
    b: ['...DD..D......', '........DD....'],
    sit: ['..DDDDDDDDDD..', '..............'],
  },
  air: 4,
  eyeRow: 1,
  shut: '.......DDDDDDD',
  shades: ['.......DBwBBDD', '.......DDBBDDD'],
}

// The small dino (/buddy size small): redrawn tiny, never shrunk, so the
// whole band is five text rows, about the height of Claude's own mascot
const SMALL: Art = {
  body: [
    '....DDDD.',
    '....D.DDD',
    'D...DDDDD',
    'DD.DDDD..',
    '.DDDDDD..',
  ],
  legs: {
    stand: ['..D..D...'],
    a: ['..D...D..'],
    b: ['.D...D...'],
    sit: ['.DDDDDD..'],
  },
  air: 2,
  eyeRow: 1,
  shut: '....DDDDD',
  shades: ['....BwBBD', 'D...DDDDD'],
}

function sprite(a: Art, s: Scene): string[] {
  const rows = [...a.body, ...a.legs[s.legs]]
  if (s.isAsleep) rows[a.eyeRow] = a.shut
  else if (s.isHappy) {
    // Shades on
    rows[a.eyeRow] = a.shades[0]
    rows[a.eyeRow + 1] = a.shades[1]
  }
  return mirror(rows, s.dir)
}

const TERM = { D: '#5fb760', B: '#262626', w: '#ffffff' }
const SVG = { D: '#4f9d58', B: '#1d1d1d', w: '#ffffff' }


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

function build(a: Art): Character {
  const W = a.body[0]?.length ?? 0
  const H = a.body.length + a.legs.stand.length
  // A jump scaled to the headroom, so a small one never leaves the band
  const air = (s: Scene) => Math.round((s.air * a.air) / 4)
  return {
    width: W,
    canMunch: false,
    rolls: false,
    stride: 0,
    snackLane: 0,
    chases: false,
    pace: 1,

    terminal(s, cols) {
      return {
        rows: halfBlocks(sprite(a, s), a.air - air(s), W, H + a.air, TERM),
      }
    },

    svg(s, cols) {
      const sp = sprite(a, s)
      const w = cols * CELL
      const size = W * PX
      const groundY = H * PX + a.air * LIFT + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - H * PX - air(s) * LIFT

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
}

export const dino = build(NORMAL)
export const dinoSmall = build(SMALL)
