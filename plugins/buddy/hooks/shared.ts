import type { Scene } from '../types'

// What every character gives the engine: how wide it is, how it draws in
// the terminal and on the desktop, and what it says.
export type Character = {
  /** Columns the terminal sprite takes */
  width: number
  /** Whether it stops for a snack when idle */
  canMunch: boolean
  /** Columns its snack takes up ahead of it (a mouse to chase, a fly to zap); 0 if none */
  snackLane: number
  /** Whether it runs after its snack rather than staying put */
  chases: boolean
  /**
   * For a buddy whose snack is a critter loose in the band (the frog's fly):
   * where its mouth is (pixel row and column, facing right) and how many
   * columns in front its tongue reaches. The critter stays until it's caught
   */
  tongue?: { mouth: [number, number]; reach: number }
  /** Whether it rolls along the ground where others jump */
  rolls: boolean
  /** Columns it travels per tick while jumping or rolling: 0 jumps straight up */
  stride: number
  /** Ticks per step when it walks or runs: 1 is brisk, more is slower */
  pace: number
  /** Draw for the terminal, in `cols` columns and at most `rows` pixel rows (two per text row) */
  terminal: (s: Scene, cols: number, rows: number) => TerminalDrawing
  svg: (s: Scene, cols: number) => string
  lines: {
    hi: string
    jump: string
    done: readonly string[]
    abort: string
    error: string
    snack: readonly string[]
    react: (text: string) => string
  }
}

export type Cell = { ch: string; fg?: string; bg?: string }

export type TerminalDrawing = {
  rows: Cell[][]
  ground: string
  groundColor: string
  /** Columns the drawing starts left of the buddy, for something running ahead of it */
  offset?: number
}

export const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T

// Set one pixel; one outside the sprite is dropped, so things can slide in from off the edge
export function put(rows: string[], r: number, c: number, p: string) {
  const row = rows[r]
  if (row === undefined || c < 0 || c >= row.length) return
  rows[r] = row.slice(0, c) + p + row.slice(c + 1)
}

// Lay a small block of pixels over a sprite at row r, column c ('.' leaves what's there)
export function stamp(rows: string[], r: number, c: number, block: readonly string[]) {
  block.forEach((line, i) => [...line].forEach((p, j) => p !== '.' && put(rows, r + i, c + j, p)))
}

/** Ticks a snack's critter takes to come in from the screen edge before the buddy goes after it */
export const APPROACH = 20

// Columns of band in front of a buddy at x, `width` wide, facing dir
export const roomAhead = (x: number, dir: 1 | -1, width: number, cols: number) =>
  Math.max(0, dir === 1 ? cols - 1 - x - width : x)

// How far in front of a buddy something coming in is, `ticks` into a run-in of
// `length` ticks: from `far` (past the screen edge) to `near`, slowing as it arrives
export function comingIn(ticks: number, length: number, far: number, near: number): number {
  const t = Math.min(ticks, length) / length
  return Math.round(near + (Math.max(far, near) - near) * (1 - t) ** 2)
}

// The sprite turned a quarter clockwise
export const turn = (rows: string[]): string[] =>
  [...(rows[0] ?? '')].map((_, c) => rows.map(r => r[c] ?? '.').reverse().join(''))

export const mirror = (rows: string[], dir: 1 | -1) => (dir === 1 ? rows : rows.map(r => [...r].reverse().join('')))

// Two pixel rows per text row: the top pixel is the character's colour and
// the bottom one its background
export function halfBlocks(sprite: string[], top: number, width: number, pixelRows: number, colours: Record<string, string>): Cell[][] {
  const at = (r: number, c: number): string => {
    const sr = r - top
    const p = sr >= 0 && sr < sprite.length ? sprite[sr]?.[c] : '.'
    return p && p !== '.' ? (colours[p] ?? '') : ''
  }
  const rows: Cell[][] = []
  for (let k = 0; k < pixelRows / 2; k++) {
    const row: Cell[] = []
    for (let c = 0; c < width; c++) {
      const t = at(2 * k, c)
      const b = at(2 * k + 1, c)
      if (!t && !b) row.push({ ch: ' ' })
      else if (t && !b) row.push({ ch: '▀', fg: t })
      else if (!t && b) row.push({ ch: '▄', fg: b })
      else if (t === b) row.push({ ch: '█', fg: t })
      else row.push({ ch: '▀', fg: t, bg: b })
    }
    rows.push(row)
  }
  return rows
}

