import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = resolve(root, "assets/flows");
const sourceDir = resolve(root, "diagram-sources");

const diagrams = [
  {
    id: "agentroam",
    title: "AgentRoam 多端 Agent 工作流",
    scope: "统一会话与运行时适配，让桌面、浏览器和手机接续同一项任务",
    lanes: ["访问端", "会话与授权", "Agent 运行时", "工作区能力", "结果与恢复", "安全边界"],
    nodes: [
      ["client", 0, 0, "Desktop / Web / Mobile", "选择会话并提交任务", "ui"],
      ["pair", 1, 1, "配对与会话路由", "设备授权可撤销", "primary"],
      ["adapter", 2, 2, "Runtime Adapter", "适配不同 Agent 协议", "agent"],
      ["loop", 2, 3, "Agent Loop", "思考、调用、观察、续跑", "agent"],
      ["workspace", 3, 3, "终端与文件工作区", "工具按权限执行", "business"],
      ["events", 4, 4, "事件流与状态快照", "多端持续查看与接续", "success"],
      ["deny", 5, 2, "拒绝或降级", "未授权、离线、能力不可用", "failure"],
    ],
    edges: [
      ["client", "pair", "任务 / 会话"], ["pair", "adapter", "已授权"],
      ["adapter", "loop", "统一运行接口", "agent"], ["loop", "workspace", "受控工具调用", "agent"],
      ["workspace", "events", "结果与变更", "success"], ["loop", "events", "流式事件", "success"],
      ["pair", "deny", "授权失败", "failure"], ["adapter", "deny", "运行时不可用", "failure"],
    ],
    footer: "端到端不变量：设备授权、会话身份、工具权限和运行事件均可独立追踪与撤销。",
  },
  {
    id: "knowledge-base",
    title: "个人知识库构建与使用闭环",
    scope: "把不可变证据编译为可追溯知识，并在每次任务后持续更新",
    lanes: ["原始证据", "提炼编译", "知识结构", "检索使用", "任务闭环", "信任边界"],
    nodes: [
      ["raw", 0, 0, "文档 / 代码 / 会话", "原始来源保持不变", "business"],
      ["stage", 1, 1, "暂存与分类", "识别项目和知识类型", "primary"],
      ["compile", 1, 2, "知识提炼", "事实、推断、不确定分开", "agent"],
      ["wiki", 2, 3, "Wiki 页面与关系图", "来源、置信度、生命周期", "success"],
      ["index", 2, 4, "索引与语义检索", "摘要优先、按需读正文", "primary"],
      ["query", 3, 4, "任务前查询", "最小范围取回上下文", "ui"],
      ["verify", 4, 3, "当前证据核验", "以代码和运行结果纠偏", "business"],
      ["update", 4, 4, "任务后写回", "新增结论、修复冲突与过期", "success"],
      ["guard", 5, 2, "公开 / 内部隔离", "查询范围显式受限", "failure"],
    ],
    edges: [
      ["raw", "stage", "来源"], ["stage", "compile", "分类后提炼", "agent"],
      ["compile", "wiki", "结构化页面", "success"], ["wiki", "index", "索引 / 关系", "success"],
      ["index", "query", "最小命中"], ["query", "verify", "候选结论"],
      ["verify", "update", "验证结果", "success"], ["guard", "compile", "范围约束", "failure"],
    ],
    footer: "知识源不变量：原始资料是证据，Wiki 是编译结果；项目 docs 与历史经验各有唯一权威入口。",
  },
  {
    id: "smart-refund",
    title: "智能赔付 / 小 WOW 核心流程",
    scope: "公开抽象视图：模型负责理解与建议，确定性业务约束负责准入与执行",
    lanes: ["客服入口", "会话理解", "方案约束", "业务处理", "结果回写", "安全与审计"],
    nodes: [
      ["conversation", 0, 0, "用户会话与订单上下文", "形成一次处理请求", "ui"],
      ["extract", 1, 1, "摘要与关键事实", "提取诉求、场景和缺失项", "agent"],
      ["classify", 1, 2, "分类与候选方案", "输出可解释建议", "agent"],
      ["constraint", 2, 3, "规则与额度约束", "拒绝越权和不完整方案", "business"],
      ["entry", 3, 3, "录入与审核", "人工确认后进入业务流程", "primary"],
      ["payment", 3, 4, "执行与状态流转", "按确定性流程处理", "business"],
      ["callback", 4, 4, "结果回写", "状态、结果与异常可见", "success"],
      ["manual", 5, 2, "补充信息 / 人工接管", "低置信度或校验失败", "failure"],
      ["audit", 5, 4, "审计轨迹", "输入、建议、确认和结果留痕", "success"],
    ],
    edges: [
      ["conversation", "extract", "公开上下文"], ["extract", "classify", "结构化事实", "agent"],
      ["classify", "constraint", "候选方案", "agent"], ["constraint", "entry", "校验通过"],
      ["entry", "payment", "审核后执行"], ["payment", "callback", "处理结果", "success"],
      ["constraint", "manual", "缺失 / 冲突", "failure"], ["callback", "audit", "状态归档", "success"],
    ],
    footer: "公开边界：不展示生产数据、内部规则、地址或截图；模型输出不能绕过业务校验和人工确认。",
  },
  {
    id: "agent-swarms",
    title: "Agent Swarms 研发质量流水线",
    scope: "并行发现风险、独立验证证据，再以测试与报告形成可追踪结论",
    lanes: ["变更入口", "并行审查", "证据核验", "独立测试", "报告与状态", "恢复边界"],
    nodes: [
      ["change", 0, 0, "代码变更与任务范围", "确定审查目标", "ui"],
      ["detectors", 1, 1, "并行 Detectors", "从多个角度发现候选问题", "agent"],
      ["merge", 1, 2, "问题归并", "去重并保留来源", "primary"],
      ["verify", 2, 3, "Verifier", "核对代码、证据与严重级别", "agent"],
      ["findings", 2, 4, "可信 Findings", "仅保留成立的问题", "success"],
      ["infqa", 3, 3, "InfQA 执行", "独立运行测试与场景验证", "business"],
      ["report", 4, 4, "活动流与报告", "记录轮次、状态和结果", "success"],
      ["recover", 5, 2, "中断识别与恢复", "区分失败、停止与可续跑", "failure"],
    ],
    edges: [
      ["change", "detectors", "变更快照"], ["detectors", "merge", "候选问题", "agent"],
      ["merge", "verify", "去重结果", "agent"], ["verify", "findings", "证据成立", "success"],
      ["verify", "infqa", "验证需求"], ["infqa", "report", "测试证据", "success"],
      ["findings", "report", "审查结论", "success"], ["recover", "verify", "恢复点", "failure"],
    ],
    footer: "质量不变量：发现、核验和测试各自保留状态；报告只声明真实完成且有证据的结果。",
  },
  {
    id: "quality-platform",
    title: "质量平台与自动化报告流程",
    scope: "把代码、测试和发布信号归一成可回溯的质量事实与周期报告",
    lanes: ["信号来源", "数据归一", "自动化执行", "质量事实", "报告与通知", "口径与审计"],
    nodes: [
      ["signals", 0, 0, "代码 / 测试 / 发布信号", "带来源和时间范围", "ui"],
      ["normalize", 1, 1, "采集与口径归一", "统一项目、状态与时间", "primary"],
      ["plans", 2, 2, "自动化计划", "触发测试并跟踪运行", "business"],
      ["results", 3, 3, "质量事实仓", "保留原始结果与聚合维度", "success"],
      ["report", 4, 4, "周报 / 专项报告", "按范围生成可解释结论", "success"],
      ["notify", 4, 3, "受控通知", "预览、测试发送、正式发布", "ui"],
      ["missing", 5, 2, "缺失或冲突数据", "标记缺口而非补造", "failure"],
      ["audit", 5, 4, "来源与统计口径", "可重跑、可对账", "success"],
    ],
    edges: [
      ["signals", "normalize", "原始信号"], ["normalize", "plans", "触发条件"],
      ["plans", "results", "运行结果", "success"], ["results", "report", "聚合事实", "success"],
      ["report", "notify", "审核后发送"], ["normalize", "missing", "缺失 / 冲突", "failure"],
      ["report", "audit", "范围与口径", "success"],
    ],
    footer: "报告不变量：每个数字都能回到时间范围、数据源和统计口径；正式发送必须与预览分离。",
  },
  {
    id: "customer-service",
    title: "客服与工单系统核心流程",
    scope: "公开抽象视图：上下文驱动分类与分配，处理结果进入质量改进闭环",
    lanes: ["任务入口", "上下文与分类", "资源路由", "工单处理", "质量闭环", "异常边界"],
    nodes: [
      ["ticket", 0, 0, "会话 / 工单创建", "形成待处理任务", "ui"],
      ["context", 1, 1, "上下文补全", "聚合必要业务信息", "agent"],
      ["classify", 1, 2, "分类与优先级", "生成可解释标签", "agent"],
      ["route", 2, 3, "资源与技能路由", "按权限和能力选择处理方", "business"],
      ["assign", 2, 4, "分配与队列", "记录归属和状态", "primary"],
      ["process", 3, 4, "处理与协作", "过程记录保持连续", "business"],
      ["quality", 4, 3, "质检与样本", "检查结果并形成反馈", "success"],
      ["improve", 4, 4, "规则 / 知识改进", "把有效经验写回", "success"],
      ["escalate", 5, 2, "补充信息 / 升级处理", "低置信度、超时或越权", "failure"],
    ],
    edges: [
      ["ticket", "context", "任务上下文"], ["context", "classify", "结构化信息", "agent"],
      ["classify", "route", "标签与优先级", "agent"], ["route", "assign", "可用资源"],
      ["assign", "process", "任务交接"], ["process", "quality", "处理记录", "success"],
      ["quality", "improve", "质量反馈", "success"], ["route", "escalate", "无可用路径", "failure"],
    ],
    footer: "处理不变量：任务上下文、分配依据、处理过程与质检结果形成一条可追踪链路。",
  },
];

