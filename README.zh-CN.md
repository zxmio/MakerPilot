# MakerPilot

**在 Obsidian 中统一使用 Claude、GPT 和 Gemini。**

[English](README.md) · [下载最新版](https://github.com/zxmio/MakerPilot/releases/latest) · [更新记录](CHANGELOG.md) · [反馈问题](https://github.com/zxmio/MakerPilot/issues)

MakerPilot 基于 [Claudian 2.3.24](https://github.com/YishenTu/claudian/tree/2.3.24) 独立开发，以 MIT 协议开源。当前版本为 **0.2.4**，重做对话界面：顶部会话标题栏，运行中实时显示步骤和步数，同类工具调用合并，编辑卡片预览改动，支持重新生成并显示回答所用的模型；输入框新增发送/停止按钮和「+」菜单（上传文件到库并引用路径、添加图片、引用库中文件），关联笔记显示为框内标签；历史菜单支持搜索（含归档对话）、按日期分组和行内重命名、置顶，打开归档对话会自动恢复。0.2.0 是首个公开版本，重点完善 Gemini 接入、模型发现和日常交互。

## 当前功能

- 在同一模型菜单中使用 Claude Code、Codex 和 Gemini。
- 模型与努力程度由本机提供商程序及账号动态提供，不在插件中写死最新型号。
- 统一的 Effort 拖动控件：18px 蓝紫色轨道、白色圆角滑钮、离散档位；Fast mode 使用相同的明暗配色。
- 模型菜单宽度收至 188px，切换 Effort 时保持稳定，窄窗口下自动适配。
- Gemini 支持图片附件、对话回退、从回复位置分叉，并在重开会话后恢复图片引用。
- macOS 默认优先使用 Codex/ChatGPT 桌面应用内置的 Codex，避免旧版独立 CLI 限制模型列表。
- 独立插件 ID `makerpilot` 和数据目录 `.makerpilot`，保留原版数据。

当前实机验证集中在 macOS：Claude 使用流程、Codex 模型发现以及 Gemini 对话、图片、努力程度、回退和分叉。继承的其他提供商适配器仍在源码中，但不代表它们或 Windows/Linux 都已做过账号实测。插件仅支持桌面版 Obsidian，不支持手机端。

## 安装

需要 Obsidian **1.13.0+**，以及所用模型提供商的官方 CLI/运行程序和可用账号。MakerPilot 尚未提交 Obsidian 社区插件目录。

1. 前往 [Releases](https://github.com/zxmio/MakerPilot/releases/latest)，下载 `main.js`、`manifest.json`、`styles.css`。
2. 在仓库中创建 `.obsidian/plugins/makerpilot/`，将三个文件直接放进去。
3. 重新加载 Obsidian，在「设置 → 第三方插件」中启用 MakerPilot。
4. 同一仓库中先关闭 Claudian/iClaudian，避免继承样式重复加载造成冲突。
5. 在 MakerPilot 设置里启用所需提供商，完成它自己的登录，刷新模型列表并勾选要显示的模型。

也可以下载 `MakerPilot-0.2.4.zip`，把其中的 `makerpilot` 文件夹解压到 `.obsidian/plugins/`。不要出现 `makerpilot/makerpilot/` 的重复目录。

## 连接账号

### Claude

先安装并在终端登录 Claude Code，再到 MakerPilot 设置中启用 Claude Code。如果找不到程序，填写其可执行文件路径。模型与额度由你的账号决定。

### Codex / GPT

先通过已安装的 Codex 运行程序登录账号。macOS 默认优先使用 Codex/ChatGPT 桌面应用内置版本；你显式填写的 CLI 路径或提供商 PATH 配置仍优先。

保持桌面应用更新；更新其运行程序后重载 MakerPilot，再打开 Codex 模型设置。插件每次加载后首次打开该设置会发现模型；「刷新」可再次获取目录。新模型出现在浏览列表后，勾选即可加入聊天菜单，拖动可调整顺序。

「发现了模型」与「在聊天中显示模型」是两层设置。若显示“可见 0”，至少勾选一个模型才能使用该提供商。

### Gemini / Google 账号

1. 安装官方 [Antigravity CLI](https://www.antigravity.google/docs/cli/headless/)。
2. 在终端运行 `agy`，完成 Google 账号登录。
3. 确认 `agy models` 能列出模型。
4. 在 MakerPilot 设置中启用 **Gemini**，必要时填写 `agy` 可执行文件的完整路径。
5. 刷新模型目录并勾选需要使用的模型。

这条接入路线复用官方 CLI 已缓存的 Google 登录，不需要在插件中填写 API Key，也不会把 OAuth 凭据导入 MakerPilot。账号可用范围和额度由提供商决定。它不是直接调用独立 `gemini` 命令的适配器。

## 日常使用

**关闭对话标签**：鼠标左键双击输入框上方的编号或标题标签即可关闭，历史记录仍保留。最后一个空白标签会保留。显示标题、显示编号和重命名可在标签右键菜单中操作。

**选择模型与努力程度**：点击输入框底部的模型按钮，在菜单中选模型，再拖动 Effort。各模型档位可能不同；Gemini 的 Low/Medium/High 会映射到 CLI 实际提供的对应变体。

**图片**：粘贴或拖入 PNG、JPEG、GIF、WebP。Gemini 会将图片保存为校验过的本地附件，再通过 CLI 原生文件工具读取。图片不是以 API 图片消息块发送。

**回退**：在用户消息旁使用回退操作，重新建立该位置之前的对话上下文。Gemini 的回退不会撤销已经发生的文件修改。

**分叉**：在模型回复旁使用分叉操作，可以保留该位置之前的对话，开始一个独立会话。Gemini 分叉重放可见对话和图片，不复制模型隐藏推理。

**权限**：先检查提供商权限设置。Gemini 无头模式尚未把交互式工具审批接入插件；需要交互确认的操作可能无法继续。不要仅为绕过报错而开启更高权限。

## 数据与迁移

MakerPilot 设置和会话保存在仓库的 `.makerpilot` 中；Gemini 图片位于 `.makerpilot/gemini/attachments`。请备份整个目录。附件尚无自动清理功能，不要在会话仍引用图片时单独删除它。提供商的原生会话仍由各自 CLI 保存。

从 Claudian 迁移时：

1. 结束正在运行的对话并关闭原插件，备份 `.claudian`。
2. 将 `.claudian` **复制**为 `.makerpilot`。
3. 在副本中把 `claudian-settings.json` 重命名为 `makerpilot-settings.json`。
4. 启用 MakerPilot，检查模型、权限和历史记录。不要把两个插件同时启用。

原目录保持不动。两个版本后续产生的设置和会话不会自动双向同步。不要把 `.makerpilot`、`.claudian`、OAuth 文件、API Key 或私人笔记提交到 GitHub。

## 常见问题

- **只看到旧 GPT 型号**：更新桌面应用并重载插件；检查是否显式指定了旧 CLI 路径，然后刷新模型目录。
- **有模型但菜单为空**：在「可见模型」中勾选至少一项。
- **Gemini 登录正常但插件不可用**：先确认 `agy models` 在终端可用，并核对插件使用的可执行文件路径。旧 CLI、账号权限或无头审批限制都可能导致失败。
- **努力程度滑块外观异常或点不动**：确认 Claudian/iClaudian 已关闭；临时关闭其他主题片段检查样式冲突。
- **重开 Gemini 会话后少了工具卡片**：当前持久化的是文字、检查点和图片引用，工具卡片与详细计时仅在当次运行中显示。

## 反馈与许可

请在 [MakerPilot Issues](https://github.com/zxmio/MakerPilot/issues) 提供版本号、系统、Obsidian 版本、提供商 CLI 版本和复现步骤。发布日志或截图前去掉凭据、私人内容和个人路径。

保留 Claudian 原作者的 MIT 许可及署名。见 [LICENSE](LICENSE)、[第三方说明](THIRD_PARTY_NOTICES.md)。MakerPilot 是独立项目，不是 Anthropic、OpenAI 或 Google 官方产品。
