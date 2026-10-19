import type { Legs, Scene } from '../types'
import { APPROACH, bubbleSvg, comingIn, halfBlocks, mirror, pick, pixels, put, roomAhead, shadowSvg, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The cat: an orange tabby, drawn in half blocks in the terminal and as pixels
// on the desktop. Facing right. For a snack it chases a mouse.
//
// Pixels: O fur, o stripes, far legs and shut eyes, W white chest and muzzle, E eyes,
// P nose, blush and the mouse's ear and tail, M mouse
const W = 16
const H = 14
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

const LEGS: Record<Exclude<Legs, 'sit'>, string[]> = {
  stand: ['...OO.....OO....', '...OO.....OO....', '...OO.....OO....', '...OO.....OO....'],
  // Walking: all four legs apart (the far two darker), then only the near two
  a: ['..OO.oo..oo.OO..', '..OO.oo..oo.OO..', '.OO..oo..oo..OO.', '.OO..oo..oo..OO.'],
  b: ['...OO.....OO....', '...OO.....OO....', '..OO.......OO...', '..OO.......OO...'],
}

function sprite(s: Scene, cols: number): string[] {
  const body = [...BODY]
  if (s.isAsleep || s.isBlinking) put(body, 3, 13, 'o')
  else if (s.isHappy) {
    // Content: eyes shut, a little blush
    put(body, 3, 13, 'o')
    put(body, 4, 12, 'P')
  }
  // Sitting, its body lowers onto its folded legs
  const rows =
    s.legs === 'sit'
      ? [...Array<string>(H - BODY.length - 1).fill('.'.repeat(W)), ...body, '...OOOOOOOOOO...']
      : [...body, ...LEGS[s.legs]]
  if (!s.isMunching) return mirror(rows, s.dir)
  if (s.snack < APPROACH) {
    // A mouse dashes in from the edge of the screen towards the cat, slowing as it gets close
    const room = roomAhead(s.x, s.dir, W, cols)
    const mouse = (MOUSE[s.snack % 2] ?? []).map(m => [...m].reverse().join(''))
    const wide = rows.map(r => r + '.'.repeat(room))
    stamp(wide, H - mouse.length, W + comingIn(s.snack, APPROACH - 1, room + 1, 2), mouse)
    return mirror(wide, s.dir)
  }
  // Then it turns tail: the chase, the mouse scurrying a little way ahead
  const mouse = MOUSE[s.legs === 'b' ? 1 : 0] ?? []
  const top = H - mouse.length
  const wide = rows.map((r, i) => r + '..' + (mouse[i - top] ?? '.'.repeat(LANE - 2)))
  return mirror(wide, s.dir)
}

// The mouse, facing right, in two steps; it runs in a lane this wide ahead of the cat
const MOUSE = [
  ['....P.', '.MMMEP', 'P.M.M.'],
  ['....P.', '.MMMEP', 'PM...M'],
]
const LANE = 8

// Columns the drawing starts left of the cat, when the mouse is on its left:
// out to the screen edge while it comes in, then the lane
const offset = (s: Scene, cols: number) =>
  !s.isMunching || s.dir === 1 ? 0 : s.snack < APPROACH ? roomAhead(s.x, s.dir, W, cols) : LANE

const TERM = { O: '#e8954a', o: '#b8662a', W: '#f4efe6', E: '#2a2420', P: '#e98f9a', M: '#9c9c9c' }
const SVG = { O: '#e08a3c', o: '#a95a22', W: '#f4efe6', E: '#231d1a', P: '#e2808c', M: '#8f8f8f' }

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
  rolls: false,
  stride: 0,
  pace: 1,
  snackLane: LANE,
  chases: true,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    const sp = sprite(s, cols)
    return {
      rows: halfBlocks(sp, AIR - s.air, sp[0]?.length ?? W, H + AIR, TERM),
      ground,
      groundColor: 'gray',
      offset: offset(s, cols),
    }
  },

  svg(s, cols) {
    const sp = sprite(s, cols)
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
      pixels(sp, ox - offset(s, cols) * PX, oy, PX, SVG) +
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
    snack: ['*pounce*', 'mouse!!', 'get back here!'],
    react,
  },
}
