import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Critter, Kind, Legs, Scene } from '../types'
import { cat } from './cat'
import { crab } from './crab'
import { dino } from './dino'
import { duck } from './duck'
import { forest } from './forest'
import { frog } from './frog'
import { ghost } from './ghost'
import { panda } from './panda'
import { penguin } from './penguin'
import { snail } from './snail'
import { APPROACH, pick, runs } from './shared'
import type { Cell, Character } from './shared'

// A pixel buddy that lives in the band above the prompt: a panda, a dino, a cat, a penguin, a frog, a ghost,
// a crab, a rubber duck, a snail, or a whole scene: a little forest.
// It wanders when idle, jumps when you send a message, runs while Claude
// works, puts its shades on when Claude is done, and naps when nothing has
// happened for a while. /buddy picks which one.

const CHARACTERS: Record<Kind, Character> = { dino, panda, cat, penguin, frog, ghost, crab, duck, snail, forest }
// What to call it: "the panda", but a scene by its name ("Forest")
const nameOf = (k: Kind) =>
  CHARACTERS[k].width > 0 ? `the ${k}` : k.charAt(0).toUpperCase() + k.slice(1)

const isKind = (k: unknown): k is Kind => typeof k === 'string' && Object.hasOwn(CHARACTERS, k)

// ---------------------------------------------------------------- state

const INITIAL: Scene = {
  x: 4,
  dir: 1,
  air: 0,
  spin: 0,
  snack: 0,
  critter: null,
  tick: 0,
  isWorking: false,
  isUpset: false,
  isReading: false,
  legs: 'stand',
  isAsleep: false,
  isBlinking: false,
  isHappy: false,
  isMunching: false,
  chew: false,
  bubble: null,
  ground: 0,
}

const scene = atom({ plugin: 'buddy', key: 'scene' } as const, INITIAL)
const kindAtom = atom({ plugin: 'buddy', key: 'kind' } as const, 'panda' as Kind)
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)

// The physics lives in module variables and is copied into $.state on each tick
let kind: Kind = 'panda'
let x = INITIAL.x
let dir: 1 | -1 = 1
let ground = 0
let spin = 0
let snackTicks = 0
let critter: Critter | null = null // positions kept as fractions, rounded for drawing
let tick = 0
let lastActivity = 0
let working = false
let jumps: number[] = []
let walkTicks = 20
let pauseTicks = 0
let munching = false
let happyTicks = 0
let upsetTicks = 0
let readingTicks = 0 // Claude read a file a moment ago
let confettiTicks = 0 // a commit or push to celebrate
let asking = false // Claude has asked you a question and is waiting
let quietSince = 0 // the tick anything last happened in Claude's turn
let nextBlink = 30
let bubble: string | null = null
let bubbleTicks = 0
let lastWritten = ''
let cols = 80

const TICK_MS = 100
const YAWN_AFTER = 150 // fifteen seconds of quiet
const READING_TICKS = 40 // reading glasses stay on four seconds after each read
const CONFETTI_TICKS = 40 // four seconds of confetti
// Shell commands that read or search files
const READS = /^\s*(cd\s+\S+\s*&&\s*)?(cat|head|tail|less|grep|rg|sed\s+-n|find|ls)\b/
const SLEEP_AFTER_TICKS = 600 // one minute
const JUMP = [2, 3, 4, 4, 4, 3, 2, 1, 0]
const HOP = [1, 2, 1, 0]

const me = () => CHARACTERS[kind]

const GULP = 10 // ticks from the tongue hitting a critter to it being gone
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// A critter flies in from past the edge of the band the buddy faces
function release() {
  critter = { x: dir === 1 ? cols + 1 : -4, row: 4, caught: -1, age: 0 }
}

// Where the buddy's mouth is: [band column, pixel row]
function mouthAt(): [number, number] | null {
  const t = me().tongue
  if (!t) return null
  return [x + (dir === 1 ? t.mouth[1] : me().width - 1 - t.mouth[1]), t.mouth[0]]
}

