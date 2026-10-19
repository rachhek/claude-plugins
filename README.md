# claude-plugins

Plugins and mods for [Claude Code](https://code.claude.com) by Rachhek.

## Add the marketplace

Once, in your shell:

```bash
claude plugin marketplace add rachhek/claude-plugins
```

Then install any plugin below with `claude plugin install <name>@rachhek`, or browse them in the **Discover** tab of `/plugin`.

## Plugins

| Plugin | What it does |
| --- | --- |
| [buddy](plugins/buddy) | A pixel buddy above your prompt: a panda, dino, cat, penguin, frog, ghost, crab, rubber duck, snail, or a whole little forest. It jumps at your messages, runs while Claude works and naps when you're away |

![Every buddy, as drawn in the terminal](plugins/buddy/docs/preview.png)

## Develop

Each plugin lives in `plugins/<name>/` with its own `.claude-plugin/plugin.json`, and `.claude-plugin/marketplace.json` lists them all. To work on them locally:

```bash
claude plugin marketplace add .       # plugins load in place from this checkout
claude plugin validate --strict .     # check the marketplace and every plugin
```

Bump a plugin's `version` in its `plugin.json` when you release it, so only that plugin updates for people.

## Contributing

Bug reports, ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Rachhek Shrestha
