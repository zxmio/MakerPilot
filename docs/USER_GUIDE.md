# MakerPilot user guide

For the complete Chinese guide, see [README.zh-CN.md](../README.zh-CN.md).

## Provider setup

Install and sign in to the native CLI/runtime for each provider before enabling it in MakerPilot. Claude uses Claude Code; GPT uses Codex; Gemini uses Antigravity CLI (`agy`). Set an explicit executable path when automatic discovery cannot find your installation. The account and native runtime determine models, access, and quotas.

After enabling a provider, refresh its model catalog and select at least one visible model. Discovered models are not automatically all selected. Drag selected models to order them; the first available selection becomes that provider's default. Use the shared effort slider in the model menu; its levels follow the selected model's capabilities. The compact menu stays the same width when effort changes and adapts to narrow composers. Fast mode uses the same blue-purple palette and white thumb in both themes.

On macOS, automatic Codex lookup prefers the Codex/ChatGPT desktop runtime. An explicit CLI path or provider PATH overrides that preference. Update your desktop app, reload MakerPilot after runtime updates, and refresh its model settings to see new entries. Standalone CLI installations remain a fallback.

For Gemini, run `agy` to sign in and `agy models` to verify access. MakerPilot reuses the native cached login; no token import or API-key conversion is performed. This adapter targets `agy`, not the separate `gemini` executable.

## Conversations and attachments

Double-click a numbered or titled tab with the left mouse button to close it. Conversation history is retained, and the last blank tab stays open. Use the tab context menu to rename it or switch between its title and number.

Open MakerPilot, choose a model, and enter your prompt. Paste or drag PNG, JPEG, GIF, or WebP images into the composer. Gemini stores validated, hashed attachment files locally and passes them to the CLI's native file-reading tool. Reopened chats and forks restore these references with integrity checks.

Use rewind beside a user message to restore earlier conversational context. Use fork beside a response to continue from that checkpoint in an independent conversation. Gemini implements these operations by replaying the chosen visible history into a fresh native session. It does not undo edits on disk or reproduce hidden reasoning.

Gemini tool cards and detailed timing are currently live-only. Dialogue, checkpoints, and image references are durable. Interactive headless tool approvals are not bridged into MakerPilot; choose permissions deliberately and use the native terminal when interactive approval is required.

## Updates and backups

Back up the vault's `.makerpilot` directory before updating. Stop running chats, disable the plugin, replace `main.js`, `styles.css`, and `manifest.json`, then re-enable it. Do not remove `.makerpilot` when replacing the plugin files.

Gemini attachments live in `.makerpilot/gemini/attachments`. No automatic garbage collection is implemented. Back up the complete state directory and avoid removing files referenced by existing chats. Native provider session stores remain owned by their CLIs.

For Claudian migration, stop its active chats and disable it; copy `.claudian` to `.makerpilot`, then rename the copied `claudian-settings.json` to `makerpilot-settings.json`. Preserve the original directory. The two installations do not synchronize later changes. Do not enable Claudian/iClaudian alongside MakerPilot because upstream CSS selectors are retained.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Only older GPT models | Update the desktop runtime, check explicit CLI/PATH overrides, reload the plugin, then refresh models. |
| Models discovered but chat menu empty | Select at least one visible model for that provider. |
| Gemini unavailable | Verify `agy models` in a terminal and the configured executable path; check account access and headless approval requirements. |
| Slider looks wrong or cannot be dragged | Disable overlapping Claudian/iClaudian installations and inspect theme/CSS snippet conflicts. |
| Missing tool cards after reopening | Gemini currently persists dialogue, checkpoints, and image references rather than live tool-card UI. |

Report issues at https://github.com/zxmio/MakerPilot/issues with the plugin, Obsidian, OS, and CLI versions plus reproduction steps. Remove credentials, private note contents, and personal paths from diagnostics before posting them.

### 历史列表

历史菜单顶部有搜索框，搜索时也会列出匹配的归档对话（排在最后的「已归档」分组）。会话按今天、昨天、本周、更早分组，今天和昨天显示时间，本周显示星期，运行中和未读的会话直接标出，当前会话以强调色浅底标出。悬停或键盘聚焦时可重命名、置顶或归档；菜单底部的「已归档」入口显示数量，点进去可以浏览全部归档对话，点开任意一个会先恢复再打开。

### 对话界面（0.2.5）

面板顶部显示当前会话标题和新建、历史按钮。回答进行中，各步骤收在展开的折叠头下，折叠头显示当前模型的 logo 和每一步的状态点；回答的最后一行显示当前在做的事（运行中的工具名和参数）、步数、用时和「Esc 中断」。完成后折叠为「工作了 mm:ss · N 步」，连续多次同类工具调用合并为一行。最新回答下方可重新生成（Claude、Grok、Gemini 通过回退实现，Pi 通过分支实现），并显示回答所用的模型。

输入框左下角的「+」可以上传文件（复制到库的附件文件夹，并把路径作为引用插入输入框）、添加图片或引用库中文件；右下角是发送/停止按钮。