// The critter's tick: free, it wanders about, slowly drifting towards the
// buddy's front, whatever the buddy is doing; caught, it's on its way down
function flutter() {
  if (!critter) return
  critter.age += 1
  if (critter.caught >= 0) {
    critter.caught += 1
    if (critter.caught === 1) say(pick(me().lines.snack), 12)
    if (critter.caught > GULP) critter = null
    return
  }
  const mouth = mouthAt()
  if (!mouth) return
  const target = mouth[0] + dir * 5
  critter.x = clamp(critter.x + clamp((target - critter.x) * 0.05, -0.6, 0.6) + (Math.random() - 0.5) * 0.6, -4, cols + 1)
  critter.row = clamp(critter.row + (5 - critter.row) * 0.05 + (Math.random() - 0.5) * 0.8, 1, 9)
}

// Within reach in front of its mouth, and on the ground: the tongue zaps it
function tryCatch(onGround: boolean) {
  const mouth = mouthAt()
  const reach = me().tongue?.reach ?? 0
  if (!critter || critter.caught >= 0 || !mouth || !onGround) return
  const ahead = (Math.round(critter.x) + 1 - mouth[0]) * dir
  if (ahead >= 2 && ahead <= reach && Math.abs(Math.round(critter.row) + 1 - mouth[1]) <= 4) critter.caught = 0
}

function say(text: string, ticks = 30) {
  if (me().width === 0) return // a whole-band scene, like the forest, doesn't talk
  bubble = text.slice(0, 18)
  bubbleTicks = ticks
}

function wake() {
  lastActivity = tick
  munching = false
}

// Confetti: bright bits drifting down through the buddy's empty space, piece k
// starting k % 6 rows late, so it falls in a scatter
const CONFETTI = ['#ff5d73', '#ffd23f', '#3ec1ff', '#7be07b', '#c38bff']
const BITS = ['▘', '▝', '▖', '▗']
function sprinkle(rows: Cell[][]) {
  if (confettiTicks <= 0) return
  const fallen = Math.floor((CONFETTI_TICKS - confettiTicks) / 2)
  const w = rows[0]?.length ?? 0
  for (let k = 0; k < w / 2; k++) {
    const cell = rows[fallen - (k % 6)]?.[(k * 7919) % w]
    if (cell && cell.ch === ' ') {
      cell.ch = BITS[k % BITS.length] ?? '▘'
      cell.fg = CONFETTI[k % CONFETTI.length]
    }
  }
}
// The same on the desktop: little squares over the buddy, `left` and `cols` in columns
function confettiSvg(svg: string, left: number, cols: number): string {
  if (confettiTicks <= 0) return svg
  const fallen = (CONFETTI_TICKS - confettiTicks) * 3
  let bits = ''
  for (let k = 0; k < cols; k++) {
    const y = fallen - (k % 6) * 8
    if (y < 0) continue
    const x = (left + ((k * 7919) % cols)) * 8
    bits += `<rect x="${x}" y="${y}" width="4" height="4" fill="${CONFETTI[k % CONFETTI.length]}"/>`
  }
  return svg.replace(/<\/svg>$/, `${bits}</svg>`)
}

// A commit or push: confetti, a happy jump and a word about it
function celebrate(text: string) {
  wake()
  confettiTicks = CONFETTI_TICKS
  happyTicks = 30
  jumps = [...JUMP]
  say(text, 25)
}

function hello() {
  wake()
  pauseTicks = 0
  jumps = [...JUMP]
  say(me().lines.hi)
}

