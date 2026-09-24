# Caoqu Portfolio Runtime

一屏终端式个人主页。公开内容不维护在 HTML 模板里，而由 Customer Agent 的
`portfolio-*` Skills 通过 AIHub 生成，再由 Flow Studio 的 `homepage-main`
固定分支返回统一 artifact。

## Runtime Flow

```text
Browser :8801
  -> POST /api/command
  -> Flow Studio :8788 /api/homepage/command
  -> homepage-main fixed branch
  -> Portfolio Content Agent
  -> Customer Agent :3000 /api/portfolio/skills/run
  -> AIHub + public_wiki_query
  -> text | image | video | sanitized HTML artifact
```

浏览器从不持有服务端令牌，也不能指定 Flow ID、Agent 或工具。`/api/command`
只把 `message` 和当前页面内存中的随机 `sessionId` 转发到固定主页入口。Flow Studio 和 Customer Agent 使用独立共享
令牌；Customer Agent 只允许 `portfolio-*` Skills 和公开 Wiki 查询工具。

## Commands

公开命令只有：

- `/help`
- `/whoami`
- `/works`
- `/jobs`，兼容别名 `/job`
- `/timeline`
- `/contact`
- `/project <project-id>`

已知 Slash 命令可以继续附带自然语言要求，例如 `/jobs 生成一个表格吧`。
命令首段选择固定 Skill，完整输入作为 `message` 传给该 Skill；未知命令仍进入帮助分支。

`skills` 只是悬浮、聚焦或点击展开的菜单，里面只有 `/works` 和 `/jobs`，不是
可执行命令。输入 `/` 会打开完整 Slash 面板。显式 Slash 命令直达
`homepage-main` 的固定分支，浏览器严格校验对应 Skill；自然语言由 Customer Agent
识别意图并选择合法的 `portfolio-*` Artifact，浏览器不再二次预判具体分支。

## Artifacts

每个 Skill 返回 `schemaVersion: 1`，支持四种 block：

- `text`
- `image`
- `video`
- `html`

HTML 在 Customer Agent 服务端清洗，浏览器再用 `DOMParser` 白名单重建节点；
不直接写入模型返回的 `innerHTML`。媒体地址只允许安全的 HTTPS URL 或
`assets/` 相对路径。`site-config.js` 的 `assetBaseUrl` 可切到 Vercel 静态资源域名。

## Media Mapping

`media-map.js` 按项目保存静态媒体部署映射：

- Flow Studio、Meitu Web：视频优先，图片作为 poster。
- Vibe Works、Kid Earth：图片。
- AgentRoam、Knowledge Base、Smart Refund / Small WOW、Agent Swarms、
  Quality Platform、Customer Service：抽象流程图。

内部系统不放截图、生产数据、内部域名或人员信息。运行时 artifact 已带媒体时以
artifact 为准；缺少媒体时才使用项目映射。

## Fallback

Flow Studio 优先返回 `data/homepage_artifacts/` 中同 Skill 的最后成功结果；只有缓存
缺失或持有主页服务凭据的受控调用显式传入 `refresh=true` 时，才会执行 Customer
Agent + AIHub。公开 `/api/command` 只转发 `message` 与页面会话标识，访客不能要求刷新。
同一页面内的连续请求复用一个 Customer Agent 会话；页面刷新后脚本会生成新的标识，开始新会话。标识不写入 localStorage 或 sessionStorage。

每次成功结果都会原子写入缓存。导出静态快照：

```sh
cd /Users/caoqu/agent-free
.venv/bin/python scripts/export_portfolio.py
```

脚本校验所有 artifact 后原子生成本目录的 `content-snapshot.js`。Flow 或 AIHub
不可达时，前端只展示对应 Skill 的最后成功快照；没有快照时显示明确的 unavailable
结果，不恢复手写业务内容。

## Local Runtime

Customer Agent 使用 `:3000` 的 production build。Flow Studio 和主页保持固定端口：

```sh
cd /Users/caoqu/agent-free
PORTFOLIO_SKILL_TOKEN='<shared token>' \
  .venv/bin/python scripts/preview_homepage.py \
  --portfolio-dir /Users/caoqu/.zcode/workspace/default/portfolio \
  --data-dir data --flow-port 8788 --port 8801
```

Flow Studio 与主页都监听 `0.0.0.0`，本机分别访问
`http://127.0.0.1:8788/` 和 `http://127.0.0.1:8801/`。主页代理自动获得本次启动
生成的 `FLOW_HOMEPAGE_TOKEN`，浏览器仍然无需登录。

## Tests

```sh
cd /Users/caoqu/team-agent/customer-agent
/Users/caoqu/.bun/bin/bun x vitest run \
  packages/server/lib/portfolio-artifact.test.ts \
  packages/server/lib/portfolio-skill-runner.test.ts

cd /Users/caoqu/agent-free
.venv/bin/pytest -q tests/test_homepage_flow.py tests/test_flow_platform.py

cd /Users/caoqu/.zcode/workspace/default/portfolio
node --test tests/*.test.js
```

Vercel 部署时设置 `HOMEPAGE_FLOW_URL` 和 `FLOW_HOMEPAGE_TOKEN`。前者必须是
HTTPS；本地开发仅允许 loopback HTTP。
