import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

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

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const setUp = (on: On, env: Record<string, string> = { TERM: 'xterm-256color' }) => {
  const clock = mock.clock(on)
  mock.store(on)
  mock.env(on, env)
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.run', async () => ({}))
  // Stands for the engine's own (empty) band beneath the plugin
  on('ui.render', async () => ({ type: 'engine', ref: 0 }))
  return clock
}

test('the dino is the default, drawn as text in the terminal and an SVG on the desktop', async ($, on) => {
  const clock = setUp(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /rawr/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /____/ })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.unmount()
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

test('in a terminal that draws pictures, the panda is a real image', async ($, on) => {
  const clock = setUp(on, { TERM: 'xterm-ghostty', TERM_PROGRAM: 'ghostty' })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'buddy', args: 'panda', ...RUN })
  await clock.advance(300)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Image' })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /[█▀▄]/ })).toBeUndefined()
  await term.unmount()

  // /buddy hd off goes back to half blocks
  await $.command.run({ command: 'buddy', args: 'hd off', ...RUN })
  await clock.advance(300)
  const plain = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await plain.find({ type: 'Image' })).toBeUndefined()
  expect(await plain.find({ type: 'Text', text: /[█▀▄]/ })).toBeDefined()
  await plain.unmount()
})