function step(): Scene {
  tick += 1
  const maxX = Math.max(0, cols - me().width - 1)
  const catching = critter !== null && critter.caught >= 0
  const asleep = !working && !critter && tick - lastActivity > SLEEP_AFTER_TICKS && jumps.length === 0
  let legs: Legs = 'stand'
  if (catching) jumps = []

  const pace = me().pace
  if (catching) {
    // The tongue's out: sit still for it
    legs = 'sit'
  } else if (working) {
    // A step every `pace` ticks
    if (tick % pace === 0) {
      x += dir
      ground += 1
    }
    legs = Math.floor(tick / pace) % 2 ? 'a' : 'b'
  } else if (asleep) {
    munching = false
    legs = 'sit'
    if (me().width > 0) {
      bubble = ['z', 'zZ', 'zZz'][Math.floor(tick / 8) % 3] ?? 'z'
      bubbleTicks = 2
    }
  } else if (pauseTicks > 0) {
    pauseTicks -= 1
    if (munching && me().chases && snackTicks < APPROACH) {
      // Its snack is coming in from the edge: hold still and watch
      legs = 'stand'
    } else if (munching && me().chases) {
      // After its snack at full tilt, doubling back now and then as it dodges
      x += dir
      legs = tick % 2 ? 'a' : 'b'
      if (Math.random() < 0.04) dir = dir === 1 ? -1 : 1
    } else if (munching) {
      legs = 'sit'
    }
    if (munching && tick % 25 === 0) say(pick(me().lines.snack), 12)
    if (pauseTicks === 0) munching = false
  } else {
    // A slow wander, a third the speed of running; with a critter about, towards it
    if (critter) dir = critter.x + 1 > x + me().width / 2 ? 1 : -1
    if (tick % (3 * pace) === 0) x += dir
    legs = Math.floor(tick / (3 * pace)) % 2 ? 'a' : 'b'
    walkTicks -= 1
    if (walkTicks <= 0) {
      munching = me().canMunch && Math.random() < 0.5
      if (me().tongue && !critter && Math.random() < 0.5) release()
      pauseTicks = munching ? 50 + Math.floor(Math.random() * 60) : 10 + Math.floor(Math.random() * 30)
      walkTicks = 15 + Math.floor(Math.random() * 45)
      if (Math.random() < 0.4) dir = dir === 1 ? -1 : 1
    }
  }

  // Jumping or rolling, it travels `stride` columns a tick (in whole steps)
  const inJump = jumps.length > 0
  const stride = me().stride
  if (inJump) x += dir * (Math.floor((spin + 1) * stride) - Math.floor(spin * stride))

  // During a snack, face the side with room for it (a mouse running ahead, a fly coming in)
  const lane = munching && !(me().chases && snackTicks < APPROACH) ? me().snackLane : 0
  if (dir === 1 && x >= maxX - lane) dir = -1
  else if (dir === -1 && x <= lane) dir = 1

  if (x >= maxX) {
    x = maxX
    dir = -1
  }
  if (x <= 0) {
    x = 0
    dir = 1
  }

  const height = inJump ? (jumps.shift() ?? 0) : 0
  const air = me().rolls ? 0 : height
  spin = inJump ? spin + 1 : 0
  if (height > 0) legs = 'stand'

  flutter()
  tryCatch(!inJump && !asleep)

  // Blink every few seconds, for two frames
  let isBlinking = false
  if (tick >= nextBlink) {
    isBlinking = true
    if (tick >= nextBlink + 1) nextBlink = tick + 25 + Math.floor(Math.random() * 40)
  }

  if (happyTicks > 0) happyTicks -= 1
  if (upsetTicks > 0) upsetTicks -= 1
  if (readingTicks > 0) readingTicks -= 1
  if (confettiTicks > 0) confettiTicks -= 1
  // A long wait with nothing happening in Claude's turn: a yawn, then another every 30 seconds
  if (working && !asking && tick - quietSince >= YAWN_AFTER && (tick - quietSince - YAWN_AFTER) % 300 === 0) say('*yawn*', 25)
  if (bubbleTicks > 0) bubbleTicks -= 1
  else bubble = null
  // Waiting on you: a question mark stays up, over anything else it says, until you answer
  if (asking && me().width > 0) bubble = '?'

  const isMunching = munching && !asleep && (legs === 'sit' || me().chases)
  snackTicks = isMunching ? snackTicks + 1 : 0
  return {
    x,
    dir,
    air,
    spin,
    snack: snackTicks,
    legs,
    isAsleep: asleep,
    isBlinking: isBlinking && !asleep,
    isHappy: happyTicks > 0,
    isMunching,
    chew: isMunching && Math.floor(tick / 3) % 2 === 0,
    bubble,
    ground,
    critter: critter && { ...critter, x: Math.round(critter.x), row: Math.round(critter.row) },
    tick,
    isWorking: working,
    isUpset: upsetTicks > 0,
    isReading: readingTicks > 0,
  }
}

