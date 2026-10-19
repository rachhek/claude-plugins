# Buddy

A pixel buddy for [Claude Code](https://code.claude.com): a panda, a dino, a cat, a penguin, a frog or a ghost that lives above your prompt.

![The dino and the panda, in the terminal and the desktop app](docs/preview.png)

- **You send a message:** it jumps (the panda curls up and rolls, the penguin belly-slides, the frog leaps high) and reacts to what you wrote
- **Claude is working:** it runs back and forth, hopping on each tool call
- **Claude finishes:** double jump (the dino puts its shades on)
- **Idle:** it wanders (the panda munches bamboo, the cat chases a mouse, the penguin a fish, the ghost a bat, and the frog zaps a fly)
- **Nothing for a minute:** it naps

Half-block pixel art in the terminal, a bigger pixel sprite in the desktop app's Code tab. It makes no model calls, so it costs nothing to run.

## Install

Needs Claude Code v2.1.287 or later (the desktop app from v2.1.286).

```bash
claude plugin marketplace add rachhek/claude-plugins
claude plugin install buddy@rachhek
```

To remove it: `claude plugin uninstall buddy@rachhek`.

Then run `/reload-plugins` in an open session, or start a new one.

## Commands

| Command | What it does |
| --- | --- |
| `/buddy` | Pick your buddy from a menu |
| `/buddy panda`, `dino`, `cat`, `penguin`, `frog`, `ghost` | Switch buddy (remembered between sessions) |
| `/buddy off`, `/buddy on` | Hide or show it |
| `/buddy jump` | Make it jump (or roll, or slide) |
| `/buddy snack` | Snack time: bamboo, a mouse, a fish, a fly or a bat |

## Develop

```bash
claude --plugin-dir plugins/buddy   # from the repo root: load it for one session, reloads on save
claude plugin validate plugins/buddy
claude plugin test plugins/buddy
```

Each character lives in its own file in `hooks/` (`panda.ts`, `dino.ts`, `cat.ts`, `penguin.ts`, `frog.ts`, `ghost.ts`); the engine is `hooks/register.tsx`.

## Art

The dino is a 14 × 10 sprite, the cat 16 × 14, the penguin 18 × 16, the frog 18 × 14 and the ghost 16 × 14. The panda's sitting and walking poses started from the pixel art in `art/panda.png` (facing right) and were redrawn with a clean outline: a 17 × 17 sitting pose and a 23 × 16 walking pose, the `SIT` and `WALK` rows in `hooks/panda.ts`; one walking step shows all four legs, the next only the near two. Blinking, chewing and the bamboo are drawn over the sitting pose in code.

All of them are drawn one art pixel to one half block in the terminal (two pixels stacked per text cell) and never resized, so they stay crisp: the dino takes 14 columns by 7 rows, the cat 16 by 9, the panda 23 columns by 11 rows if the band has room. In the desktop app each art pixel is a 6 px square.