const palette = {
  primary: ["#175CD3", "#EDF4FF"], business: ["#E04F16", "#FFF4ED"],
  agent: ["#6938EF", "#F4F0FF"], success: ["#079455", "#ECFDF3"],
  failure: ["#E11D48", "#FFF1F3"], ui: ["#087E8B", "#ECFDFF"],
};

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);

function svgFor(diagram) {
  const width = 2000;
  const height = 1360;
  const header = 170;
  const laneHeight = 180;
  const nodeWidth = 250;
  const nodeHeight = 104;
  const xForStage = (stage) => 220 + stage * 320;
  const yForLane = (lane) => header + lane * laneHeight + 40;
  const nodes = new Map(diagram.nodes.map(([id, lane, stage, title, detail, kind]) => [id, {
    id, lane, stage, title, detail, kind, x: xForStage(stage), y: yForLane(lane),
  }]));
  const laneMarkup = diagram.lanes.map((lane, index) => {
    const y = header + index * laneHeight;
    return `<g class="lane"><rect x="24" y="${y}" width="1952" height="${laneHeight}" />
      <rect class="lane-label-bg" x="24" y="${y}" width="170" height="${laneHeight}" />
      <text class="lane-label" x="109" y="${y + 94}" text-anchor="middle">${escapeXml(lane)}</text></g>`;
  }).join("\n");
  const edgeMarkup = diagram.edges.map(([fromId, toId, label, edgeKind = "primary"]) => {
    const from = nodes.get(fromId);
    const to = nodes.get(toId);
    const startX = from.x + nodeWidth;
    const startY = from.y + nodeHeight / 2;
    const endX = to.x;
    const endY = to.y + nodeHeight / 2;
    const midX = Math.round((startX + endX) / 2);
    const marker = edgeKind === "failure" ? "arrow-red" : edgeKind === "success" ? "arrow-green" : edgeKind === "agent" ? "arrow-violet" : "arrow";
    const css = edgeKind === "failure" ? "edge failure" : `edge ${edgeKind}`;
    return `<g><path class="${css}" d="M ${startX} ${startY} H ${midX} V ${endY} H ${endX}" marker-end="url(#${marker})" />
      <text class="edge-label" x="${midX}" y="${Math.min(startY, endY) + Math.abs(endY - startY) / 2 - 8}" text-anchor="middle">${escapeXml(label)}</text></g>`;
  }).join("\n");
  const nodeMarkup = [...nodes.values()].map((node) => {
    const [border, background] = palette[node.kind] || palette.primary;
    const detailLines = node.detail.length > 18 ? [node.detail.slice(0, 18), node.detail.slice(18)] : [node.detail];
    return `<g class="node" role="group" aria-label="${escapeXml(node.title)}">
      <rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="10" style="fill:${background};stroke:${border}" />
      <text class="node-title" x="${node.x + 18}" y="${node.y + 34}">${escapeXml(node.title)}</text>
      <text class="node-detail" x="${node.x + 18}" y="${node.y + 64}">${detailLines.map((line, index) => `<tspan x="${node.x + 18}" dy="${index ? 22 : 0}">${escapeXml(line)}</tspan>`).join("")}</text>
    </g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(diagram.title)}</title><desc id="desc">${escapeXml(diagram.scope)}</desc>
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#101828" flood-opacity=".08" /></filter>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#2F3C52" /></marker>
    <marker id="arrow-violet" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#6938EF" /></marker>
    <marker id="arrow-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#079455" /></marker>
    <marker id="arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#E11D48" /></marker>
  </defs>
  <style>
    text{font-family:Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif;letter-spacing:0;fill:#182230}
    .surface{fill:#fff;stroke:#B2CCFF;stroke-width:2}.title{font-size:31px;font-weight:700}.scope{font-size:17px;fill:#667085}
    .lane>rect{fill:#fff;stroke:#DCE6F2;stroke-width:1}.lane:nth-child(even)>rect:first-child{fill:#F9FBFD}.lane .lane-label-bg{fill:#F2F6FB}
    .lane-label{font-size:20px;font-weight:700;fill:#344054}.node rect{stroke-width:2;filter:url(#shadow)}
    .node-title{font-size:19px;font-weight:700}.node-detail{font-size:15px;fill:#475467}.edge{fill:none;stroke:#2F3C52;stroke-width:3}.edge.agent{stroke:#6938EF}.edge.success{stroke:#079455}.edge.failure{stroke:#E11D48;stroke-dasharray:8 6}
    .edge-label{font-size:14px;font-weight:600;fill:#475467;paint-order:stroke;stroke:#fff;stroke-width:7px;stroke-linejoin:round}
    .legend{font-size:14px;fill:#475467}.footer{fill:#F8FAFC;stroke:#D0D5DD}.footer-text{font-size:17px;font-weight:600;fill:#344054}
  </style>
  <rect class="surface" x="12" y="12" width="1976" height="1336" rx="18" />
  <text class="title" x="1000" y="58" text-anchor="middle">${escapeXml(diagram.title)}</text>
  <text class="scope" x="1000" y="91" text-anchor="middle">${escapeXml(diagram.scope)}</text>
  <g class="legend" transform="translate(1190 116)"><circle cx="0" cy="0" r="7" fill="#175CD3"/><text x="14" y="5">主流程</text><circle cx="104" cy="0" r="7" fill="#6938EF"/><text x="118" y="5">Agent</text><circle cx="210" cy="0" r="7" fill="#079455"/><text x="224" y="5">结果</text><circle cx="306" cy="0" r="7" fill="#E11D48"/><text x="320" y="5">失败 / 边界</text></g>
  ${laneMarkup}
  ${edgeMarkup}
  ${nodeMarkup}
  <g><rect class="footer" x="45" y="1270" width="1910" height="54" rx="8"/><text class="footer-text" x="1000" y="1304" text-anchor="middle">${escapeXml(diagram.footer)}</text></g>
</svg>`;
}

function htmlFor(diagram, svg) {
  const encoded = JSON.stringify(svg);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(diagram.title)}</title><style>html,body{margin:0;background:#F4F7FB;font-family:Inter,"PingFang SC",Arial,sans-serif}main{width:min(2000px,100vw);margin:0 auto;padding:16px;box-sizing:border-box}svg{display:block;width:100%;height:auto;background:white}nav{display:flex;gap:8px;justify-content:flex-end;margin:0 0 10px}button{border:1px solid #98A2B3;background:#fff;color:#344054;padding:8px 12px;border-radius:6px;cursor:pointer}@media print{nav{display:none}main{padding:0}}</style></head><body><main><nav><button id="save">Download SVG</button><button onclick="print()">Print / PDF</button></nav>${svg}</main><script>const source=${encoded};document.getElementById("save").onclick=()=>{const blob=new Blob([source],{type:"image/svg+xml"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=${JSON.stringify(`${diagram.id}.svg`)};a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};</script></body></html>`;
}

await mkdir(assetDir, { recursive: true });
await mkdir(sourceDir, { recursive: true });
for (const diagram of diagrams) {
  const svg = svgFor(diagram);
  await writeFile(resolve(assetDir, `${diagram.id}.svg`), svg, "utf8");
  await writeFile(resolve(sourceDir, `${diagram.id}.html`), htmlFor(diagram, svg), "utf8");
}

console.log(`Generated ${diagrams.length} flow diagrams in ${assetDir}`);
