# Changelog

## 0.2.8 — 2026-10-24

- Refine the history menu: the archive switch is a footer flush with the menu's bottom edge, dates keep their full width, and a row's actions replace its date on hover instead of covering the title.
- Gemini permission modes follow the interface language with short descriptions, like Claude and Codex.
- Update body-parser, qs and zod past published security advisories.

## 0.2.7 — 2026-10-23

- Start a new chat from one "+" button at the end of the numbered tab row; the header keeps only History. In the wide layout, the session sidebar's New does the same.
- "+" on a tab that has not sent a message yet returns to its composer instead of opening another blank tab.
- The working status line shows what runs now, the step count and the elapsed time, without the Esc hint.

## 0.2.6 — 2026-10-20

- Show a response's work as a timeline card: the model's logo and one progress segment per step in the header, each step on a round node whose color shows its state, and expanded commands and results in a quiet panel.
- Text after a step streams inside the work card from the start instead of rendering below it and jumping in later.
- A steered message appears at the end of the transcript, marked "Steering", until the model takes it in.
- Link the open note to a new chat after startup, and offer to link it again with one click after unlinking.
- The history search is one bordered field with the search icon inside.

## 0.2.5 — 2026-10-19

- Show the working status as the response's last line, Claude style: a pulsing dot, what runs now (the running tool's name and arguments), the step count, the elapsed time and the Esc hint.
- The live work header now shows the answering model's logo and one status dot per step.

## 0.2.4 — 2026-10-19

- Add a chat header with the active session title, new conversation and history controls.
- Show work while it streams: steps grow under an open "Working…" header with a step count, then fold into "Worked for mm:ss · N steps" with one status dot per step.
- Fold consecutive successful calls of one tool into a single row, and name core tools in the interface language.
- Preview the first changed lines of collapsed Write/Edit cards; add a task-list progress bar, a code block header with language and copy, and a spinner-style running indicator with a localized interrupt hint.
- Add a send/stop button and a "+" attach menu to the composer: upload a file into the vault and reference its path, attach an image, or mention a vault file.
- Show the linked note as a chip inside the input box, group the slash menu into commands and skills, and localize the queued-message strip.
- Add Regenerate to the latest answer (rewind for Claude, Grok and Gemini; branching for Pi) and show the model that answered.
- Rework the history menu: search that also finds archived sessions, Today/Yesterday/This week groups with times and weekdays, localized running and unread labels, inline rename and pin, and an archive count. Opening an archived session restores it.
- Build auto-copy now targets the `makerpilot` plugin folder.

## 0.2.3 — 2026-10-19

- Compact the history menu into 30px rows with titles on the left and dates on the right.
- Remove decorative session/archive icons and row separators.
- Remove rounded row hover surfaces while preserving selected-session and keyboard-focus indicators.
- Keep session actions available on hover and keyboard focus.

## 0.2.2 — 2026-10-19

- Match Fast mode to the Effort palette, with a white thumb and theme-aware switch and hover colors.
- Stabilize model-menu, effort-label, and toolbar widths when switching reasoning levels; retain responsive sizing in narrow composers.
- Compact the model menu from 224px to 188px while preserving stable effort geometry and responsive bounds.
- Reduce slider focus/hover decoration while keeping keyboard focus visible.

## 0.2.1 — 2026-10-19

- Double-click a numbered or titled conversation tab with the left mouse button to close it while preserving history.
- Keep title/number display and renaming in the tab context menu.
- Preserve the last blank tab and existing close behavior; closing a tab does not stop background generation.
- Add DOM regression coverage for activation, close eligibility, and stale/non-left double clicks.

## 0.2.0 — 2026-10-19

First public MakerPilot release, based on Claudian 2.3.24.

### Added

- Independent MakerPilot plugin identity, view, and `.makerpilot` storage.
- Gemini through the Antigravity CLI's cached Google account login.
- Dynamic Gemini model groups with shared model-specific effort selection.
- Persistent Gemini image attachments, conversation rewind, and independent checkpoint forks.
- English and Chinese setup, usage, migration, troubleshooting, and contribution documentation.

### Changed

- macOS automatic Codex discovery prefers the desktop application's runtime; explicit user configuration retains priority.
- Shared effort control uses an 18px blue-purple stepped track, white rounded thumb, and light/dark palettes.
- Gemini's user-facing provider group is named Gemini; its internal provider ID remains compatible with existing data.

### Fixed

- Older standalone Codex installations shadowing current desktop model catalogs.
- Gemini gradients conflicting between icons in hidden menus and other tabs; each instance now owns its gradient IDs.
- Attachment references remaining available after reopening or forking Gemini conversations.

### Known limitations

- Desktop only; this release's live account validation focused on macOS.
- Gemini rewind does not revert filesystem changes. Forks replay visible context rather than cloning hidden reasoning.
- Gemini tool cards and detailed timing are live-only; interactive tool approvals are not bridged into the plugin.
- Not yet listed in the Obsidian community plugin directory. Install release artifacts manually.

## 0.1.x — local development

Private local iterations for the Gemini adapter, independent fork identity, Codex runtime discovery, and effort/icon refinements. These were not public releases.
