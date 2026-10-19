# Contributing

Thanks for wanting to help! This repo is a small [Claude Code](https://code.claude.com) plugin marketplace. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug or suggesting an idea

Open an [issue](https://github.com/rachhek/claude-plugins/issues). For a bug, include:

- which plugin (and buddy, if it's buddy) and its version (`claude plugin list`)
- your Claude Code version (`claude --version`), and whether it's the terminal or the desktop app
- your terminal, and a screenshot if something looks wrong

## Setting up

You need [Claude Code](https://code.claude.com) and Node.js (for the type check).

```bash
git clone https://github.com/rachhek/claude-plugins
cd claude-plugins
claude --plugin-dir plugins/buddy   # try buddy from your checkout; it reloads when you save
```

A session started this way uses your local files. A session using the installed `buddy@rachhek` keeps showing the published version.

## Layout

```
.claude-plugin/marketplace.json   the marketplace: lists every plugin
plugins/<name>/                   one folder per plugin
  .claude-plugin/plugin.json      its name, version and description
  hooks/                          its code
  tests/                          its tests
  README.md, LICENSE              its docs, shipped with it
```

## Before you open a pull request

Run these from the repo root and make sure they all pass:

```bash
claude plugin validate --strict .                          # the marketplace and every plugin
claude plugin test plugins/buddy                           # the tests
npx -y -p typescript@5.6.3 tsc --noEmit -p plugins/buddy   # the type check
```

Then:

- **Try it live** with `claude --plugin-dir plugins/<name>`. Tests check that things draw without crashing, not that they look right.
- **Bump the version** in the plugin's `.claude-plugin/plugin.json` if people should get your change, so `claude plugin update` picks it up. Use semver: a new buddy or feature is a minor bump, a fix is a patch.
- **Update the docs:** the plugin's README, and the marketplace description in `.claude-plugin/marketplace.json` if what the plugin does has changed.
- **Keep commits small and focused,** with a message that starts with the plugin's name, for example `buddy: the snail hides in its shell when upset`.

## Adding or changing a buddy

Read [plugins/buddy/AGENTS.md](plugins/buddy/AGENTS.md) first. It explains how buddies are drawn, the art style, and what each character setting does. In short:

- **One file per buddy** in `plugins/buddy/hooks/`, exporting a `Character`. Add it to `CHARACTERS` in `hooks/register.tsx`, to `Kind` in `types/index.d.ts`, to the list of buddies in the tests, and to the README.
- **Draw by hand, keep it crisp.** Art is rows of letters, one letter per pixel. One art pixel is one half-block in the terminal, and nothing is ever resized or blended. Give shapes a dark outline and make sure the buddy reads on a dark background.
- **Look before you code.** Render a draft to a PNG and look at it before writing the character, then check the code draws exactly what you rendered.
- **Test every pose.** Add a test that draws each new pose (eating, chasing, hiding...), since a pose no test reaches can hide a crash.
- **Never draw past the band's edges,** and keep a buddy within the band's height.

## Original work only

Every buddy has to be your own design, or something you have the right to share under the MIT license. Please don't submit characters from games, films, comics or other franchises, such as Pokémon, Disney, Star Wars, Studio Ghibli or Moomin, even as fan art. They're owned by others, and a takedown notice would take the whole repo down. Characters released under an open license (for example CC0 or CC BY) are fine if you credit them in the README. Real animals, folklore creatures and your own original characters are always welcome.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE), the same as the rest of the project.
