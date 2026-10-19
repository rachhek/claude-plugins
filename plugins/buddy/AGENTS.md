# Buddy: notes for agents

A pixel buddy (panda, dino or cat) drawn in the band above Claude Code's
prompt. The engine is `hooks/register.tsx`; each character is one file in
`hooks/` (`panda.ts`, `dino.ts`, `cat.ts`); shared drawing helpers are in
`hooks/shared.ts`.

## Keep the pixels crisp

- **One art pixel is one half block.** In the terminal each text cell shows
  two pixels stacked (`▀`, `▄`, `█` with a foreground and background colour),
  via `halfBlocks` in `shared.ts`. Never resize a sprite: stretching 17 rows
  to 18, shrinking to fit a smaller band, or blending colours is what made the
  old panda blurry. If a sprite needs to be bigger or smaller, redraw it.
- **Desktop pixels are whole squares.** Every character uses `PX = 6` on the
  desktop SVG, drawn with `shape-rendering="crispEdges"`. No fractional sizes.
- **No picture mode.** Drawing the buddy as an image (the old hd mode) only
  worked in some terminals, and terminals smooth images when they scale them.
  It was removed; don't bring it back.
- **Never draw past the band's edges.** A row wider than the band gets
  squeezed and its pixels come out garbled, so anything drawn beyond a
  character's `width` (like the cat's mouse) must turn around in time.
- **Size limits.** Height is at most two pixel rows per text row in the band,
  less one row for the ground (`(maxRows - 1) * 2`). The panda, the biggest,
  is 17 × 17 sitting and 23 × 16 walking, with room to jump in 22 pixel rows.
  Width is free, but `width` on the character is what the engine uses to keep
  it on screen.

## The art style

What the panda taught us looks good at this scale:

- **A full dark outline (`E`)** around every shape. White fur running straight
  into the background is what reads as jagged.
- **Symmetry** in front-facing poses: ears, cheeks, eye patches and feet mirror
  each other. No one-sided specks or stray single pixels.
- **Even curves**: edges step evenly (1, 2, 3...), never a lone bump.
- **Big eye patches**: dark fur (`K`) around a 2 × 2 pupil with a white glint
  (`w`). The panda's patches slant down and outward, which gives it its sleepy
  look.
- **Terminals are dark.** The outline colour nearly vanishes against them, so
  dark parts that overlap (far and near legs, a paw over the body) need a
  lighter shade (`k`) plus a gap or outline to stay apart.
- **Props should read at a glance.** The panda holds its bamboo diagonally up
  through its mouth with one lighter paw, the way real pandas eat; widen the
  canvas (two columns each side) rather than squeezing a prop in.
- **Walk cycles need two different silhouettes.** The panda alternates all
  four legs showing with only the near two showing. Two frames with the same
  outline look like standing still.

## Character traits

Each character is a `Character` (see `shared.ts`):

- `width`: columns its sprite takes in the terminal
- `canMunch`: stops for a snack when idle, and answers `/buddy snack`
- `snackLane`: columns its snack takes up ahead of it (the cat's mouse, the
  frog's incoming fly); 0 if it eats in place (the panda's bamboo). During a
  snack the engine turns it to face the side with that much room
- `chases`: runs after its snack (cat, penguin, ghost) rather than staying put
- A snack can be a critter loose in the band (the frog's fly): give the
  character a `tongue` (mouth and reach) and the engine keeps a `critter` with
  its own band position. It flies in from the edge the buddy faces, wanders,
  drifts towards the buddy, and stays whatever the buddy does (walking,
  hopping, Claude working) until it comes within reach and gets caught. Never
  tie a critter's life to the buddy's pose or the snack timer: that made the fly
  vanish whenever the frog moved
- Snack critters should behave like critters, not walk into the buddy's mouth:
  hover, wander, drift in. Keep the catch itself quick (the frog's tongue: one
  frame on the fly, one reeling it back, then the gulp)
- Snacks come in from off-screen, from the edge the buddy faces: draw out to
  the edge (`roomAhead`), let `put`/`stamp` drop pixels past it, and ease the
  critter in with `comingIn`. A chaser holds still for `APPROACH` ticks while
  its critter arrives, then the chase starts
- `stride`: columns it travels per tick in a jump or roll: 0 jumps straight
  up, the panda rolls along at 0.5, the frog leaps forward at 2
- `rolls`: rolls along the ground where others jump. The panda curls into a
  ball with its eyes shut and turns a quarter every other tick
- `pace`: ticks per step; pandas are chill, so the panda's is 2
- `width: 0` makes a whole-band scene (the forest): it draws rows exactly
  `cols` wide with `offset: s.x`, so it sits at column 0, and the engine never
  gives it a speech bubble
- The scene also carries `tick` (ten a second, for ambient animation),
  `isWorking` and `isUpset` (an error or interrupted turn, for a few seconds)
- `terminal`, `svg`, `lines`: how it draws and what it says

Art lives in the character file as rows of letters, one letter per pixel and
`.` for clear, with a legend comment saying what each letter is. Every row in a
sprite is the same length, and sprites face right; `mirror` flips them.
Blinking, eating and other changes are drawn over the base sprite with `put`.

To add a character: a new file in `hooks/`, an entry in `CHARACTERS` in
`register.tsx`, its name in `Kind` in `types/index.d.ts`, and the README.

## Working on the art

- Draft a sprite in a throwaway script, render it to a PNG at 10–16× on a
  dark background (`#1e1e1e`), and look at it before writing any code. Show
  the person the render; they judge by eye.
- When art is generated by a script, check the code produces exactly the frame
  that was rendered.
- `claude plugin test plugins/buddy` runs the tests. Tests only check the
  buddy draws without crashing; they don't check how it looks. A path no test
  reaches (eating, chasing) can hide a crash until it happens live, so add a
  test that renders each new pose.
- To see local changes, run `claude --plugin-dir plugins/buddy` from the repo
  root in a new terminal. A session using the installed plugin
  (`buddy@rachhek`) keeps showing the published version until it's updated.
