import type { Scene } from '../types'
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
// Pixel rows: the ghost and the air below it. It flies, bobbing on a slow
// wave 2 to 6 pixels up, and a jump takes it 4 higher
const ROWS = H + 10

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

// The hem. Hovering, it ripples gently: three tails, then two where the gaps were
const HOVER_HEM = [
  ['.ESSWEWWWWEWWWE.', '.ESSE.EWWE.EWWE.', '..EE...EE...EE..'],
  ['.ESSWWWWWWWWWWE.', '..EESWEEEEWWEE..', '....EE....EE....'],
]
// Flying, it streams out behind, rippling fast
const FLY_HEM = [
  ['.ESSWWWWWWWWWWE.', 'EESSWWWEEWWWWEE.', '..EEEEE..EEEE...'],
  ['.ESSWWWWWWWWWWE.', '.EESSWWWWEEWWE..', 'EEE..EEEE..EE...'],
]
// Flying, the sheet below its face drags back, away from where it's going: the
// last body row a little, the hem more. TRAIL columns behind it make room
const TRAIL = 3
const DRAG_FROM = 10 // the first row that drags (below the mouth)
const drag = (row: number, d: number) =>
  row < DRAG_FROM ? 0 : row === DRAG_FROM ? Math.ceil(d / 3) : row === DRAG_FROM + 1 ? Math.round((2 * d) / 3) : d

// Columns behind it the trailing sheet may use, short of the band's edge
const behind = (s: Scene, cols: number) => Math.max(0, Math.min(TRAIL, s.dir === 1 ? s.x : cols - 1 - s.x - W))

// Pixels it flies above the ground: bobbing gently up and down, lower asleep
const lift = (s: Scene) => (s.isAsleep ? 2 : 4 + Math.round(2 * Math.sin(s.tick * 0.15))) + s.air

const EYES = [5, 6, 10, 11]

function sprite(s: Scene, cols: number): string[] {
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
  // Flying when it moves (faster while Claude works or it chases its bat); else hovering
  const flying = s.legs === 'a' || s.legs === 'b'
  const speed = !flying ? 0 : s.isWorking || s.isMunching ? 3 : 2
  const hem = flying ? FLY_HEM[Math.floor(s.tick / 2) % 2] : HOVER_HEM[Math.floor(s.tick / 6) % 2]
  const rows = [...body, ...(hem ?? [])]
  // Little nub arms, raised as it floats up or when it's happy
  const arm = s.air > 0 || s.isHappy ? 5 : 7
  for (const r of [arm, arm + 1]) {
    put(rows, r, 0, 'E')
    put(rows, r, 1, 'W')
    put(rows, r, 14, 'W')
    put(rows, r, 15, 'E')
  }
  // Chasing: a bat flapping along a little way ahead, at the ghost's eye level
  const bat = BAT[s.legs === 'b' ? 1 : 0] ?? []
  const ahead = rows.map((r, i) => (s.isMunching ? r + '..' + (bat[i - 4] ?? '.'.repeat(LANE - 2)) : r))
  // Room behind, and the sheet dragged back into it
  const back = behind(s, cols)
  const trailing = ahead.map((r, i) => {
    const k = Math.min(back, drag(i, speed))
    return ('.'.repeat(back) + r).slice(k) + '.'.repeat(k)
  })
  return mirror(trailing, s.dir)
}

// The bat, facing right, wings up then down; it flies in a lane this wide ahead of the ghost
const BAT = [
  ['B.....B', 'BB.B.BB', '.BBYBB.', '...B...'],
  ['..B.B..', '.BBBYB.', 'BB...BB', 'B.....B'],
]
const LANE = 9

// Columns the drawing starts left of the ghost: the room behind it facing right,
// the bat's lane facing left
const offset = (s: Scene, cols: number) => (s.dir === 1 ? behind(s, cols) : s.isMunching ? LANE : 0)

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

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    const sp = sprite(s, cols)
    // As much air below it as the band has room for
    const pixelRows = Math.min(ROWS, Math.max(H, rows - (rows % 2)))
    return {
      rows: halfBlocks(sp, pixelRows - H - Math.min(lift(s), pixelRows - H), sp[0]?.length ?? W, pixelRows, COLOURS),
      ground,
      groundColor: 'gray',
      offset: offset(s, cols),
    }
  },

  svg(s, cols) {
    const sp = sprite(s, cols)
    const w = cols * CELL
    const size = W * PX
    const groundY = ROWS * PX + 3 * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    const oy = groundY - (H + lift(s)) * PX
    const o = offset(s, cols)
    // The rim goes round the ghost and its trailing sheet, not the bat's lane
    const lane = s.isMunching ? LANE : 0
    const own = sp.map(r =>
      s.dir === 1 ? r.slice(0, r.length - lane) + '.'.repeat(lane) : '.'.repeat(lane) + r.slice(lane),
    )

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
