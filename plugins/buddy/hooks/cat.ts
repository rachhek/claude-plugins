import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The cat: an orange tabby, drawn in half blocks in the terminal and as pixels
// on the desktop. Facing right. When idle it sits down to groom.
//
// Pixels: O fur, o stripes and shut eyes, W white chest, muzzle and paw,
// E eye, P nose, blush and tongue
const W = 16
const H = 12
const AIR = 4

const BODY = [
  '...........O..O.',
  '.O.........OOOO.',
  'O.........OOOOOO',
  'O.........OOOEOO',
  'O.........OOOOWP',
  '.OOOOoOOoOOOWW..',
  '..OOOoOOoOOOWW..',
  '..OOOoOOoOOOWW..',
  '..OOOOOOOOOOW...',
  '...OOOOOOOOOO...',
]

const LEGS: Record<Legs, string[]> = {
  stand: ['...OO.....OO....', '...OO.....OO....'],
  a: ['...OO.....OO....', '..OO.......OO...'],
  b: ['...OO.....OO....', '....OO...OO.....'],
  sit: ['...OOOOOOOOOO...', '................'],
}

function sprite(s: Scene): string[] {
  const rows = [...BODY, ...LEGS[s.legs]]
  if (s.isAsleep || s.isBlinking) put(rows, 3, 13, 'o')
  else if (s.isHappy) {
    // Content: eyes shut, a little blush
    put(rows, 3, 13, 'o')
    put(rows, 4, 12, 'P')
  }
  if (s.isMunching) {
    // Grooming: eyes shut, a paw up to its face, the tongue out every other beat
    put(rows, 3, 13, 'o')
    for (let r = 5; r <= 7; r++) put(rows, r, 14, 'W')
    if (s.chew) put(rows, 5, 15, 'P')
  }
  return mirror(rows, s.dir)
}

const TERM = { O: '#e8954a', o: '#b8662a', W: '#f4efe6', E: '#2a2420', P: '#e98f9a' }
const SVG = { O: '#e08a3c', o: '#a95a22', W: '#f4efe6', E: '#231d1a', P: '#e2808c' }

const GROUND = "_.____'______._____,____"

const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*pounces*', 'i see it.'])
  if (/\b(test|spec)/.test(t)) return pick(['tests. fine.', 'if you must.'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['*knocks it to prod*', 'ship it.'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['*grooms code*', 'tidy. good.'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['*purrs*', 'mrrp.'])
  if (/\b(food|lunch|snack|eat|fish)/.test(t)) return pick(['fish?', 'feed me.'])
  if (text.trim().endsWith('?')) return pick(['...meow?', '*tilts head*'])
  return pick(['meow.', 'mrrp!', '*stretches*', 'meh.', '*blinks*'])
}

export const cat: Character = {
  width: W,
  canMunch: true,

  terminal(s, cols) {
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

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#8b8f87"/>` +
      shadowSvg(s, ox, size, groundY, PX) +
      pixels(sp, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy, size, w, PX) +
      `</svg>`
    )
  },

  lines: {
    hi: 'mrrp?',
    jump: '*pounce*',
    done: ['purrfect.', '*purrs*', 'done. pet me.'],
    abort: 'hmph.',
    error: '*hiss*',
    snack: ['*lick lick*', '*grooms*', '*purr*'],
    react,
  },
}
