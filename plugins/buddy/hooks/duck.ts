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
// C bread crust, c crumb, Q reading glasses
const W = 23 // the duck, a pixel of water behind and room in front for crumbs and its dip
const H = 14
const AIR = 4

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

// The water line under it, rippling differently on each bob
const WATER = ['bBBb.BBBBBBBBBBBBb.bB..', '.bBBBBBBBBBBBBBBBBBb.b.']
// Landing from a hop: a splash of drops both sides
const SPLASH = ['b.b..................b.', '.....................b.', '.b.................b...', 'b...................b.b']
const SPLASH_WATER = 'bbBBbBBBBBBBBBBBBBbBbbb'
// Paddling behind it while Claude works
const PADDLE = [
  ['...', 'b..', '..b'],
  ['.b.', '...', 'b..'],
]
// Bread crumbs floating just in front, bobbing
const CRUMBS = [
  ['cC..', '...c'],
  ['Cc.c', '....'],
]

// Reading glasses: a round lens about its eye, the arm back across its head
// (from a row above and four columns left of its eye's glint)
const GLASSES = ['...QQ', 'QQQ..Q', '..Q..Q', '...QQ']

const blank = () => Array<string>(H + AIR).fill('.'.repeat(W))

// The duck alone, in a canvas with headroom for a hop, and the water and
// whatever floats on it; the water is laid over the duck
function layers(s: Scene): { duck: string[]; water: string[]; top: number } {
  const dip = s.isMunching && s.chew && !s.isAsleep
  let pose = FLOAT
  let bob = 0
  if (s.isAsleep) pose = TUCK
  else if (dip) pose = DIP
  else if (s.air > 0 || s.isMunching || s.legs === 'a' || s.legs === 'sit') pose = FLOAT
  else if (s.legs === 'b') {
    pose = TIP
    bob = 1
  } else bob = Math.floor(s.tick / 8) % 2 // standing still, a gentle bob
  const d = [...(s.isHappy && pose === FLOAT ? WING_UP : pose)]
  // Where its eye's glint is, before any change to the eye
  const gr = d.findIndex(r => r.includes('w'))
  const gc = d[gr]?.indexOf('w') ?? -1

  // The eye: at its 2 × 2 pupil, a row lower and a column on when dipped
  const er = pose === DIP ? 4 : 3
  const ec = pose === DIP ? 14 : 13
  if (pose !== TUCK) {
    if (s.isHappy) stamp(d, er, ec, ['YKK', 'KYY'])
    // Reading, it keeps its eyes open behind its glasses
    else if (s.isBlinking && !s.isReading) stamp(d, er, ec + 1, ['YY', 'KK'])
    else if (s.isUpset) stamp(d, er - 1, ec, ['K..', 'YKw', 'YKK'])
    if (s.isReading && gr >= 0) stamp(d, gr - 1, gc - 4, GLASSES)
  }

  const top = AIR - s.air + bob
  const duck = blank()
  stamp(duck, top, 1, d)
  // Upset: feathers ruffled on its head and back, a bead of sweat
  if (s.isUpset && pose !== TUCK) {
    stamp(duck, top - 2, 1, ['..........S.S', '...........S.S', '.................b', '.................b'])
    stamp(duck, top + 6, 1, ['...S', '....S'])
  }

  const water = blank()
  const last = H + AIR - 1
  if (s.air === 0 && s.spin > 0) {
    stamp(water, last - 4, 0, SPLASH)
    stamp(water, last, 0, [SPLASH_WATER])
  } else stamp(water, last, 0, [WATER[pose === DIP ? 0 : bob] ?? ''])
  if (s.isWorking && s.air === 0) stamp(water, last - 3, 0, PADDLE[s.legs === 'b' ? 1 : 0] ?? [])
  if (s.isMunching) stamp(water, last - 1, 19, CRUMBS[s.chew ? 0 : 1] ?? [])
  return { duck: mirror(duck, s.dir), water: mirror(water, s.dir), top }
}

function sprite(s: Scene): string[] {
  const { duck, water } = layers(s)
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
  Q: '#3a5bc7',
}
const SVG = { ...TERM, E: '#241a10', K: '#140f0a', Q: '#3352b8' }

const GROUND = '~~-~~~~^~~-~~~~~~^~-~~~'

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

export const duck: Character = {
  width: W,
  canMunch: true,
  rolls: false,
  stride: 0,
  pace: 2, // a lazy paddle
  snackLane: 0,
  chases: false,

  terminal(s, cols, rows) {
    let ground = ''
    for (let i = 0; i < cols; i++) ground += GROUND[(i + s.ground) % GROUND.length]
    // As many pixel rows as the band allows, the water on the bottom row
    const pixelRows = Math.min(H + AIR, rows - (rows % 2))
    return {
      rows: halfBlocks(sprite(s), pixelRows - H - AIR, W, pixelRows, TERM),
      ground,
      groundColor: 'cyan',
    }
  },

  svg(s, cols) {
    const { duck, water, top } = layers(s)
    const w = cols * CELL
    const groundY = (H + AIR) * PX
    const h = groundY + 3 * PX
    const ox = s.x * CELL
    // The canvas's bottom row is the water, sitting on the water line
    const oy = groundY - (H + AIR - 1) * PX

    return (
      svgOpen(w, h) +
      `<rect x="0" y="${groundY}" width="${w}" height="2" fill="#9fd4ee"/>` +
      // A faint light rim so the dark outline still reads on a dark background
      outline(duck, ox, oy, PX, '#5d5658') +
      pixels(duck, ox, oy, PX, SVG) +
      pixels(water, ox, oy, PX, SVG) +
      bubbleSvg(s, ox, oy + top * PX, W * PX, w, PX) +
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
