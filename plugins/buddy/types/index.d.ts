export type Legs = 'stand' | 'a' | 'b' | 'sit'

/** Something loose in the band for the buddy to catch, like the frog's fly */
export type Critter = {
  /** Band column of its left edge (may be past either edge while it flies in) */
  x: number
  /** Pixel row of its top, counted down from the top of the buddy's standing sprite */
  row: number
  /** -1 while it's free; once caught, ticks since the tongue hit it */
  caught: number
  /** Ticks it has been around, for flapping */
  age: number
}

export type Kind = 'panda' | 'dino' | 'cat' | 'penguin' | 'frog' | 'ghost'

export type Scene = {
  /** Column of the buddy's left edge */
  x: number
  /** 1 faces right, -1 faces left */
  dir: 1 | -1
  /** Height above the ground, 0 to 4 */
  air: number
  /** Ticks into the current jump (or roll), 0 when not in one */
  spin: number
  /** Ticks into the current snack, 0 when not having one */
  snack: number
  /** The critter loose in the band for it to catch, if any */
  critter: Critter | null
  legs: Legs
  isAsleep: boolean
  isBlinking: boolean
  /** Shades on, after Claude finishes */
  isHappy: boolean
  isMunching: boolean
  /** Alternates while munching, for a chewing mouth */
  chew: boolean
  bubble: string | null
  /** How far the ground has scrolled while running */
  ground: number
}

declare module 'claude-code' {
  interface PluginState {
    buddy: {
      scene: Scene
      kind: Kind
      isHidden: boolean
    }
  }
}
