# Buddy

A pixel buddy for [Claude Code](https://code.claude.com): a dino, a panda, a baby panda or a cat that lives above your prompt.

![The dino and the panda, in the terminal and the desktop app](docs/preview.png)

- **You send a message:** it jumps and reacts to what you wrote
- **Claude is working:** it runs back and forth, hopping on each tool call
- **Claude finishes:** double jump (the dino puts its shades on)
- **Idle:** it wanders (the pandas sit down to munch bamboo, the cat to groom)
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
| `/buddy dino`, `/buddy panda`, `/buddy panda2`, `/buddy cat` | Switch buddy (remembered between sessions) |
| `/buddy off`, `/buddy on` | Hide or show it |
| `/buddy jump` | Make it jump |
| `/buddy snack` | Give a panda some bamboo, or set the cat grooming |

## Develop

```bash
claude --plugin-dir plugins/buddy   # from the repo root: load it for one session, reloads on save
claude plugin validate plugins/buddy
claude plugin test plugins/buddy
```

Characters live in `hooks/dino.ts`, `hooks/panda.ts`, `hooks/panda2.ts` and `hooks/cat.ts`; the engine is `hooks/register.tsx`.

## Art

The dino is a 14 × 10 sprite in `hooks/dino.ts`, the cat a 16 × 12 one in `hooks/cat.ts`. The panda's sitting and walking poses started from the pixel art in `art/panda.png` (facing right) and were redrawn with a clean outline: a 17 × 17 sitting pose and a 23 × 16 walking pose, the `SIT` and `WALK` rows in `hooks/panda.ts`; one walking step shows all four legs, the next only the near two. Blinking, chewing and the bamboo are drawn over the sitting pose in code. The baby panda (`hooks/panda2.ts`) is drawn the same way: a 17 × 17 sitting pose and a 21 × 15 walking one.

All four are drawn one art pixel to one half block in the terminal (two pixels stacked per text cell) and never resized, so they stay crisp: the dino takes 14 columns by 7 rows, the cat 16 by 8, the panda 23 columns by 11 rows if the band has room. In the desktop app each art pixel is a 6 px square.
