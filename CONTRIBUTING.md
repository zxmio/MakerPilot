# Contributing to MakerPilot

Issues and pull requests are welcome. Issues are the preferred way to contribute: if you describe the problem and your environment clearly, I will review it and make a best effort to address it.

## Before You Start

- Search existing issues and pull requests to avoid duplicates.
- For a substantial change, open an issue first so the problem and scope can be discussed before implementation.
- Keep each pull request focused on one problem. Unrelated fixes, refactors, formatting changes, or dependency updates should be submitted separately.

## Reporting an Issue

A useful issue explains the problem well enough for someone else to understand and reproduce it. Please include:

- What you were trying to do.
- What happened and what you expected instead.
- Clear reproduction steps or a minimal example.
- Your MakerPilot version, Obsidian version, operating system, provider, provider CLI version, and installation method.
- Relevant logs, screenshots, or recordings.

Remove API keys, tokens, private vault content, personal paths, and other sensitive information before attaching logs or screenshots.

For a feature request, start with the user problem or unmet use case. A proposed solution is helpful, but explaining the need is more important than prescribing an implementation.

## Pull Requests

Pull requests are welcome when they solve a specific, well-defined problem. A pull request description must explain:

- **Why:** the problem being solved, who it affects, and why it is worth solving.
- **What:** the behavior or code that changes.
- **Why this approach:** why the proposed design is a good fit, including meaningful alternatives and tradeoffs.
- **Validation:** tests and manual checks performed, with screenshots or recordings for user-facing changes.
- **Impact:** known limitations, compatibility or data risks, and any follow-up work.
- **Context:** a linked issue when one exists.

Please also:

- Add or update tests for behavior changes and bug fixes.
- Preserve provider and feature ownership boundaries; avoid coupling shared feature code to provider internals.
- Avoid new production dependencies unless the need and tradeoff are explicit.
- Update documentation when behavior or user-facing configuration changes.

## Provider changes

Open an issue before adding a provider or changing authentication behavior. Describe the actual workflow, native protocol, permission boundary, persistence, cancellation, and test plan. Focus on reliable existing integrations before expanding the provider list. Preserve account credentials in the native provider's store; never commit or request real credentials in tests or issues.

## Development

MakerPilot requires the Node.js version declared in `.node-version`.

```bash
npm install
npm run dev
```

For a bug fix or new behavior, add or update a failing test first, then make the narrowest implementation change that passes it. Use focused checks while iterating. Before submitting a pull request, run the full verification suite:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run check:performance
```

For local iteration, `npm run test:affected -- --base origin/main` selects tests from
committed, staged, unstaged and untracked changes using the CI dependency graph.
It prints the selection and runs the selected Jest and script checks.
Use `--list` to inspect without running, `--full` for all tests, and `-- --runInBand` to forward Jest
options. Unknown inputs or an unavailable base retain full coverage. This does not
replace typecheck, lint, build/performance checks or native checks on other platforms.

Full Linux CI verification uses two Jest shards, with script checks on the first
shard. Affected selections use one job. Each Linux test job uses three workers.
Both shards must pass the aggregate test gate, and each uploads its own timing artifact. Sharding uses more runner capacity
to reduce elapsed time; compare runner minutes as well as wall time.

JSON Jest runs also produce suite timings and execution metadata. CI uploads these
for Linux, native smoke and scheduled suites. To compare native worker counts locally:

```bash
npm run test:cross-platform -- --maxWorkers=2 --json --outputFile=.context/native.json
node scripts/summarize-jest-results.mjs .context/native.json .context/native-timings
```

CI runs native smoke with three workers on both macOS and Windows. The local wrapper
remains serial unless a worker count is supplied. Compare the same selection and
commit, including fixture setup/teardown, and report elapsed time separately from
summed suite durations. Recheck timings on the actual CI runners before increasing
concurrency further.

The project architecture and area-specific development rules are documented in `AGENTS.md` and the scoped `AGENTS.md` files under `src/`.
