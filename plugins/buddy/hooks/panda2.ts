import type { Scene } from '../types'
import { pandaWith } from './panda'
import type { Pose } from './panda'
import { pick, put } from './shared'

// A baby panda: the panda's palette and outline, with a bigger round head,
// wide-awake shiny eyes and stubby feet. Drawn like the panda.
//
// Pixels: E outline, eyes and nose, K dark fur, W white fur, S shaded white
// fur, w eye glint, L closed-eye line, R open mouth, G bamboo, g bamboo leaf
const SIT = [
  '.EEEE.......EEEE.',
  'EKKKKEEEEEEEKKKKE',
  'EKKKWWWWWWWWWKKKE',
  '.EKWWWWWWWWWWWKE.',
  '.EWWKKKWWWKKKWWE.',
  'EWWKEwKWWWKEwKWWE',
  'EWWKEEKWWWKEEKWWE',
  'EWWWKKWWEWWKKWWWE',
  '.EWWWWWEWEWWWWWE.',
  '..EEWWWWWWWWWEE..',
  '.EKKEEEEEEEEEKKE.',
  'EKKKKWWWWWWWKKKKE',
  'EKKKKWWWWWWWKKKKE',
  '.EKKEWWWWWWWEKKE.',
  'EKKKEWSSSSSWEKKKE',
  'EKKKKEEEEEEEKKKKE',
  '.EEEE.......EEEE.',
]

function sitting(s: Scene): Pose {
  const rows = [...SIT]
  const set = (r: number, c0: number, c1: number, ch: string) => {
    for (let c = c0; c <= c1; c++) put(rows, r, c, ch)
  }
  if (s.isAsleep || s.isBlinking) {
    // Each eye a light line in its patch
    set(5, 3, 6, 'K')
    set(5, 10, 13, 'K')
    set(6, 4, 5, 'L')
    set(6, 11, 12, 'L')
  }
  if (s.chew) put(rows, 8, 8, 'R')
  if (s.isMunching) {
    // A stalk of bamboo held up in the near paw, leaves at the top
    for (let r = 3; r <= 13; r++) put(rows, r, 15, 'G')
    put(rows, 2, 16, 'g')
    put(rows, 4, 16, 'g')
    put(rows, 3, 14, 'g')
    put(rows, 7, 16, 'g')
    set(11, 13, 16, 'E')
    set(12, 13, 16, 'K')
    set(13, 13, 16, 'E')
  }
  return { w: SIT[0]?.length ?? 0, h: SIT.length, sprite: rows }
}

// Walking, facing right: the same body over two pairs of legs
const BODY = [
  '............EEE.EEE..',
  '...........EKKKEKKKE.',
  '..........EKKWWWWWKKE',
  '.........EWWWWWWWWWWE',
  '.........EWWWWWWKKKWE',
  '...EEEEEEEWWWWWKEwKWE',
  '..EWWWWWWEWWWWWKEEKWE',
  '.EWWWWWWKKEWWWWWKKWEE',
  '.EWWWWWKKKKEWWWWWWWE.',
  'EKWWWWWKKKKKEEWWWEE..',
  '.EWWWWSKKKKKKEEEE....',
  '.EKKSSSKKKKKKKE......',
]
const STEPS = [
  ['.EKKKE...EKKKE.......', 'EKKKE.....EKKKE......', 'EEEE.......EEEE......'],
  ['.EKKKE...EKKKE.......', '..EKKKE.EKKKE........', '..EEEE..EEEE.........'],
]

function walking(s: Scene): Pose {
  const sprite = [...BODY, ...(STEPS[s.legs === 'b' ? 1 : 0] ?? [])]
  return { w: sprite[0]?.length ?? 0, h: sprite.length, sprite }
}

function pose(s: Scene): Pose {
  if (s.isAsleep) return sitting(s)
  if (s.air === 0 && (s.legs === 'a' || s.legs === 'b')) return walking(s)
  return sitting(s)
}

function react(text: string): string {
  const t = text.toLowerCase()
  if (/\b(bug|fix|error|broken|crash)/.test(t)) return pick(['a bug?! eek', 'i help!'])
  if (/\b(test|spec)/.test(t)) return pick(['tests! yay!', 'go go green!'])
  if (/\b(deploy|ship|push|release|merge)/.test(t)) return pick(['ship it!!', 'wheee prod!'])
  if (/\b(refactor|clean|tidy)/.test(t)) return pick(['sparkly!', 'so tidy!'])
  if (/\b(thanks|thank you|thx|nice|great)/.test(t)) return pick(['hehe :3', 'yay!'])
  if (/\b(food|lunch|snack|eat)/.test(t)) return pick(['bamboo pls!', 'snack?!'])
  if (text.trim().endsWith('?')) return pick(['ooh?', 'hmm hmm', '*tilts*'])
  return pick(['hi hi!', 'okie!', 'yay!', '*wiggles*', 'ooh!'])
}

export const panda2 = pandaWith(pose, {
  hi: 'hi hi!',
  jump: 'boing!',
  done: ['yay!!', 'did it!', '*happy roll*'],
  abort: 'aww.',
  error: 'uh oh!',
  snack: ['*nom nom*', 'munch!', 'yum!'],
  react,
})
