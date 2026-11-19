import type { Scene } from '../types'
import { bubbleSvg, halfBlocks, mirror, outline, pick, pixels, stamp, svgOpen } from './shared'
import type { Character } from './shared'

// The duck: a yellow rubber duck floating on a little water line, drawn in
// half blocks in the terminal and as pixels on the desktop. Facing right. It
// bobs along rather than walks, splashes down after a hop, and for a snack
// dips its head for bread crumbs. Ask it about a bug and it debugs with you.
//
// Pixels: E outline, Y yellow, S shaded yellow and wing, H rubber sheen,
// O beak, o lower beak, K eye, w eye glint, B water, b ripples and drops,
// C bread crust, c crumb
// One size of duck: its poses, and where its eye, ruffled feathers and
// everything on the water go
type Art = {
  /** Canvas columns: the duck, a pixel of water behind and room in front for crumbs and its dip */
  w: number
  h: number
  /** Headroom for a hop */
  air: number
  float: string[]
  tip: string[]
  wingUp: string[]
  dip: string[]
  tuck: string[]
  /** Where the eye overlays go (row, column), floating and dipped */
  eye: [number, number]
  dipEye: [number, number]
  /** Upset: ruffled feathers and a bead of sweat, from two rows above the duck */
  ruffle: string[]
  water: string[]
  splash: string[]
  splashWater: string
  paddle: string[][]
  crumbs: string[][]
  /** Column the crumbs float at */
  crumbsAt: number
}

const HEAD = [
  '..........EEEE......',
  '........EEYYYYEE....',
  '.......EYHHYYYYYE...',
  '.......EYHYYYYKwE...',
  '.......EYYYYYYKKEEE.',
  '.......EYYYYYYYEOOOE',
]

const FLOAT = [
  ...HEAD,
  '.EE....EYYYYYYYEoooE',
  '.EYE...EYYYYYYYYEEE.',
  '.EYYEEEYYYYYYYYYYE..',
  'EYYYSSSSSYYYYYHYYE..',
  'EYYYYSYYYYSYYYHYYE..',
  '.EYYYYSSSSYYYYYYE...',
  '..EESSSSSSSSSSSE....',
  '....EEEEEEEEEEE.....',
]

// The other bob: tipped forward, a pixel lower in the water with its tail up
const TIP = [
  '....................',
  ...HEAD.slice(0, 4),
  '.EE....EYYYYYYYEOOOE',
  '.EYE...EYYYYYYYEoooE',
  '.EYYE..EYYYYYYYYEEE.',
  '.EYYYEEYYYYYYYYYYE..',
  'EYYYSSSSSYYYYYHYYE..',
  'EYYYYSYYYYSYYYHYYE..',
  '.EYYYYSSSSYYYYYYE...',
  '..EESSSSSSSSSSSE....',
  '....EEEEEEEEEEE.....',
]

// Happy: its wing flapped up over its back
const WING_UP = [
  ...HEAD.slice(0, 4),
  '...EE..EYYYYYYKKEEE.',
  '..ESSE.EYYYYYYYEOOOE',
  '.EESSSEEYYYYYYYEoooE',
  '.EYESSSYYYYYYYYYEEE.',
  '.EYYESSYYYYYYYYYYE..',
  'EYYYYESYYYYYYHYYYE..',
  'EYYYYYYYYYYYYHYYYE..',
  '.EYYYYYYYYYYYYYYE...',
  '..EESSSSSSSSSSSE....',
  '....EEEEEEEEEEE.....',
]

// Snacking: head dipped down and forward to the crumbs on the water
const DIP = [
  '.....................',
  '.....................',
  '.....................',
  '...........EEEE......',
  '.........EEYYYYEE....',
  '........EYHHYYYYYE...',
  '.EE.....EYHYYYYKwE...',
  '.EYE....EYYYYYYKKEEE.',
  '.EYYEEEEYYYYYYYYYEOOOE',
  'EYYYSSSSSYYYYYYYYEoooE',
  'EYYYYSYYYYSYYYHYYYEEE.',
  '.EYYYYSSSSYYYYHYYE....',
  '..EESSSSSSSSSSSSE.....',
  '....EEEEEEEEEEEE......',
]

// Asleep: head tucked down into its body, eye shut
const TUCK = [
  '....................',
  '....................',
  '..........EEEE......',
  '........EEYYYYEE....',
  '.......EYHHYYYYYE...',
  '.......EYHYYYYYYE...',
  '.EE....EYYYYYKKYEE..',
  '.EYE...EYYYYYYYEOOE.',
  '.EYYEEEYYYYYYYYEooE.',
  'EYYYSSSSSYYYYYYEEE..',
  'EYYYYSYYYYSYYYHYYE..',
  '.EYYYYSSSSYYYYYYE...',
  '..EESSSSSSSSSSSE....',
  '....EEEEEEEEEEE.....',
]

