# Plan: StatusLine Credits Display for AI Video Platform Plugin

## Goal

在我们的 AI 视频生成平台的 Claude Code 插件中，通过 statusLine 实时展示用户账户剩余 Credits，余额不足时引导用户通过 slash command 充值。

## Architecture

```
Claude Code (每~300ms调用)
  │
  │ stdin JSON (model, context, cwd...)
  ▼
statusLine 脚本
  │
  ├─ 读取本地缓存文件 ~/.myplatform/credits-cache.json
  │   ├─ 缓存未过期 → 直接用
  │   └─ 缓存过期(>30s) → 调用平台 API 刷新
  │
  ├─ 渲染 credits 显示（带颜色分级）
  │
  └─ stdout → Claude Code 显示
```

## Key Design Decisions

### 1. Credits 数据获取策略

statusLine 每 300ms 被调用一次，**绝不能每次都请求 API**。两种互补策略：

**策略 A：本地缓存文件 + TTL**
- statusLine 脚本读取 `~/.myplatform/credits-cache.json`
- 文件格式：`{ "credits": 1250, "plan": "Pro", "updated_at": 1711000000 }`
- TTL 30-60 秒，过期则异步刷新（当次仍用旧值，不阻塞渲染）

**策略 B：Skill 执行后主动写入（推荐配合使用）**
- 每次用户通过 skill 调用平台 API 生成视频后，skill 内部顺便把最新余额写入缓存文件
- 这样 statusLine 读到的数据几乎实时，且零网络开销

### 2. 显示分级

| Credits | 颜色 | 显示内容 |
|---------|------|----------|
| >100 | 绿色 | `🎬 Credits: 1,250` |
| 10-100 | 黄色 | `⚠️ Credits: 45 — running low` |
| <10 | 红色 | `🔴 Credits: 3 — /myplatform:recharge` |
| 0 | 红色 | `❌ No credits — /myplatform:recharge` |
| 未登录/无缓存 | 灰色 | `🎬 Not logged in — /myplatform:login` |

### 3. Slash Commands 需要配套开发

| Command | 功能 |
|---------|------|
| `/myplatform:credits` | 查看详细余额、用量历史 |
| `/myplatform:recharge` | 展示套餐选项 + 输出充值链接 |
| `/myplatform:login` | 引导用户登录/绑定 API Key |

### 4. StatusLine 冲突问题

Claude Code 只支持一个 statusLine 命令。如果用户同时装了 claude-hud：

- **方案 1**：你的脚本内部 spawn claude-hud，合并输出（推荐）
- **方案 2**：不用 statusLine，只在 skill 输出中显示余额
- **方案 3**：用 claude-hud 的 `extraCmd` 参数，把你的 credits 查询作为额外命令注入

## Implementation Steps

### Step 1: Credits 缓存模块
- 创建 `src/credits-cache.ts`
- 读写 `~/.myplatform/credits-cache.json`
- 支持 TTL 检查、异步刷新

### Step 2: Credits 渲染模块
- 创建 `src/render/credits-line.ts`
- 实现颜色分级逻辑
- 输出带 ANSI 颜色的文本行

### Step 3: 集成到 statusLine 入口
- 在 `src/index.ts` 的 main() 中加入 credits 数据获取
- 在 render 流程中插入 credits 行

### Step 4: Slash Commands
- `/myplatform:recharge` — 输出充值链接
- `/myplatform:credits` — 查看详细信息
- 注册到 `.claude-plugin/plugin.json` 的 commands 中

### Step 5: Skill 内写入缓存
- 在视频生成 skill 的 API 调用逻辑中，响应返回后把余额写入缓存文件
- 确保 statusLine 下次读取时能拿到最新值

## Reference: claude-hud 的关键实现模式

参考这个项目的做法：
- `src/stdin.ts` — 如何从 stdin 读取 Claude Code 传入的 JSON
- `src/render/colors.ts` — ANSI 颜色工具函数
- `src/render/index.ts` — 如何组织多行输出
- `src/config.ts` — 用户配置加载
- `.claude-plugin/plugin.json` — 插件清单格式

## Limitations

- statusLine 是纯展示，无点击/交互能力
- 只能通过文本引导用户输入 slash command 来"模拟交互"
- 每个 Claude Code 实例只能有一个 statusLine 命令