// Neighbouring cells with the same colours, merged so each is one Text
export function runs(row: Cell[]): Cell[] {
  const out: Cell[] = []
  for (const cell of row) {
    const last = out[out.length - 1]
    if (last && last.fg === cell.fg && last.bg === cell.bg) last.ch += cell.ch
    else out.push({ ...cell })
  }
  return out
}

export const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// One SVG rect per run of same-coloured pixels in a row
export function pixels(rows: string[], ox: number, oy: number, px: number, colours: Record<string, string>): string {
  const out: string[] = []
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      const p = row[c] ?? '.'
      if (p === '.') {
        c += 1
        continue
      }
      let end = c
      while (row[end] === p) end += 1
      out.push(`<rect x="${ox + c * px}" y="${oy + r * px}" width="${(end - c) * px}" height="${px}" fill="${colours[p] ?? '#000'}"/>`)
      c = end
    }
  })
  return out.join('')
}

// The silhouette grown by one pixel, drawn behind the sprite as an outline
export function outline(rows: string[], ox: number, oy: number, px: number, colour: string): string {
  const H = rows.length
  const W = rows[0]?.length ?? 0
  const filled = (r: number, c: number) => (rows[r]?.[c] ?? '.') !== '.'
  const grown: string[] = []
  for (let r = -1; r <= H; r++) {
    let line = ''
    for (let c = -1; c <= W; c++) {
      const near = filled(r, c) || filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)
      line += near ? 'O' : '.'
    }
    grown.push(line)
  }
  return pixels(grown, ox - px, oy - px, px, { O: colour })
}

// A boxy pixel speech bubble beside the sprite
export function bubbleSvg(s: Scene, ox: number, oy: number, size: number, w: number, px: number): string {
  if (!s.bubble) return ''
  const bw = Math.ceil((s.bubble.length * 7.8 + 16) / px) * px
  const bh = 4 * px
  const right = s.dir === 1 ? ox + size + 2 * px + bw < w : ox - bw - 2 * px < 0
  const bx = right ? ox + size + 2 * px : ox - bw - 2 * px
  const by = Math.max(px, oy - px)
  const tx = right ? bx - px : bx + bw
  return (
    `<rect x="${bx}" y="${by - 2}" width="${bw}" height="${bh + 4}" fill="#8a8486"/>` +
    `<rect x="${bx - 2}" y="${by}" width="${bw + 4}" height="${bh}" fill="#8a8486"/>` +
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#ffffff"/>` +
    `<rect x="${tx}" y="${by + bh - 2 * px}" width="${px}" height="${px}" fill="#ffffff"/>` +
    `<rect x="${right ? tx - px : tx + px}" y="${by + bh - px}" width="${px}" height="${px}" fill="#ffffff"/>` +
    `<text x="${bx + bw / 2}" y="${by + bh / 2 + 4.5}" text-anchor="middle" font-family="ui-monospace, Menlo, Monaco, monospace" font-size="13" font-weight="700" fill="#2e2a2b">${esc(s.bubble)}</text>`
  )
}

// A blocky shadow that shrinks as the buddy rises
export function shadowSvg(s: Scene, ox: number, size: number, groundY: number, px: number): string {
  const sw = Math.max(4 * px, size * 0.7 - s.air * 2 * px)
  return `<rect x="${ox + (size - sw) / 2}" y="${groundY}" width="${sw}" height="${px}" fill="#000" opacity="0.18"/>`
}

export const svgOpen = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`
