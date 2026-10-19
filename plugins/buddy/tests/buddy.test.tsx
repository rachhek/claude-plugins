import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { turn } from '../hooks/shared'

const BAND = {
  plugin: 'buddy',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

// A tool call, with the tool's arguments loosely typed (the full types are too deep for a test)
const callTool = ($: { tool: { call: unknown } }, input: Record<string, unknown>) =>
  ($.tool.call as (input: Record<string, unknown>) => Promise<unknown>)(input)

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const setUp = (on: On) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.run', async () => ({}))
  // Stands for the engine's own (empty) band beneath the plugin
  on('ui.render', async () => ({ type: 'engine', ref: 0 }))
  return clock
}

test('the panda is the default, drawn as text in the terminal and an SVG on the desktop', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /yo\./ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /\.,\.\./ })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()
})

test('/buddy dino switches to the dino', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'dino', ...RUN })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /rawr/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /____/ })).toBeDefined()
  await term.unmount()
})

test('/buddy panda switches to the panda, which reacts in its own words', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'panda', ...RUN })
  await clock.advance(300)

  let term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /yo\./ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /\.,\.\./ })).toBeDefined()
  await term.unmount()

  await $.prompt.submit({ text: 'please fix this bug', origin: { kind: 'composer' }, wait: false })
  await clock.advance(300)
  term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /cracks knuckles|bug\? easy/ })).toBeDefined()
  await term.unmount()
})

test('/buddy off hides it', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'off', ...RUN })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeUndefined()
  await term.unmount()
})

test('the panda is drawn as text blocks, never a picture', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'panda', ...RUN })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Image' })).toBeUndefined()
  expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeDefined()
  await term.unmount()
})

test('/buddy cat switches to the cat; unknown names are refused', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'cat', ...RUN })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /mrrp/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeDefined()
  await term.unmount()

  // An inherited object key is not a buddy
  const res = await $.command.run({ command: 'buddy', args: 'constructor', ...RUN })
  expect(res.text).toMatch(/Usage/)
})

test('turn rotates a sprite a quarter clockwise', () => {
  expect(turn(['ab', 'cd'])).toEqual(['ca', 'db'])
  const s = ['abc', 'def']
  expect(turn(turn(turn(turn(s))))).toEqual(s)
})

test('/buddy snack sits the panda down to eat', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'snack', ...RUN })
  // Through a few chews
  for (let i = 0; i < 6; i++) {
    await clock.advance(100)
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeDefined()
    await term.unmount()
  }
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()
})

test('/buddy snack sends the cat after a mouse', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'cat', ...RUN })
  await $.command.run({ command: 'buddy', args: 'snack', ...RUN })
  // Through a few steps of the chase, whichever way it runs
  for (let i = 0; i < 20; i++) {
    await clock.advance(100)
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeDefined()
    await term.unmount()
  }
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()
})

for (const kind of ['panda', 'dino', 'cat', 'penguin', 'frog', 'ghost', 'crab', 'duck', 'snail', 'forest']) {
  test(`the ${kind} draws through walking, jumping, its snack, happy and asleep`, async ($, on) => {
    const clock = setUp(on)
    on('turn.complete', async () => ({ text: '' }))
    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    const draws = async () => {
      for (const surface of ['terminal', 'desktop'] as const) {
        const view = await $.ui.mount({ ...BAND, surface })
        expect(await view.find({ type: surface === 'terminal' ? 'Box' : 'Svg' })).toBeDefined()
        await view.unmount()
      }
    }
    const through = async (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        await clock.advance(100)
        await draws()
      }
    }
    await $.command.run({ command: 'buddy', args: kind, ...RUN })
    await through(12) // hello jump, then walking
    await $.command.run({ command: 'buddy', args: 'poke', ...RUN })
    await through(12)
    await $.command.run({ command: 'buddy', args: 'snack', ...RUN })
    await through(40) // the snack, turning at the edges while chasing
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
    await through(20) // happy
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't2', reason: 'error' })
    await through(5) // upset
    await clock.advance(61_000)
    await draws() // asleep
  })
}

test('the frog\'s fly stays about, even when it is interrupted, until the frog catches it', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'frog', ...RUN })
  await $.command.run({ command: 'buddy', args: 'snack', ...RUN })
  await clock.advance(3000)
  // A message wakes it and sets it hopping; the fly should still be there to catch
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' }, wait: false })
  let caught = false
  for (let i = 0; i < 400 && !caught; i++) {
    await clock.advance(500)
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    caught = (await term.find({ type: 'Text', text: /\*zap\*|gulp|mmm fly/ })) !== undefined
    await term.unmount()
  }
  expect(caught).toBe(true)
})

test('a scene is called by its name', async ($, on) => {
  setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'buddy', args: 'forest', ...RUN })).text).toBe('Your buddy is now Forest.')
  expect((await $.command.run({ command: 'buddy', args: 'panda', ...RUN })).text).toBe('Your buddy is now the panda.')
})

test('a git commit or push sets off a celebration', async ($, on) => {
  const clock = setUp(on)
  on('tool.call', async () => ({ result: '' }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const says = async (text: RegExp) => {
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const found = (await term.find({ type: 'Text', text })) !== undefined
    await term.unmount()
    return found
  }
  await callTool($, { tool: 'Bash', command: 'git commit -m "a thing"', tool_use_id: 't1' })
  await clock.advance(200)
  expect(await says(/committed!/)).toBe(true)
  await clock.advance(5000)
  await callTool($, { tool: 'Bash', command: 'git push', tool_use_id: 't2' })
  await clock.advance(200)
  expect(await says(/shipped!/)).toBe(true)
  await clock.advance(5000)
  await callTool($, { tool: 'Read', file_path: '/tmp/x', tool_use_id: 't3' })
  await clock.advance(200)
  // Confetti and glasses don't crash any buddy
  for (const surface of ['terminal', 'desktop'] as const) {
    const view = await $.ui.mount({ ...BAND, surface })
    expect(await view.find({ type: surface === 'terminal' ? 'Box' : 'Svg' })).toBeDefined()
    await view.unmount()
  }
})

test('a question from Claude shows a "?" until it is answered; a long quiet wait gets a yawn', async ($, on) => {
  const clock = setUp(on)
  let answer = () => {}
  const answered = new Promise<void>(resolve => (answer = resolve))
  on('tool.call', async (_$, e) => {
    if ((e as { tool: string }).tool === 'AskUserQuestion') await answered
    return { result: '' }
  })
  on('turn.start', async () => ({ turnId: 't' }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const says = async (text: RegExp) => {
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const found = (await term.find({ type: 'Text', text })) !== undefined
    await term.unmount()
    return found
  }
  const asked = callTool($, { tool: 'AskUserQuestion', questions: [], tool_use_id: 'q1' })
  await clock.advance(6000) // well past an ordinary bubble
  expect(['asking', await says(/‹\?›/)]).toEqual(['asking', true])
  answer()
  await asked
  await clock.advance(4000)
  expect(['answered', await says(/‹\?›/)]).toEqual(['answered', false])

  await $.turn.start({ turnId: 't' } as never)
  await clock.advance(16_000)
  expect(['yawn', await says(/yawn/)]).toEqual(['yawn', true])
})
