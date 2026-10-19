# MakerPilot

**Claude, GPT, and Gemini in your Obsidian workspace.**

[简体中文](README.zh-CN.md) · [Download](https://github.com/zxmio/MakerPilot/releases/latest) · [User guide](docs/USER_GUIDE.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/zxmio/MakerPilot/issues)

MakerPilot is an independent, MIT-licensed fork of [Claudian 2.3.24](https://github.com/YishenTu/claudian/tree/2.3.24). It keeps the upstream workspace and provider architecture, adds a Gemini integration using the official Antigravity CLI's existing Google login, and refines everyday model selection.

## What's included in 0.2.5

- A working status line at the end of each streaming answer: what runs now, the step count, elapsed time and the Esc hint; the work header shows the model's logo.
- A redesigned chat: a session header, live work steps with step counts, folded repeat tool calls, diff previews, Regenerate, and the answering model's name.
- A composer with send/stop, a "+" menu to upload files into the vault, attach images or mention vault files, and the linked note as a chip in the box.
- A history menu with search across active and archived sessions, Today/Yesterday/This week groups and inline rename and pin; opening an archived session restores it.

- Double-click a conversation tab to close it without deleting its history; use its context menu to switch between title and number.
- Claude Code, Codex, and Gemini in one model picker. Models come from your installed provider runtime and account; there is no fixed MakerPilot model list.
- A shared, stepped effort slider with a compact blue-purple track, white rounded thumb, and model-specific reasoning levels. The 188px model menu keeps its width when effort changes; Fast mode shares the same light/dark palette.
- Gemini images (PNG, JPEG, GIF, WebP), conversation rewind, and independent checkpoint forks with durable attachment references.
- macOS Codex discovery prefers the Codex/ChatGPT desktop runtime over an inherited older shell installation. Explicit CLI configuration still takes priority.
- Independent plugin identity and `.makerpilot` storage. Gemini gradient definitions are isolated per icon so hidden menus cannot turn other logos blue.

The inherited architecture also includes other provider adapters. This release's manual validation focused on Claude, Codex model discovery, and Gemini on macOS; it does not claim live account verification of every inherited adapter or every operating system.

## Install

Requirements:

- Obsidian v1.13.0+ on desktop. Mobile is not supported.
- The CLI/runtime and account access for each provider you enable.

MakerPilot is not yet listed in the Obsidian community plugin directory.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/zxmio/MakerPilot/releases/latest).
2. Create `<vault>/.obsidian/plugins/makerpilot/` and put all three files directly in it.
3. Reload Obsidian and enable **MakerPilot** under **Settings → Community plugins**.
4. Disable Claudian/iClaudian before enabling MakerPilot in the same vault; this fork retains upstream CSS names.
5. Open MakerPilot settings, enable a provider, complete its native CLI sign-in, refresh its models, and select which models should appear in chat.

The release also includes an installable ZIP with a `makerpilot/` folder. Extract that folder into `<vault>/.obsidian/plugins/` without nesting another folder inside it.

### Gemini with Google login

Install the official [Antigravity CLI](https://www.antigravity.google/docs/cli/headless/), run `agy` in a terminal to sign in, and confirm `agy models` works. Enable **Gemini** in MakerPilot and refresh its model list. Configure its executable path if it cannot be found automatically. This route uses the CLI's cached Google login; MakerPilot does not import OAuth tokens or ask for an API key. Account eligibility and quotas are controlled by the provider.

### Codex models

Sign in through your installed Codex runtime. On macOS, keep the desktop application updated, then reload MakerPilot after a runtime update. The first opening of Codex model settings after plugin load discovers the catalog; **Refresh** queries it again. Select newly discovered models to show them in chat. Model names, effort levels, image capabilities, and service tiers follow the account's native catalog.

## Important boundaries

- Gemini rewind restores conversation context; it does **not** undo file changes. Forks replay the chosen visible history into a separate native session, not a clone of hidden model reasoning.
- Gemini images are materialized as validated local files and read through the CLI's native file tool. Tool cards and detailed timing are currently live-only; reopened conversations retain dialogue, checkpoints, and image references.
- Interactive Gemini tool approvals are not bridged into this UI. Use a permission mode appropriate for your work; do not assume headless operation can answer every CLI approval prompt.
- Chats, settings, and attachments in `.makerpilot` are private local state. Native provider conversation stores remain owned by their CLIs. Back up your vault before migration or updates.

See the [user guide](docs/USER_GUIDE.md) for daily use, migration, troubleshooting, and permission details.

## Development

Use Node **24.16.0** (`.node-version`). Check `.env.local` before building: `OBSIDIAN_VAULT` enables automatic copying into a local vault.

```sh
npm ci
npm run typecheck
npm run lint
npm run test -- --maxWorkers=2
npm run build
npm run check:performance
```

Read [CONTRIBUTING.md](CONTRIBUTING.md), [MAINTENANCE.md](MAINTENANCE.md), and applicable `AGENTS.md` files. The [Gemini adapter notes](src/providers/antigravity/README.md) describe its protocol boundaries. The [upstream README](README-UPSTREAM.md) is retained for historical reference; its release links and installation identity refer to Claudian, not MakerPilot.

## License and attribution

[MIT](LICENSE). Original Claudian copyright and license are retained. [Third-party notices](THIRD_PARTY_NOTICES.md) cover the Gemini artwork. MakerPilot is independently maintained and is not an official product of Anthropic, OpenAI, or Google. Report MakerPilot-specific issues in [this repository](https://github.com/zxmio/MakerPilot/issues).
