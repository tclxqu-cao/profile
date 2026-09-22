# Caoqu — 个人主页

仿 Apple 设计风格的个人网站：整屏终端首屏、苹果系统配色与字体栈、跃迁式跳转。
纯静态三件套（`index.html` + `style.css` + `main.js`），零依赖、无构建、无后端。

## 终端首屏

首屏就是**一整台终端**，没有导航条（`.hero` 固定 `height:100svh`，`.term-full` 铺满它）：

- 标题栏是终端自己的 `.term-bar`：红绿灯三个点靠左排，右边 `caoqu@local — zsh — portfolio`。全站没有 `<nav>`，去别的区块靠往下滚、或终端里输命令。
- `.term-body` 自己 `overflow-y:auto`，但**故意不加** `overscroll-behavior: contain`：终端滚到底就该把滚动交给页面，一个占满首屏的嵌套滚动区最怕的就是滚不出去。同理这里不用 `min-height`——内容一多首屏就会被撑成两屏，变成一个往下滚不动的坑。
- 屏内分两块：`.t-motd` 是开场一次性敲出来的门牌（`flex:none`，永远不会被顶出屏幕），`#term-out` 是自动演示与用户输出的滚动区。
- 命令的输出**全部现从页面 DOM 里读**——`works` 读首屏那行 `ls works/` 的链接、`skills` 读 `#skills .card h3`、`stats` 读 `.stat`、`timeline` 读 `.t-row`。改了文案或数字，终端不会反过来讲一套假话。
  例外是 `stats`：它读 `.stat-num[data-target]` 而不是文本，因为页面上那些数字要滚到那一屏才开始往上滚，读文本会在首屏报出一串 `0`。
- 支持 `help / whoami / ls / works / open <名字> / skills / timeline / stats / contact / date / clear`，↑↓ 翻历史、Tab 补全、Ctrl-L 清屏；`open` 的别名同时接受 `flow-studio`、`flow`、`Flow Studio`。
- 用户输入一律走 `textContent` 建节点，不拼 HTML 字符串。
- `<head>` 里一行内联脚本给 `<html>` 加 `.js`；没有 JS 时输入行和建议词整块隐藏，只留静态欢迎语。
- `<input>` 没有自适应宽度：用一个 `visibility:hidden` 的 span 量当前文本再写回 `width`，空着时量 placeholder，否则提示语会被切掉半个汉字。
- 开机动画：终端进视口后把欢迎语逐字敲出来，绿色方块光标跟着字符前进，输出整行依次打印，最后才亮出输入行和建议词（约 2.3s）。隐藏只改 `visibility` / `opacity`，布局从第一帧起就是终态，所以打字时下方内容不会上下跳；命令行的提示符也一起等轮到自己，否则屏上会先挂着两个后面空着的 `caoqu@local:~$`。按任意键、点终端、切到后台标签页都会立刻补完到终态（后台 `setTimeout` 被限流到 1s，不该剩半屏没打完）；`prefers-reduced-motion` 整段跳过，JS 没跑则由 `.t-wait` 根本不挂载来兜底，另有一个 8s 强制完成定时器。
- 开机动画放完后进入**自动演示循环**：自己敲 `whoami` → `ls works/` → `stats` → `skills` → `clear`，无限循环。演示期间光标常亮绿色（`.is-demo`），一眼看得出不是人在打；`aria-live` 同时关掉，否则读屏会被无限念的命令淹掉。真实按键或点击终端即交还控制权（`demoStop()` 清掉输入框、恢复 `aria-live: polite`）。滚出视口或标签页切后台时挂起，回来接着上一步，不会留半截命令在屏上。循环里**故意不放** `open` / `works` 这类会跳路的命令——无人值守时不该动页面滚动位置。

## 跃迁转场

点首屏 `ls works/` 里的项目名（以及终端输出里 clone 出来的同名链接），会先播一段 3D 超空间跃迁再落到那一行作品：

- `warpTo()` 造一层全屏 `canvas.warp`，粒子是 `{x, y, z, color}` 三维坐标，用 `sx = cx + x/z * fl` 透视投影，所以是真实的纵深而不是画斜线。越近的粒子越粗越亮，分两层描边（宽而淡的当辉光、窄而亮的当核心），叠加 `globalCompositeOperation = "lighter"`。
- 拖尾靠每帧盖一层 `rgba(9,9,18,.3)` 半透明底色自然叠出来，比逐条记录尾迹省得多。相机随进度 `rotate` 轻微翻滚，落点用 `scrollIntoView` 在跃迁尾段一次性对齐。
- **灭点画在 DOM 层**（`.warp-core`）而不是 canvas 里：canvas 每帧只叠 30% 底色，画在里面的光晕会被几十帧累加成一团糊住半屏的灰雾。这层压在 canvas 之上（canvas 底是不透明的，压在它后面等于没有）、用 `mix-blend-mode: screen` 加光，尺寸写死在 `vmin` 里所以始终是一个「点」。
- 只有作品行配得上这段跃迁：跳到轨迹 / 联系走普通 `scrollIntoView`。`prefers-reduced-motion` 下整段跳过，CSS 里 `.warp, .warp-core { display:none }` 兜住。

## 3D 部分

- 卡片 3D 倾斜：`main.js` 检测 `(hover: hover) and (pointer: fine)` 后给 `<html>` 加 `.tilt-on`，指针驱动 `perspective + rotateX/rotateY` 与跟随高光；触屏与降级偏好下不启用。
- 首屏那颗手写 WebGL 的极光球已经拿掉了（连同 `webgl.js`）。终端底色改用两层静态极光 `radial-gradient` 余晖，免得整屏变成一块死黑，同时不引入任何持续运行的动画。

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