// Load what earlier sessions saved: which buddy, and whether it's hidden
async function loadSaved($: EngineInterface) {
  const savedKind = await $.store.get('kind')
  if (isKind(savedKind)) kind = savedKind
  await update($, kindAtom, () => kind)
  const savedHidden = await $.store.get('isHidden')
  await update($, isHidden, () => savedHidden === true)
}

async function choose($: EngineInterface, next: Kind) {
  kind = next
  critter = null
  await update($, kindAtom, () => next)
  await update($, isHidden, () => false)
  await $.store.set('kind', next)
  await $.store.set('isHidden', false)
  hello()
}

async function setHidden($: EngineInterface, hide: boolean) {
  await update($, isHidden, () => hide)
  await $.store.set('isHidden', hide)
}

// ---------------------------------------------------------------- hooks

const PERSON_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'unclassified'])
const USAGE = 'Usage: /buddy [panda | dino | cat | penguin | frog | ghost | crab | duck | snail | forest | on | off | poke | snack]'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadSaved($)
    hello()
    // Ten frames a second, written to $.state only when the picture changes
    $.clock.every(TICK_MS, () => {
      const s = step()
      const key = JSON.stringify(s)
      if (key === lastWritten) return
      lastWritten = key
      void update($, scene, () => s)
    })
    try {
      await $.command.register({
        name: 'buddy',
        description: 'Pick your buddy (panda, dino, cat, penguin, frog, ghost, crab, duck, snail, or forest), or show, hide or poke it',
        argumentHint: '[panda | dino | cat | penguin | frog | ghost | crab | duck | snail | forest | on | off | poke | snack]',
        immediate: true,
      })
    } catch {
      // The name is taken; the buddy still runs without the command
    }
    return next(e)
  })

  // /clear, /resume and /branch reset $.state, so load the saved choice again
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await loadSaved($)
    return next(e)
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()

    if (isKind(arg)) {
      await choose($, arg)
      return { text: `Your buddy is now ${nameOf(arg)}.` }
    }
    if (arg === 'off' || arg === 'hide') {
      await setHidden($, true)
      return { text: 'Your buddy is taking a break. /buddy on to bring it back.' }
    }
    if (arg === 'on' || arg === 'show') {
      await setHidden($, false)
      hello()
      return { text: `${nameOf(kind).replace(/^the /, 'Your ')} is back!` }
    }
    // Poke it: it does its move (jumps, rolls, slides, burrows, hides...); 'jump' still works
    if (arg === 'poke' || arg === 'jump') {
      wake()
      jumps = [...JUMP]
      say(me().lines.jump)
      return {}
    }
    if (arg === 'snack') {
      if (me().tongue) {
        // A fly: it stays about until it's caught
        if (!critter) release()
        wake()
        return {}
      }
      if (!me().canMunch) return { text: `${nameOf(kind).replace(/^the /, 'The ')} isn't hungry. Try another buddy.` }
      wake()
      munching = true
      pauseTicks = 80
      say(pick(me().lines.snack))
      return {}
    }
    if (arg !== '') return { text: USAGE }

    // No argument: ask which buddy, in Claude Code's own question dialog
    let answer = ''
    try {
      answer = await $.ui.ask('Pick your buddy', ['Panda', 'Dino', 'Cat', 'Penguin', 'Frog', 'Ghost', 'Crab', 'Duck', 'Snail', 'Forest', 'Hide it'])
    } catch {
      return { text: USAGE }
    }
    const picked = answer.trim().toLowerCase().replace(/\s+/g, '')
    if (isKind(picked)) {
      await choose($, picked)
      return { text: `Your buddy is now ${nameOf(picked)}.` }
    }
    if (picked.startsWith('hide')) {
      await setHidden($, true)
      return { text: 'Your buddy is taking a break. /buddy on to bring it back.' }
    }
    return { text: USAGE }
  })

  on('prompt.submit', async ($, e, next) => {
    if (PERSON_ORIGINS.has(e.origin.kind) && e.text.trim()) {
      wake()
      pauseTicks = 0
      jumps = [...JUMP]
      say(me().lines.react(e.text))
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    wake()
    working = true
    quietSince = tick
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    wake()
    quietSince = tick
    // A small hop on each tool call, unless it is already in the air
    if (jumps.length === 0) jumps = [...HOP]
    // Reading files (the Read tool, or a shell command that reads or searches): on go the reading glasses
    const command = e.tool === 'Bash' && 'command' in e ? String(e.command) : ''
    if (e.tool === 'Read' || READS.test(command)) readingTicks = READING_TICKS
    // A question for you: a "?" until you've answered
    if (e.tool === 'AskUserQuestion') {
      asking = true
      say('?', 20)
    }
    const result = await next(e)
    asking = false
    quietSince = tick
    // A commit or a push: confetti
    if (/\bgit\b.*\bpush\b/.test(command)) celebrate('shipped!')
    else if (/\bgit\b.*\bcommit\b/.test(command)) celebrate('committed!')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    wake()
    working = false
    if (e.isAborted) {
      upsetTicks = 30
      say(me().lines.abort)
    } else if ('reason' in e && e.reason === 'error') {
      upsetTicks = 30
      say(me().lines.error)
    } else {
      jumps = [...JUMP, ...JUMP]
      happyTicks = 30
      say(pick(me().lines.done), 25)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)

    const who = CHARACTERS[await read($, kindAtom)]
    cols = Math.max(who.width + 2, e.props.bodyColumns)
    const s = await read($, scene)
    const x = Math.min(s.x, Math.max(0, cols - who.width - 1))
    const at = { ...s, x }

    let ours
    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      ours = <Svg source={confettiSvg(who.svg(at, cols), who.width ? x : 0, who.width || cols)} alt={s.bubble ? `Your buddy says: ${s.bubble}` : 'Your buddy'} />
    } else {
      const { Box, Text } = $.ui.resolve(e)
      // Pixel rows the band has room for, less one text row for the ground
      const drawing = who.terminal(at, cols, (e.props.maxRows - 1) * 2)
      sprinkle(drawing.rows)
      // Never past either edge of the band: a row too wide gets squeezed and comes out garbled
      const drawn = drawing.rows[0]?.length ?? who.width
      const left = Math.max(0, Math.min(x - (drawing.offset ?? 0), cols - drawn))
      const lines = drawing.rows.map((row, i) => {
        const sprite = runs(row).map((run, j) =>
          run.fg ? (
            run.bg ? (
              <Text key={`c${j}`} color={run.fg} backgroundColor={run.bg} wrap="truncate">
                {run.ch}
              </Text>
            ) : (
              <Text key={`c${j}`} color={run.fg} wrap="truncate">
                {run.ch}
              </Text>
            )
          ) : (
            <Text key={`c${j}`} wrap="truncate">
              {run.ch}
            </Text>
          ),
        )
        // The speech bubble rides on the top row, beside the buddy
        if (i === 0 && s.bubble) {
          const said = `‹${s.bubble}›`
          const fitsRight = s.dir === 1 && left + row.length + 1 + said.length <= cols
          const fitsLeft = left >= said.length + 1
          if (fitsRight || !fitsLeft) {
            return (
              <Box key={`r${i}`} flexDirection="row" paddingLeft={left}>
                {sprite}
                <Text italic wrap="truncate">{' ' + said}</Text>
              </Box>
            )
          }
          return (
            <Box key={`r${i}`} flexDirection="row" paddingLeft={left - said.length - 1}>
              <Text italic wrap="truncate">{said + ' '}</Text>
              {sprite}
            </Box>
          )
        }
        return (
          <Box key={`r${i}`} flexDirection="row" paddingLeft={left}>
            {sprite}
          </Box>
        )
      })
      ours = (
        <Box flexDirection="column">
          {lines}
          <Text color={drawing.groundColor} dimColor wrap="truncate">
            {drawing.ground}
          </Text>
        </Box>
      )
    }

    // Keep whatever other mods draw in the band, below the buddy
    const { Box } = $.ui.resolve(e)
    const theirs = await next(e)
    return theirs ? (
      <Box flexDirection="column">
        {ours}
        {theirs}
      </Box>
    ) : (
      ours
    )
  })
}

