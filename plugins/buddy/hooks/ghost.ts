import type { Legs, Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, svgOpen } from './shared'
import type { Character } from './shared'

// The ghost: a little sheet ghost, drawn in half blocks in the terminal and as
// pixels on the desktop. Facing right. It has no legs: its wavy hem flutters
// as it drifts, and it never touches the ground. For a snack it chases a bat.
//
// Pixels: E outline, shut eyes and mouth, W sheet, S shaded sheet, K eyes,
// w eye glint, P blush, R open mouth, B bat, Y bat's eye
const W = 16
const H = 14
const AIR = 4
// Pixel rows: the ghost, the highest jump and its highest hover
const ROWS = H + AIR + 2

const BODY = [
  '.....EEEEEE.....',
  '...EEWWWWWWEE...',
  '..ESWWWWWWWWWE..',
  '.ESWWWWWWWWWWWE.',
  '.ESWWKwWWWKwWWE.',
  '.ESWWKKWWWKKWWE.',
  '.ESWWKKWWWKKWWE.',
  '.ESWWWWWWWWWWWE.',
  '.ESWWWWEWWEWWWE.',
  '.ESWWWWWEEWWWWE.',
  '.ESWWWWWWWWWWWE.',
]

// The hem: three tails, then two tails where the gaps were, so it flutters
const HEM = {
  a: ['.ESSWEWWWWEWWWE.', '.ESSE.EWWE.EWWE.', '..EE...EE...EE..'],
  b: ['.ESSWWWWWWWWWWE.', '..EESWEEEEWWEE..', '....EE....EE....'],
}

// Pixels it floats above the ground: it bobs while it drifts and settles a little asleep
const HOVER: Record<Legs, number> = { stand: 2, a: 2, b: 1, sit: 1 }

const EYES = [5, 6, 10, 11]

function sprite(s: Scene): string[] {
  const body = [...BODY]
  const set = (r: number, cs: number[], p: string) => cs.forEach(c => put(body, r, c, p))
  if (s.isAsleep || s.isBlinking) {
    // Eyes shut: a line along the bottom of each
    set(4, EYES, 'W')
    set(5, EYES, 'W')
    set(6, EYES, 'E')
  } else if (s.isHappy) {
    // Happy: eyes closed in arcs, a blush under each
    set(4, EYES, 'W')
    set(5, EYES, 'E')
    set(6, EYES, 'W')
    set(6, [4, 7, 9, 12], 'E')
    set(7, [3, 4, 12, 13], 'P')
  }
  if (s.isMunching) {
    // Boo! Its mouth wide open
    ;['WEEW', 'ERRE', 'WEEW'].forEach((row, i) => [...row].forEach((p, c) => put(body, 8 + i, 7 + c, p)))
  }
  const rows = [...body, ...HEM[s.legs === 'b' ? 'b' : 'a']]
  // Little nub arms, raised as it floats up or when it's happy
  const arm = s.air > 0 || s.isHappy ? 5 : 7
  for (const r of [arm, arm + 1]) {
    put(rows, r, 0, 'E')
    put(rows, r, 1, 'W')
    put(rows, r, 14, 'W')
    put(rows, r, 15, 'E')
  }
  if (!s.isMunching) return mirror(rows, s.dir)
  // Chasing: a bat flapping along a little way ahead, at the ghost's eye level
  const bat = BAT[s.legs === 'b' ? 1 : 0] ?? []
  const top = 4
  const wide = rows.map((r, i) => r + '..' + (bat[i - top] ?? '.'.repeat(LANE - 2)))
  return mirror(wide, s.dir)
}

// The bat, facing right, wings up then down; it flies in a lane this wide ahead of the ghost
const BAT = [
  ['B.....B', 'BB.B.BB', '.BBYBB.', '...B...'],
  ['..B.B..', '.BBBYB.', 'BB...BB', 'B.....B'],
]
const LANE = 9

// Columns the drawing starts left of the ghost: the lane, when the bat flies on its left
const offset = (s: Scene) => (s.isMunching && s.dir === -1 ? LANE : 0)

const COLOURS = {
  E: '#1c1a26',
  W: '#f1eefb',
  S: '#c6bfdc',
  K: '#2a2438',
  w: '#ffffff',
  P: '#f2a0bf',
  R: '#c0506e',
  B: '#6b3f9e',
  Y: '#ffd84a',
}

const GROUND = '.   .  .    .   .  .     '

const PX = 6
const CELL = 8
const LIFT = 5

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['*haunts the bug*', 'boo, bug!'])
  if (/\b(test|spec)/.test(t)) return pick(['spooky tests~', 'pass, or boo.'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['float it to prod', 'ship it~'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['*sweeps cobwebs*', 'so clean. eek.'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['*glows*', 'aww, boo~'])
  if (/\b(food|lunch|snack|eat)/.test(t)) return pick(['boo-berries?', '*sniffs*'])
  if (text.trim().endsWith('?')) return pick(['ooo?', '*tilts sheet*'])
  return pick(['boo.', 'ooo~', '*floats*', 'hehe~', '*rattles*'])
}

export const ghost: Character = {
  width: W,
  canMunch: true,
  rolls: false,
  stride: 0,
  pace: 2, // it drifts slowly
  snackLane: LANE,
  chases: true,

  terminal(s, cols) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    const sp = sprite(s)
    return {
      rows: halfBlocks(sp, ROWS - H - HOVER[s.legs] - s.air, sp[0]?.length ?? W, ROWS, COLOURS),
      ground,
      groundColor: 'gray',
      offset: offset(s),
    }
  },

  svg(s, cols) {
    const sp = sprite(s)
    const w = cols * CELL
    const size = W * PX
    const groundY = (H + 2) * PX + AIR * LIFT + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - (H + HOVER[s.legs]) * PX - s.air * LIFT
    // The rim goes round the ghost only, so it never bridges to the bat
    const o = offset(s)
    const own = sp.map(r => '.'.repeat(o) + r.slice(o, o + W) + '.'.repeat(r.length - o - W))

    return (
      svgOpen(w, h) +
      `<line x1="0" y1="${groundY + 1}" x2="${w}" y2="${groundY + 1}" stroke="#77718a" stroke-width="2" stroke-dasharray="${PX} ${2 * PX}"/>` +
      shadowSvg(s, ox, size, groundY, PX) +
      // A faint light rim so the dark outline still reads on a dark background
      outline(own, ox - o * PX, oy, PX, '#5d5866') +
      pixels(sp, ox - o * PX, oy, PX, COLOURS) +
      bubbleSvg(s, ox, oy, size, w, PX) +
      `</svg>`
    )
  },

  lines: {
    hi: 'boo~',
    jump: 'wooo~',
    done: ['spooky done!', 'boo-yah!', '*happy haunt*'],
    abort: 'fades away...',
    error: 'eek!',
    snack: ['boo!', '*flap flap*', 'come back, bat!'],
    react,
  },
}
