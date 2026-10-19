# Gemini

Local provider addition based on Claudian 2.3.24 (`1e432bef66868d81ec14507138d6c502d31fc4b9`).

This adapter uses the official `agy` CLI's cached Google account login. It does not read OAuth tokens or translate subscription credentials into API keys. Gemini availability and quotas remain controlled by the account and CLI.

## Setup

1. Install the official Antigravity CLI and complete Google sign-in with `agy` in a terminal.
2. Confirm `agy models` succeeds.
3. In MakerPilot settings, enable **Gemini**. Set the executable path if automatic discovery fails.
4. Refresh the model catalog and select the desired Gemini models. The model picker groups reasoning variants; use the shared effort slider for Low, Medium, or High.

## Boundaries

- NDJSON input/output, incremental text, native tool events, cancellation, and exact `--conversation` resume.
- Never uses global `--continue`; a mismatched returned conversation ID fails the turn.
- Local history persists a validated text projection with checkpoint IDs and hashed image references. Tool cards and detailed timing are live-only. Native conversation data remains CLI-owned.
- Default permission mode follows native CLI rules. Actions requiring interactive approval cannot be approved from MakerPilot in headless mode. Accept-edits and bypass modes are explicit user choices.
- Restricted auxiliary tool policies are rejected before spawning. Ephemeral sessions, provider commands, and cross-session tools are not supported.
- No hardcoded remote model catalog. Only selected model metadata is persisted.
- Environment changes retire native resume bindings while retaining local text for replay.

Validated against Antigravity CLI 1.4.2 on macOS. Personal-account support follows Google's Gemini CLI transition to Antigravity CLI; this is not a native Gemini CLI adapter.

## References

- [Claudian upstream](https://github.com/YishenTu/claudian/tree/2.3.24)
- [iClaudian reference implementation](https://github.com/izscc/iClaudian)
- [Official headless protocol](https://www.antigravity.google/docs/cli/headless/)
- [Google CLI transition notice](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)

## Verification

Run the repository checks with Node 24.16.0:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run test -- --maxWorkers=2
npm run build
npm run check:performance
```

Check `.env.local` before building: upstream build scripts can copy artifacts into its configured vault.
Images are materialized as validated local files and inspected through the CLI native `view_file` tool. The headless stream does not support direct image content blocks. Conversation rewind and forks replay the selected history into a fresh native session; they do not undo filesystem changes or clone hidden native reasoning. Image references are restored after reopening, with integrity validation.