const NORMAL: Art = {
  w: 23,
  h: 14,
  air: 4,
  float: FLOAT,
  tip: TIP,
  wingUp: WING_UP,
  dip: DIP,
  tuck: TUCK,
  eye: [3, 13],
  dipEye: [4, 14],
  ruffle: ['..........S.S', '...........S.S', '.................b', '.................b', '', '', '', '', '...S', '....S'],
  // The water line under it, rippling differently on each bob
  water: ['bBBb.BBBBBBBBBBBBb.bB..', '.bBBBBBBBBBBBBBBBBBb.b.'],
  // Landing from a hop: a splash of drops both sides
  splash: ['b.b..................b.', '.....................b.', '.b.................b...', 'b...................b.b'],
  splashWater: 'bbBBbBBBBBBBBBBBBBbBbbb',
  // Paddling behind it while Claude works
  paddle: [
    ['...', 'b..', '..b'],
    ['.b.', '...', 'b..'],
  ],
  // Bread crumbs floating just in front, bobbing
  crumbs: [
    ['cC..', '...c'],
    ['Cc.c', '....'],
  ],
  crumbsAt: 19,
}

// The small duck (/buddy size small): the same poses redrawn smaller, never shrunk
const SMALL: Art = {
  w: 18,
  h: 11,
  air: 3,
  float: [
    '.......EEEE.....',
    '......EYYYYE....',
    '.....EYHHYKwE...',
    '.....EYHYYKKEEE.',
    '.EE..EYYYYYYEOOE',
    '.EYE.EYYYYYYEooE',
    '.EYYEYYYYYYYYEE.',
    'EYYSSSSYYYYHYE..',
    'EYYYSYYYSYYHYE..',
    '.EESSSSSSSSSE...',
    '...EEEEEEEEE....',
  ],
  tip: [
    '.......EEEE.....',
    '......EYYYYE....',
    '.....EYHHYKwE...',
    '.EE..EYHYYKKEEE.',
    '.EYE.EYYYYYYEOOE',
    '.EYYEEYYYYYYEooE',
    '.EYYYEYYYYYYYEE.',
    'EYYSSSSYYYYHYE..',
    'EYYYSYYYSYYHYE..',
    '.EESSSSSSSSSE...',
    '...EEEEEEEEE....',
  ],
  wingUp: [
    '.......EEEE.....',
    '......EYYYYE....',
    '.....EYHHYKwE...',
    '..EE.EYHYYKKEEE.',
    '.ESSEEYYYYYYEOOE',
    '.EESSEYYYYYYEooE',
    '.EYESSYYYYYYYEE.',
    'EYYYESYYYYYHYE..',
    'EYYYYYYYYYYHYE..',
    '.EESSSSSSSSSE...',
    '...EEEEEEEEE....',
  ],
  dip: [
    '.................',
    '.................',
    '........EEEE.....',
    '.......EYYYYE....',
    '.EE...EYHHYKwE...',
    '.EYE..EYHYYKKEEE.',
    '.EYYEEYYYYYYYEOOE',
    'EYYSSSSYYYYYYEooE',
    'EYYYSYYYSYYHYYEE.',
    '.EESSSSSSSSSSE...',
    '...EEEEEEEEEE....',
  ],
  tuck: [
    '................',
    '.......EEEE.....',
    '......EYYYYE....',
    '.....EYHHYYYE...',
    '.EE..EYHYKKYEE..',
    '.EYE.EYYYYYYEOE.',
    '.EYYEYYYYYYYEoE.',
    'EYYSSSSYYYYHYE..',
    'EYYYSYYYSYYHYE..',
    '.EESSSSSSSSSE...',
    '...EEEEEEEEE....',
  ],
  eye: [2, 9],
  dipEye: [4, 10],
  ruffle: ['.......S.S', '........S.S', '.............b', '.............b', '', '', '...S', '....S'],
  water: ['bBb.BBBBBBBBBBb.bB', '.bBBBBBBBBBBBBBb.b'],
  splash: ['.b..............b.', 'b..............b..', '...............b.b'],
  splashWater: 'bbBbBBBBBBBBBBbBbb',
  paddle: [
    ['..', 'b.'],
    ['b.', '..'],
  ],
  crumbs: [
    ['Cc.', '..c'],
    ['cCc', '...'],
  ],
  crumbsAt: 15,
}

