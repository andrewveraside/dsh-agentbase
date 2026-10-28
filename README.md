# AgentBase 管理页（DSH 插件）

把一个面板塞进 DSH 侧边栏，统一盘点本机四家 agent 的 MCP 与 Skill：DSH / WorkBuddy / CodeBuddy / ZCode。

## 数据从哪来（只读盘点）

| agent | MCP 来源 | Skill 目录 |
|---|---|---|
| DSH | profile 的 `cordis.patch.yml` 里 `dsh-mcp-client` 条目 | `~/.dsh/skills` ↔ `~/.dsh/skills-disabled` |
| WorkBuddy | `~/.workbuddy/mcp.json` | `~/.workbuddy/skills` ↔ `~/.workbuddy/_disabled-skills` |
| CodeBuddy | `~/.codebuddy/mcp.json` | `~/.codebuddy/skills` ↔ `~/.codebuddy/skills-disabled` |
| ZCode | `~/.zcode/cli/config.json` 的 `mcp.servers` | `~/.zcode/skills` ↔ `~/.zcode/skills-disabled` |
| 共享库 | — | `D:\AgentBase\skills`（只读） |

## 能改什么

- **MCP 开关**（wb / cb / zc）：条目在 `mcp.json` 与同目录 sidecar `<name>.disabled.json` 之间搬；改动前自动备份 `<file>.bak-agentbase-<时间戳>`。
- **Skill 开关**：目录在 active / disabled 两个文件夹之间移动。
- **DSH 的 MCP 条目只读**：它在 `cordis.patch.yml` 里，用注释与手写 YAML 编辑更安全，页面上只显示不提供开关。

改完要**重启对应 agent** 才生效（页面上有提示）。

## 文件

- `data.js` 盘点/改写逻辑（可单独用 node 跑：`import('./data.js').then(m => console.log(m.collectOverview()))`）
- `index.js` Host 半边：注册三条 HTTP 路由 `/agentbase/overview`、`/agentbase/mcp`、`/agentbase/skill`
- `client.js` 浏览器半边：`sidebar.panellist` 一行 + `main` 页面，手写 CJS 工厂，无构建步骤
- `cordis.patch.yml` bundle 补丁（profile 装好后自动插入 `agentbase-manager` 条目）

## 装法（已完成，重装时照做）

```bash
dsh plugin --profile desktop add file:D:/aiprojects/dsh-agentbase   # 装包 + 自动登记进 profile 的 bundles
# 重启 DSH 桌面端
```

坑：`file:` 依赖是**拷贝**不是链接，改完源码必须 `bash sync-to-profile.sh` 同步进
`E:\DshData\.dsh\profiles\desktop\node_modules\@local\dsh-agentbase\`，否则桌面端起的是旧代码。

## 验证过的

- `/agentbase/overview` 返回 200、约 88 KB JSON（4 个 agent + 共享库 68 个 skill）
- MCP 开关往返（临时目录单测）：disable → 进 sidecar + 生成备份；enable → 回 `mcpServers`
- Skill 开关往返（`~/.dsh/skills-disabled` 临时技能）：两次移动都成功
- `node --check` 三个文件语法通过；测试服务器上插件激活无报错

## DSH 自己的 MCP：开关 + 市场（2026-10-27 加）

- 开关不是改原条目，而是往 profile 的 `cordis.patch.yml` **末尾**写一条只带 `id` + `disabled` 的覆盖项
  （和文件里已有的 `- id: webchat / disabled: true` 同一个机制，已验证 `--dump-config` 会合并成 `disabled: true`）。
- 市场加进来的条目自己也放在末尾的托管段里：

  ```
  # >>> agentbase:managed 本段由 AgentBase 面板生成，手改会在下次操作时被覆盖
  - insert:
      - id: mcp-market-<name>
        name: '@deepseek-ai/dsh-mcp-client'
        config: {...}
  - id: mcp-github
    disabled: true
  # <<< agentbase:managed
  ```

  段落在每次写操作时整段重建（状态存在 `E:\DshData\.dsh\agentbase\dsh-mcp-managed.json`），
  空的托管段会自动删掉，不会在文件里留垃圾。
- 每次改写前备份 `cordis.patch.yml.bak-agentbase-<时间戳>`。
- 市场的候选来自 wb 的 `mcp.json` / 插件 `.mcp.json`、cb 的 `mcp.json`、zc 的 `config.json`。
  **只有 stdio 型能搬**；命令里带 `${...}` 占位符的（browser、weixinpay）不搬，因为 DSH 里没有那个变量。
- 改完都要重启 DSH 才生效（没有 HMR）。
