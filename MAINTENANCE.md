# Maintenance

## Upstream baseline

- Claudian tag: `2.3.24`
- Commit: `1e432bef66868d81ec14507138d6c502d31fc4b9`
- Upstream: https://github.com/YishenTu/claudian
- iClaudian was inspected as an integration reference; this provider uses the official headless protocol and does not vendor its OAuth implementation.

The public repository is https://github.com/zxmio/MakerPilot. Keep `origin` pointed there and `upstream` read-only. Do not publish credentials, vault content, settings snapshots, native conversations, or local test logs.

## Updating

Review upstream changes on a separate branch before merging. Pay particular attention to provider contracts, session ownership, storage schemas, model selection, and the shared effort control. Preserve the upstream license and this fork's independent manifest ID. Upstream internal class names and CSS prefixes are intentionally retained to reduce merge churn.

The internal Gemini provider ID remains `antigravity` for existing conversation compatibility. Its user-facing group is Gemini. The CLI executable remains `agy`; do not rename executable paths or stored native session IDs for branding.

## Release checks

Run all checks listed in AGENTS.md on the pinned Node version. Validate an image prompt, effort selection, exact session resume, rewind, fork isolation, and reopening attachments in Obsidian. Package only built plugin files, license/notices, and public documentation. Inspect the archive's file list before distribution.

Release tags use the bare package version (for example, `0.2.0`). Keep package.json, package-lock.json, manifest.json, and versions.json aligned. Update CHANGELOG.md and both user guides. The tag-triggered release workflow verifies the source and publishes the three Obsidian plugin artifacts. Add the installable ZIP, notices, and SHA-256 checksums to the release. Inherited automated issue comments and credential-dependent review bots are removed; extended platform and CodeQL checks remain manually dispatchable. No automatic upstream merge is configured.

## Data

`.makerpilot` is private local state, not source code. Gemini attachment files live under `.makerpilot/gemini/attachments`, named by SHA-256. They are retained for reopened conversations and forks; automatic garbage collection is not implemented. Back up the complete directory with the vault. Do not delete attachments while conversations still reference them.

Conversation rewind rebuilds dialogue context in a new native session. It cannot reverse filesystem edits and does not clone hidden model reasoning. Gemini tool cards and detailed timing are live-only in this version; the durable projection contains dialogue, checkpoint IDs, and image references.

## Codex model discovery

On macOS, automatic CLI resolution prefers the Codex/ChatGPT desktop runtime over inherited shell PATH installations. Explicit CLI paths and the provider's custom PATH retain priority. Without a desktop runtime, shell PATH and standalone installations remain supported. This prevents an old npm CLI from limiting discovery to its older model catalog. Keep the desktop app updated and reload MakerPilot after updating its runtime.

Models, reasoning levels, image capabilities, and service tiers come from the account's native `model/list` response, including pagination; there is no MakerPilot model allowlist. Opening the provider model settings for the first time after loading MakerPilot discovers the catalog; Refresh queries it again. Model visibility and order remain user-controlled; newly discovered models appear in the model browser and can be selected there. Availability still depends on the signed-in account and its native runtime.