// The duck alone, in a canvas with headroom for a hop, and the water and
// whatever floats on it; the water is laid over the duck
function layers(a: Art, s: Scene): { duck: string[]; water: string[]; top: number } {
  const blank = () => Array<string>(a.h + a.air).fill('.'.repeat(a.w))
  const dip = s.isMunching && s.chew && !s.isAsleep
  let pose = a.float
  let bob = 0
  if (s.isAsleep) pose = a.tuck
  else if (dip) pose = a.dip
  else if (s.air > 0 || s.isMunching || s.legs === 'a' || s.legs === 'sit') pose = a.float
  else if (s.legs === 'b') {
    pose = a.tip
    bob = 1
  } else bob = Math.floor(s.tick / 8) % 2 // standing still, a gentle bob
  const d = [...(s.isHappy && pose === a.float ? a.wingUp : pose)]

  // The eye: at its 2 × 2 pupil, lower and a column on when dipped
  const [er, ec] = pose === a.dip ? a.dipEye : a.eye
  if (pose !== a.tuck) {
    if (s.isHappy) stamp(d, er, ec, ['YKK', 'KYY'])
    else if (s.isBlinking) stamp(d, er, ec + 1, ['YY', 'KK'])
    else if (s.isUpset) stamp(d, er - 1, ec, ['K..', 'YKw', 'YKK'])
  }

  // A hop no higher than its headroom
  const top = a.air - Math.min(s.air, a.air) + bob
  const duck = blank()
  stamp(duck, top, 1, d)
  // Upset: feathers ruffled on its head and back, a bead of sweat
  if (s.isUpset && pose !== a.tuck) stamp(duck, top - 2, 1, a.ruffle)

  const water = blank()
  const last = a.h + a.air - 1
  if (s.air === 0 && s.spin > 0) {
    stamp(water, last - a.splash.length, 0, a.splash)
    stamp(water, last, 0, [a.splashWater])
  } else stamp(water, last, 0, [a.water[pose === a.dip ? 0 : bob] ?? ''])
  const paddle = a.paddle[s.legs === 'b' ? 1 : 0] ?? []
  if (s.isWorking && s.air === 0) stamp(water, last - paddle.length, 0, paddle)
  if (s.isMunching) stamp(water, last - 1, a.crumbsAt, a.crumbs[s.chew ? 0 : 1] ?? [])
  return { duck: mirror(duck, s.dir), water: mirror(water, s.dir), top }
}

function sprite(a: Art, s: Scene): string[] {
  const { duck, water } = layers(a, s)
  const rows = [...duck]
  stamp(rows, 0, 0, water)
  return rows
}

const TERM = {
  E: '#2b2118',
  Y: '#f7d038',
  S: '#d9a020',
  H: '#fff6b8',
  O: '#f5891f',
  o: '#c8621a',
  K: '#1a1410',
  w: '#ffffff',
  B: '#3f8fc0',
  b: '#9fdcf5',
  C: '#c98a4b',
  c: '#e8b878',
}
const SVG = { ...TERM, E: '#241a10', K: '#140f0a' }


const PX = 6
const CELL = 8

function react(text: string): string {
  const t = text.toLowerCase()
  // Rubber-duck debugging: explain it to the duck
  if (t.includes('?') || /\b(bug|error|why|how|broken|crash|fail|stuck)/.test(t))
    return pick(['quack?', 'explain it to me', 'line by line?', 'try logging it?', 'what changed?', 'and then?'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['*happy squeak*', 'quack :)'])
  if (/\b(food|lunch|snack|eat|bread)/.test(t)) return pick(['bread?!', 'crumbs pls'])
  return pick(['quack!', 'quack quack', '*squeak*', '*bob bob*', '*paddles*'])
}

function build(a: Art): Character {
  return {
    width: a.w,
    canMunch: true,
    rolls: false,
    stride: 0,
    pace: 2, // a lazy paddle
    snackLane: 0,
    chases: false,

    terminal(s, cols, rows) {
      // As many pixel rows as the band allows, the water on the bottom row
      const pixelRows = Math.min(a.h + a.air, rows - (rows % 2))
      return {
        rows: halfBlocks(sprite(a, s), pixelRows - a.h - a.air, a.w, pixelRows, TERM),
      }
    },

    svg(s, cols) {
      const { duck, water, top } = layers(a, s)
      const w = cols * CELL
      const groundY = (a.h + a.air) * PX
      const h = groundY + 3 * PX
      const ox = s.x * CELL
      // The canvas's bottom row is the water, sitting on the water line
      const oy = groundY - (a.h + a.air - 1) * PX

      return (
        svgOpen(w, h) +
        `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#9fd4ee"/>` +
        // A faint light rim so the dark outline still reads on a dark background
        outline(duck, ox, oy, PX, '#5d5658') +
        pixels(duck, ox, oy, PX, SVG) +
        pixels(water, ox, oy, PX, SVG) +
        bubbleSvg(s, ox, oy + top * PX, a.w * PX, w, PX) +
        `</svg>`
      )
    },

    lines: {
      hi: 'quack!',
      jump: 'squeak!',
      done: ['quack quack!', 'i just listened', '*proud squeak*'],
      abort: 'quack?!',
      error: '*squeak*',
      snack: ['*nibble*', 'crumbs!', 'bread!!'],
      react,
    },
  }
}

export const duck = build(NORMAL)
export const duckSmall = build(SMALL)
