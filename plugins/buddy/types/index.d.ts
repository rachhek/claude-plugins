export type Legs = 'stand' | 'a' | 'b' | 'sit'

export type Kind = 'dino' | 'panda'

export type Scene = {
  /** Column of the buddy's left edge */
  x: number
  /** 1 faces right, -1 faces left */
  dir: 1 | -1
  /** Height above the ground, 0 to 4 */
  air: number
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
