import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, put, shadowSvg, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The ghost: a little sheet ghost, drawn in half blocks in the terminal and as
// pixels on the desktop. Facing right. It has no legs: its wavy hem flutters
// as it drifts, and it never touches the ground. For a snack it chases a bat.
//
// Pixels: E outline, shut eyes and mouth, W sheet, S shaded sheet, K eyes,
// w eye glint, P blush, R open mouth, B bat, Y bat's eye

// One size of ghost: its sprite, where the face changes go, and how high it floats
type Patch = { r: number; c: number; px: string[] }
type Art = {
  body: string[]
  /** The hem below the body: hovering, two frames; flying, two frames */
  hover: string[][]
  fly: string[][]
  /** Laid over the body: eyes shut, happy eyes and blush, the open mouth */
  shut: Patch
  happy: Patch
  boo: Patch
  /** Top rows of the two-row nub arms: raised, and resting */
  arms: [number, number]
  /** The bat, wings up then down, and the ghost's row its top goes on */
  bat: string[][]
  batRow: number
  /** Columns behind it the trailing sheet may use, and the first row that drags */
  trail: number
  dragFrom: number
  /** Pixels it floats: asleep, the middle of its bob, how far the bob goes, the top of a jump */
  low: number
  bob: number
  wave: number
  jump: number
}

// The hem. Hovering, it ripples gently: three tails, then two where the gaps were.
// Flying, it streams out behind, rippling fast. Flying, the sheet below its face
// drags back, away from where it's going: the last body row a little, the hem more
const NORMAL: Art = {
  body: [
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
  ],
  hover: [
    ['.ESSWEWWWWEWWWE.', '.ESSE.EWWE.EWWE.', '..EE...EE...EE..'],
    ['.ESSWWWWWWWWWWE.', '..EESWEEEEWWEE..', '....EE....EE....'],
  ],
  fly: [
    ['.ESSWWWWWWWWWWE.', 'EESSWWWEEWWWWEE.', '..EEEEE..EEEE...'],
    ['.ESSWWWWWWWWWWE.', '.EESSWWWWEEWWE..', 'EEE..EEEE..EE...'],
  ],
  // Eyes shut: a line along the bottom of each
  shut: { r: 4, c: 5, px: ['WW...WW', 'WW...WW', 'EE...EE'] },
  // Happy: eyes closed in arcs, a blush under each
  happy: { r: 4, c: 3, px: ['..WW...WW..', '..EE...EE..', '.EWWE.EWWE.', 'PP.......PP'] },
  // Boo! Its mouth wide open
  boo: { r: 8, c: 7, px: ['WEEW', 'ERRE', 'WEEW'] },
  arms: [5, 7],
  bat: [
    ['B.....B', 'BB.B.BB', '.BBYBB.', '...B...'],
    ['..B.B..', '.BBBYB.', 'BB...BB', 'B.....B'],
  ],
  batRow: 4,
  trail: 3,
  dragFrom: 10, // below the mouth
  low: 0,
  bob: 1,
  wave: 1,
  jump: 4,
}

// The small ghost (/buddy size small): the same sheet redrawn smaller, never shrunk
const SMALL: Art = {
  body: [
    '....EEEEE....',
    '..EEWWWWWEE..',
    '.ESWWWWWWWWE.',
    '.ESWKwWWKwWE.',
    '.ESWKKWWKKWE.',
    '.ESWWWWWWWWE.',
    '.ESWWEWWEWWE.',
    '.ESWWWEEWWWE.',
  ],
  hover: [
    ['.ESSEWWWEWWE.', '.ESE.EWE.EWE.', '..E...E...E..'],
    ['.ESSWWWWWWWE.', '..ESWEEEWWE..', '...EE...EE...'],
  ],
  fly: [
    ['.ESSWWWWWWWE.', 'EESWWEEWWWEE.', '..EEE..EEE...'],
    ['.ESSWWWWWWWE.', '.EESWWWEEWWE.', 'EE..EEE..EE..'],
  ],
  shut: { r: 3, c: 4, px: ['WW..WW', 'EE..EE'] },
  happy: { r: 3, c: 3, px: ['.EE..EE.', 'EWW..WWE', 'P......P'] },
  boo: { r: 5, c: 5, px: ['.EE.', 'ERRE', '.EE.'] },
  arms: [3, 5],
  bat: [
    ['B...B', 'BBYBB', '..B..'],
    ['.B.B.', 'BBYBB', 'B...B'],
  ],
  batRow: 3,
  trail: 2,
  dragFrom: 8, // the hem
  low: 0,
  bob: 1,
  wave: 1,
  jump: 3,
}

