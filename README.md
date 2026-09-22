# Caoqu — 个人主页

仿 Apple 设计风格的个人网站：毛玻璃导航、可敲命令的终端 Hero、苹果系统配色与字体栈。
纯静态四件套（`index.html` + `style.css` + `main.js` + `webgl.js`），零依赖、无构建、无后端。

## 终端首屏

Hero 是一个能真的敲命令的假终端（`main.js` 末段）：

- 命令的输出**全部现从页面 DOM 里读**——`works` 读首屏那行 `ls works/` 的链接、`skills` 读 `#skills .card h3`、`stats` 读 `.stat`、`timeline` 读 `.t-row`。改了文案或数字，终端不会反过来讲一套假话。
- 支持 `help / whoami / ls / works / open <名字> / skills / timeline / stats / contact / date / clear`，↑↓ 翻历史、Tab 补全、Ctrl-L 清屏；`open` 的别名同时接受 `flow-studio`、`flow`、`Flow Studio`。
- 用户输入一律走 `textContent` 建节点，不拼 HTML 字符串。
- `<head>` 里一行内联脚本给 `<html>` 加 `.js`；没有 JS 时输入行和建议词整块隐藏，只留静态欢迎语。
- `<input>` 没有自适应宽度：用一个 `visibility:hidden` 的 span 量当前文本再写回 `width`，空着时量 placeholder，否则提示语会被切掉半个汉字。
- 开机动画：终端进视口后把欢迎语逐字敲出来，绿色方块光标跟着字符前进，输出整行依次打印，最后才亮出输入行和建议词（约 2.3s）。隐藏只改 `visibility` / `opacity`，布局从第一帧起就是终态，所以打字时下方内容不会上下跳；命令行的提示符也一起等轮到自己，否则屏上会先挂着两个后面空着的 `caoqu@local:~$`。按任意键、点终端、切到后台标签页都会立刻补完到终态（后台 `setTimeout` 被限流到 1s，不该剩半屏没打完）；`prefers-reduced-motion` 整段跳过，JS 没跑则由 `.t-wait` 根本不挂载来兜底，另有一个 8s 强制完成定时器。打字期间把 `aria-live` 关掉，免得读屏念出半截命令。

## 3D 部分

- `webgl.js`：Hero 的液态金属球，手写 WebGL 1 光线步进（SDF + smooth-union 元球），无任何库与环境贴图，色相由菲涅尔驱动极光调色板。
  渐进增强：拿不到 WebGL 上下文或编译失败时静默退出，保留原来的 CSS 模糊光斑。
  自适应：分辨率缩放 + 掉帧降采样，离屏/后台暂停，`prefers-reduced-motion` 只渲染一帧静态图。
- 卡片 3D 倾斜：`main.js` 检测 `(hover: hover) and (pointer: fine)` 后给 `<html>` 加 `.tilt-on`，指针驱动 `perspective + rotateX/rotateY` 与跟随高光；触屏与降级偏好下不启用。

## 作品区

`assets/` 是真实运行截图与录屏，不是设计稿：

- 截图用 Playwright 起本地服务后 `full_page` 抓取，再裁成 16:10（竖屏项目保留 760×1590）转 progressive JPEG。
- 录屏用 Playwright `record_video_dir` 出 webm，`ffmpeg -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart -an` 转 mp4，并剪掉开头没有内容的几秒。
- 画面滚到视口 55% 时由 `IntersectionObserver` 自动播放（触屏没有 hover），离开即暂停；`preload="none"` 保证首屏不下载视频。
- Ken Burns 呼吸缩放与滚动视差都走独立属性：`transform` 给动画、`translate` 给视差，互不覆盖。降级偏好下两者都关。
- 绝对定位的 `<img>` / `<video>` 若不给显式宽高会退回固有尺寸，`object-fit` 就失效——框内裁切看起来正常，其实是左上角溢出裁掉的。
- 页面上每个数字旁边都写了量它的命令（`.work-run`，如 `pytest --collect-only -q` → 223）。数字会过期，命令不会——改数之前先把命令重跑一遍。

## 本地预览

直接双击 `index.html`，或起个静态服务：

```sh
python3 -m http.server 8000   # 打开 http://localhost:8000
```

## 免费托管（Vercel / Netlify / GitHub Pages）

纯静态站，任何静态托管平台都能免费部署：

- **Vercel**：在本目录执行 `npx vercel deploy --prod --yes --scope agent-caa8`（不带 `--scope` 会报 `Not authorized`，那是组织作用域问题不是令牌过期），或推到 GitHub 后在 vercel.com/new 导入，零配置。生产别名 `https://portfolio-ten-theta-3eifgugd4s.vercel.app`，始终指向最新一次 production 部署；每次部署另有一个带随机 hash 的独立地址，会变。
- **Netlify**：`npx netlify deploy --prod --dir .`
- **GitHub Pages**：推仓库后 Settings → Pages 选分支根目录。

无构建步骤、无环境变量。
