import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Kind, Legs, Scene } from '../types'
import { dino } from './dino'
import { panda } from './panda'
import { pick, runs } from './shared'
import type { Character } from './shared'

// A pixel buddy that lives in the band above the prompt: a dino or a panda.
// It wanders when idle, jumps when you send a message, runs while Claude
// works, puts its shades on when Claude is done, and naps when nothing has
// happened for a while. /buddy picks which one.

const CHARACTERS: Record<Kind, Character> = { dino, panda }

// ---------------------------------------------------------------- state

const INITIAL: Scene = {
  x: 4,
  dir: 1,
  air: 0,
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
const kindAtom = atom({ plugin: 'buddy', key: 'kind' } as const, 'dino' as Kind)
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)

// The physics lives in module variables and is copied into $.state on each tick
let kind: Kind = 'dino'
let x = INITIAL.x
let dir: 1 | -1 = 1
let ground = 0
let tick = 0
let lastActivity = 0
let working = false
let jumps: number[] = []
let walkTicks = 20
let pauseTicks = 0
let munching = false
let happyTicks = 0
let nextBlink = 30
let bubble: string | null = null
let bubbleTicks = 0
let lastWritten = ''
let cols = 80

const TICK_MS = 100
const SLEEP_AFTER_TICKS = 600 // one minute
const JUMP = [2, 3, 4, 4, 4, 3, 2, 1, 0]
const HOP = [1, 2, 1, 0]

const me = () => CHARACTERS[kind]

function say(text: string, ticks = 30) {
  bubble = text.slice(0, 18)
  bubbleTicks = ticks
}

function wake() {
  lastActivity = tick
  munching = false
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
  const asleep = !working && tick - lastActivity > SLEEP_AFTER_TICKS && jumps.length === 0
  let legs: Legs = 'stand'

  if (working) {
    x += dir
    ground += 1
    legs = tick % 2 ? 'a' : 'b'
  } else if (asleep) {
    munching = false
    legs = 'sit'
    bubble = ['z', 'zZ', 'zZz'][Math.floor(tick / 8) % 3] ?? 'z'
    bubbleTicks = 2
  } else if (pauseTicks > 0) {
    pauseTicks -= 1
    if (munching) {
      legs = 'sit'
      if (tick % 25 === 0) say(pick(me().lines.snack), 12)
    }
    if (pauseTicks === 0) munching = false
  } else {
    // A slow wander, one step every third tick
    if (tick % 3 === 0) x += dir
    legs = Math.floor(tick / 3) % 2 ? 'a' : 'b'
    walkTicks -= 1
    if (walkTicks <= 0) {
      munching = me().canMunch && Math.random() < 0.5
      pauseTicks = munching ? 50 + Math.floor(Math.random() * 60) : 10 + Math.floor(Math.random() * 30)
      walkTicks = 15 + Math.floor(Math.random() * 45)
      if (Math.random() < 0.4) dir = dir === 1 ? -1 : 1
    }
  }

  if (x >= maxX) {
    x = maxX
    dir = -1
  }
  if (x <= 0) {
    x = 0
    dir = 1
  }

  const air = jumps.length ? (jumps.shift() ?? 0) : 0
  if (air > 0) legs = 'stand'

  // Blink every few seconds, for two frames
  let isBlinking = false
  if (tick >= nextBlink) {
    isBlinking = true
    if (tick >= nextBlink + 1) nextBlink = tick + 25 + Math.floor(Math.random() * 40)
  }

  if (happyTicks > 0) happyTicks -= 1
  if (bubbleTicks > 0) bubbleTicks -= 1
  else bubble = null

  const isMunching = munching && legs === 'sit' && !asleep
  return {
    x,
    dir,
    air,
    legs,
    isAsleep: asleep,
    isBlinking: isBlinking && !asleep,
    isHappy: happyTicks > 0,
    isMunching,
    chew: isMunching && Math.floor(tick / 3) % 2 === 0,
    bubble,
    ground,
  }
}

// Load what earlier sessions saved: which buddy, and whether it's hidden
async function loadSaved($: EngineInterface) {
  const savedKind = await $.store.get('kind')
  if (savedKind === 'dino' || savedKind === 'panda') kind = savedKind
  await update($, kindAtom, () => kind)
  const savedHidden = await $.store.get('isHidden')
  await update($, isHidden, () => savedHidden === true)
}

async function choose($: EngineInterface, next: Kind) {
  kind = next
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
const USAGE = 'Usage: /buddy [dino | panda | on | off | jump | snack]'

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
        description: 'Pick your buddy (dino or panda), or show, hide or poke it',
        argumentHint: '[dino | panda | on | off | jump | snack]',
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

    if (arg === 'dino' || arg === 'panda') {
      await choose($, arg)
      return { text: `Your buddy is now the ${arg}.` }
    }
    if (arg === 'off' || arg === 'hide') {
      await setHidden($, true)
      return { text: 'Your buddy is taking a break. /buddy on to bring it back.' }
    }
    if (arg === 'on' || arg === 'show') {
      await setHidden($, false)
      hello()
      return { text: `Your ${kind} is back!` }
    }
    if (arg === 'jump') {
      wake()
      jumps = [...JUMP]
      say(me().lines.jump)
      return {}
    }
    if (arg === 'snack') {
      if (!me().canMunch) return { text: `The ${kind} isn't hungry. Try /buddy panda.` }
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
      answer = await $.ui.ask('Pick your buddy', ['Dino', 'Panda', 'Hide it'])
    } catch {
      return { text: USAGE }
    }
    const picked = answer.trim().toLowerCase()
    if (picked === 'dino' || picked === 'panda') {
      await choose($, picked)
      return { text: `Your buddy is now the ${picked}.` }
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
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    wake()
    // A small hop on each tool call, unless it is already in the air
    if (jumps.length === 0) jumps = [...HOP]
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    wake()
    working = false
    if (e.isAborted) {
      say(me().lines.abort)
    } else if ('reason' in e && e.reason === 'error') {
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
      ours = <Svg source={who.svg(at, cols)} alt={s.bubble ? `Your buddy says: ${s.bubble}` : 'Your buddy'} />
    } else {
      const { Box, Text } = $.ui.resolve(e)
      // Pixel rows the buddy may use: the band's rows less one for the ground
      const rows = Math.max(8, (e.props.maxRows - 1) * 2)
      const drawing = who.terminal(at, cols, rows)
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
          const fitsRight = s.dir === 1 && x + who.width + 1 + said.length <= cols
          const fitsLeft = x >= said.length + 1
          if (fitsRight || !fitsLeft) {
            return (
              <Box key={`r${i}`} flexDirection="row" paddingLeft={x}>
                {sprite}
                <Text italic wrap="truncate">{' ' + said}</Text>
              </Box>
            )
          }
          return (
            <Box key={`r${i}`} flexDirection="row" paddingLeft={x - said.length - 1}>
              <Text italic wrap="truncate">{said + ' '}</Text>
              {sprite}
            </Box>
          )
        }
        return (
          <Box key={`r${i}`} flexDirection="row" paddingLeft={x}>
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