const width = (a: Art) => a.body[0]?.length ?? 0
// The bat flies in a lane this wide ahead of the ghost
const lane = (a: Art) => (a.bat[0]?.[0]?.length ?? 0) + 2

const drag = (a: Art, row: number, d: number) =>
  row < a.dragFrom ? 0 : row === a.dragFrom ? Math.ceil(d / 3) : row === a.dragFrom + 1 ? Math.round((2 * d) / 3) : d

// Columns behind it the trailing sheet may use, short of the band's edge
const behind = (a: Art, s: Scene, cols: number) =>
  Math.max(0, Math.min(a.trail, s.dir === 1 ? s.x : cols - 1 - s.x - width(a)))

// Pixels it flies above the ground: bobbing gently up and down, lower asleep; a jump takes it higher
const lift = (a: Art, s: Scene) =>
  (s.isAsleep ? a.low : a.bob + Math.round(a.wave * Math.sin(s.tick * 0.15))) + Math.round((s.air * a.jump) / 4)

function sprite(a: Art, s: Scene, cols: number): string[] {
  const body = [...a.body]
  const lay = (p: Patch) => stamp(body, p.r, p.c, p.px)
  if (s.isAsleep || s.isBlinking) lay(a.shut)
  else if (s.isHappy) lay(a.happy)
  if (s.isMunching) lay(a.boo)
  // Flying when it moves (faster while Claude works or it chases its bat); else hovering
  const flying = s.legs === 'a' || s.legs === 'b'
  const speed = !flying ? 0 : s.isWorking || s.isMunching ? 3 : 2
  const hem = flying ? a.fly[Math.floor(s.tick / 2) % 2] : a.hover[Math.floor(s.tick / 6) % 2]
  const rows = [...body, ...(hem ?? [])]
  // Little nub arms, raised as it floats up or when it's happy
  const w = width(a)
  const arm = s.air > 0 || s.isHappy ? a.arms[0] : a.arms[1]
  for (const r of [arm, arm + 1]) {
    put(rows, r, 0, 'E')
    put(rows, r, 1, 'W')
    put(rows, r, w - 2, 'W')
    put(rows, r, w - 1, 'E')
  }
  // Chasing: a bat flapping along a little way ahead, at the ghost's eye level
  const bat = a.bat[s.legs === 'b' ? 1 : 0] ?? []
  const ahead = rows.map((r, i) => (s.isMunching ? r + '..' + (bat[i - a.batRow] ?? '.'.repeat(lane(a) - 2)) : r))
  // Room behind, and the sheet dragged back into it
  const back = behind(a, s, cols)
  const trailing = ahead.map((r, i) => {
    const k = Math.min(back, drag(a, i, speed))
    return ('.'.repeat(back) + r).slice(k) + '.'.repeat(k)
  })
  return mirror(trailing, s.dir)
}

// Columns the drawing starts left of the ghost: the room behind it facing right,
// the bat's lane facing left
const offset = (a: Art, s: Scene, cols: number) => (s.dir === 1 ? behind(a, s, cols) : s.isMunching ? lane(a) : 0)

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

function build(a: Art): Character {
  const W = width(a)
  const H = a.body.length + (a.hover[0]?.length ?? 0)
  // Pixel rows: the ghost and the air below it, up to the top of its bob and a jump
  const ROWS = H + a.bob + a.wave + a.jump
  return {
    width: W,
    canMunch: true,
    rolls: false,
    stride: 0,
    pace: 2, // it drifts slowly
    snackLane: lane(a),
    chases: true,

    terminal(s, cols, rows) {
      const sp = sprite(a, s, cols)
      // As much air below it as the band has room for
      const pixelRows = Math.min(ROWS, Math.max(H, rows - (rows % 2)))
      return {
        rows: halfBlocks(sp, pixelRows - H - Math.min(lift(a, s), pixelRows - H), sp[0]?.length ?? W, pixelRows, COLOURS),
        offset: offset(a, s, cols),
      }
    },

    svg(s, cols) {
      const sp = sprite(a, s, cols)
      const w = cols * CELL
      const size = W * PX
      const groundY = ROWS * PX + 3 * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      const oy = groundY - (H + lift(a, s)) * PX
      const o = offset(a, s, cols)
      // The rim goes round the ghost and its trailing sheet, not the bat's lane
      const bat = s.isMunching ? lane(a) : 0
      const own = sp.map(r =>
        s.dir === 1 ? r.slice(0, r.length - bat) + '.'.repeat(bat) : '.'.repeat(bat) + r.slice(bat),
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
}

export const ghost = build(NORMAL)
export const ghostSmall = build(SMALL)
