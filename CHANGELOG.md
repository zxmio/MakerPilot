# Changelog

## Unreleased

- Double-click a conversation tab to close it while preserving history. Title/number display remains available in the context menu.

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
