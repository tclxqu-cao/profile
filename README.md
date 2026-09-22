# Caoqu — 个人主页

**整站就是一屏终端。** 页面本身不滚动，没有导航、没有长页、没有区块锚点：想看点什么，就在终端里敲命令或者点建议词，内容直接打进这块屏。仿 Apple 系统配色与等宽字体栈，纯静态三件套（`index.html` + `style.css` + `main.js`），零依赖、无构建、无后端。

## 一屏终端的结构

`.term` 是一个 `height:100svh` 的 flex 列，三段：

- **`.term-bar`（42px）**：左边红绿灯三个点，中间 `caoqu@local — zsh — portfolio`，右边 `HH:MM:SS UTC±N · up 6s`。
- **`.term-scroll#term-scroll`（`flex:1;min-height:0;overflow-y:auto`）**：唯一的滚动区，里面是 `.t-motd` 门牌 + `#term-out` 命令输出。
- **`.term-foot`**：输入行和建议词，钉在底部不跟着内容滚。

几个刻意的选择：

- `body{overflow:hidden}`——一屏之后没有东西可滚，留着滚动条只会让人以为下面还有内容。
- `.term-scroll` **要加** `overscroll-behavior:contain`。这条和老版（终端只占首屏、下面还有长页）正好反了：那时滚到底必须把滚动交还给页面，否则变成一个滚不出去的坑；现在外层根本没有可交给的滚动容器，contain 只是防止 rubber-band 传到 `<body>` 上把整屏抖一下。
- `.term-foot` 用了 `backdrop-filter`，于是它成了后代元素的**包含块**——灯箱和跃迁层这类要盖全屏的浮层必须挂到 `document.body`，挂在 `.term` 里会被 footer 圈住。
- 红绿灯是真功能不是装饰：红 = 清屏，黄 = 收起输出只留输入行（`.term.is-min`），绿 = 展开并滚到底。`(hover: hover)` 下悬停才显出 `× − ＋`（`content: attr(data-glyph)`），触屏上它们是直接可点的按钮。
- 标题栏右侧的时间是**访问者自己的时区**，`up` 是这一页真实打开多久；不是写死的字符串。

## 内容源：<template>

命令的输出全部从页面底部一组 `<template id="sec-*" / "proj-*">` 里 `cloneNode(true)` 出来。用 template 是因为它是惰性的：不渲染、图也不发请求，所以「案例正文写在 HTML 里、终端只是搬进屏」不用拿「页面上摊一整屏长文」去换。改文案改模板就行，不用碰 `main.js`，终端也就没法反过来讲一套假话。

- **坑**：`<template>` 的内容是一棵独立的碎片树，`document.querySelectorAll("#sec-works .t-cmd")` **穿不进去**，返回空列表。必须先 `getElementById(id).content` 再查。这个坑的症状很隐蔽——项目列表读不出来，`open flow-studio` 一律报 "no such project"，而建议词列表是空的。
- clone 之后还要过两道加工：`fillNums()` 把 `.stat-num[data-target]` 的数字填进文本，`makeShotsFocusable()` 给 `.t-shot img` 补 `tabindex=0` + `role=button`。
- 数字**不做滚动进场计数**：终端里没有「滚到那一屏才开始」这回事，一 `render` 就是终值。老版页面上那些 `.stat` 是 IntersectionObserver 驱动滚到才涨的，所以命令读文本会在首屏报出一串 `0`——现在读 `data-target`。

## 命令

`help / whoami / works / ls / ls works/ / open <名字> / skills / timeline / stats / contact / date / uptime / clear`。↑↓ 翻历史、Tab 补全、Ctrl-L 清屏。`open` 的别名同时接受 `flow-studio`、`flow`、`Flow Studio`。

- 错误和建议文案里提到的命令名都是**真按钮**：`help` 的每一条、报错里的 `试试：help / works / open flow-studio`、`ls works/` 的项目名、footer 的建议词，全部带 `data-cmd`，由 `document` 上一个代理 click 监听统一执行。所以整屏不需要打字也能走通。
- 只有一个命令例外地不读模板：`ls`。裸 `ls` 报的是 `index.html main.js style.css` 三个真实文件名（整站就这三个文件），`ls works/` 才 clone 门牌里那份项目列表。
- 彩蛋：`sudo`、`vim/vi/nano/emacs`、`npm/yarn/pnpm/node`、`exit/quit/logout`、`rm`。
- 用户输入一律走 `textContent` 建节点，不拼 HTML 字符串。
- `<input>` 没有自适应宽度：用一个 `visibility:hidden` 的 span 量当前文本再写回 `width`，空着时量 placeholder，否则提示语会被切掉半个汉字。

## 案例与截图

`open flow-studio` 会先把那段跃迁当转场，再把案例块打进输出区：标题、一句话讲清它在干什么、一张**真实运行截图**、三条要点、最底下写清量它的命令。

- 截图是终端内嵌的图框（`.t-shot`），点一下（或聚焦后回车）开灯箱放大；灯箱关闭会把焦点还给打开它的那张图。
- **有录屏的作品在框里就直接播**：`prepShots()` 在克隆出来的片段里把 `<img>` 就地换成 `<video muted loop playsinline autoplay>`，`poster` 就是那张原截图，所以视频没到位之前框里不是黑块。静音是因为带声音的自动播放会被浏览器拦，也是「不该在公共场合突然出声」的默认；要声音就点进灯箱，那里是 `<video controls autoplay loop>`。
- 换的是**运行时的那一份**：`<template>` 里始终是真 `<img>`，所以无 JS、爬虫、以及 `prefers-reduced-motion`（直接保留图片，一行视频字节都不下）拿到的都是静态截图。尺寸规则写成 `.t-shot img, .t-shot video` 共用，竖屏那套 `contain` / 居中 / 圆角不必重写第二遍。
- 自动播放只挂在**看得见**的那一段：`IntersectionObserver({ root: scroller, threshold: .2 })` 进视野 `play()`、离开 `pause()`。一屏终端里输出区才是滚动容器，观察器的 `root` 必须是它而不是 viewport。
- 竖屏项目（美图工坊）用 `.t-shot.is-phone`：图窄框宽是故意的，画框当展台，手机当产品照摆在中间，`object-fit:contain` 加圆角和投影。横屏截图仍是 `cover` 裁进 16:10 框里。
- 素材本身没变：`assets/` 是真实运行截图与录屏。截图用 Playwright 起本地服务后 `full_page` 抓取、裁成 16:10（竖屏保留 760×1590）转 progressive JPEG；录屏用 Playwright `record_video_dir` 出 webm，再 `ffmpeg -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart -an` 转 mp4 并剪掉开头空几秒。
- 每个数字旁边都写了量它的命令（`.t-run` / `.t-by`，如 `pytest --collect-only -q` → 223）。数字会过期，命令不会——改数之前先把命令重跑一遍。

## 流式输出

命令结果不是一次砸出来的，是像模型回话那样逐字淌出来（`streamInto()`）。案例块、`help`、`skills` 走的是同一条路径。

- 先把块里每个直接子元素打上 `.t-hold`（`visibility:hidden`，**不是** `display:none`），再用 TreeWalker 收集其中的文本节点、把 `nodeValue` 清空。布局从第一帧起就是终态：打字期间块高一个字节的长度都不变，`placeBlock()` 的落位判据和「有没有滚到底」都不会被动画自己推走——这是开机打字那段用的同一个手法，两处共用。
- 节奏按**绝对时间**算，不按帧增量：`budget = floor((now - t0) / 1000 * cps) - emitted`。写成「每帧 `dt * cps` 再取整」在 120Hz 屏上会**彻底卡住**——单帧增量 0.94 字，`floor` 把小数丢掉，`budget` 永远凑不到 1，光标停在第 35 个字不动，还不报任何错（本机实测：60fps 下看着像「慢」，120Hz 下就是「死」）。
- 速率 `cps = max(90, 总字数 / 1.2s)`：短输出也够快，长输出封顶 1.2 秒淌完，不会有人等到第二秒。光标是一个 `▋` 的 `span`，靠 `margin-right:-.62em` 占零宽，跟着最后一个字在 DOM 里搬。
- **任何交互都立刻补完**（`streamFinish()`）：新命令、任意按键、点击终端、清屏、红黄绿三个灯，全部先把手上这段还原成终态再往下走。人不该为了问下一句等上一句淌完。
- `prefersReduced` 直接 return，一行代码都不藏；CSS 里同时把 `.t-hold` 强制 `visibility:visible`、光标 `display:none`，双保险。
- 自动演示的指令间隔（1800ms）必须大于流式上限（1200ms），否则上一句会被下一句抢着补完，看起来跟没有动画一样。

## 跃迁转场

原来那段 3D 超空间跃迁是用来配合长页跳转的，现在缩短成**换台**：`WARP_TRAVEL = 300` + `WARP_HOLD = 170`，共约 470ms，粒子从相机前方掠过后在尾段叠一层底色淡出。全程**不动页面滚动位置**——只负责「内容换了」这个知觉。

- 粒子还是 `{x, y, z, color}` 三维坐标，`sx = cx + x/z * fl` 透视投影，所以是真纵深不是斜线；近处更粗更亮，宽而淡的一层当辉光、窄而亮的一层当核心，叠加 `globalCompositeOperation = "lighter"`。
- 拖尾靠每帧盖一层 `rgba(9,9,18,.3)` 半透明底色叠出来。**灭点仍然画在 DOM 层**（`.warp-core`）而不是 canvas 里：canvas 每帧只叠 30% 底色，画在里面的光晕会被几十帧累加放大到约 3.3 倍稳态，糊成一片盖住半屏的灰雾。这层压在 canvas 之上（canvas 底不透明，压在它后面等于没有），用 `mix-blend-mode: screen` 加光，尺寸写死在 `vmin` 里所以始终是一个「点」。
- `prefers-reduced-motion`、拿不到 `requestAnimationFrame`、或上一段还没播完时直接执行回调不播粒子。

## 开机动画与自动演示

- 终端一挂载就把欢迎语逐字敲出来，绿色方块光标跟着字符前进，输出整行依次打印，最后才亮出输入行和建议词（约 2.3s）。隐藏只改 `visibility` / `opacity`，布局从第一帧起就是终态，所以打字时下方内容不会上下跳；命令行的提示符也一起等轮到自己，否则屏上会先挂着两个后面空着的 `caoqu@local:~$`。按任意键、点终端、切到后台标签页都会立刻补完到终态（后台 `setTimeout` 被限流到 1s，不该剩半屏没打完），另有一个 8s 强制完成定时器。
- 动画放完后进入**自动演示循环**：自己敲 `whoami` → `ls works/` → `stats` → `skills` → `clear`，无限循环。演示期间光标常亮绿色（`.is-demo`），一眼看得出不是人在打；`aria-live` 同时关掉，否则读屏会被无限念的命令淹掉。真实按键或点击终端即交还控制权（`demoStop()` 清输入框、恢复 `aria-live: polite`）。
- 挂起条件从「首屏在不在视口」换成了「**输出区是不是滚到底**」：`document.hidden || !atBottom()` 就等着，滚回底部再续上。一屏终端永远在视口里，那个观察器已经没有意义了，但无人值守时不该跟正在读内容的人抢滚动位置——这条约束还在。
- 循环里**故意不放** `open`：它会换内容，不该在没人点的时候自己跳。
- 降低动效偏好下开机打字和演示循环整段跳过（JS 直接 `bootFinish()`，不靠 CSS 兜），标题栏时钟退化成只到分钟、60s 一跳。

## 渐进增强与降级

- `<head>` 里一行内联脚本给 `<html>` 加 `.js`；没有 JS 时输入行、建议词、红绿灯按钮整块隐藏（`visibility:hidden`，布局不塌），`<template>` 内容不渲染所以屏上只留静态门牌 + 四个项目名，另有一句 `<noscript>` 实话说明正文写在模板里、开了脚本才会搬进来。
- 首屏那颗手写 WebGL 的极光球已经拿掉了（连同 `webgl.js`）。终端底色改用两层静态极光 `radial-gradient` 余晖，免得整屏变成一块死黑，同时不引入任何持续运行的动画。
- 长页时代的卡片 3D 倾斜（`.tilt-on` 指针驱动 `rotateX/rotateY`）、`.reveal` 滚动进场、Ken Burns 呼吸与滚动视差全部随长页一起删除了——它们的前提是「内容在屏幕下方等着被滚到」。

## 布局坑（改样式前先看这条）

伪元素是**有身份的盒子**，会参与 flex/grid 布局，这是这一轮踩过两次的同一个坑：

- `.t-ul li::before` 画 `›` 项目符号。若 li 用 `grid-template-columns: 1.1em 1fr`，那么 `::before + b + span` 三个盒子会把 `<span>` 挤进那个 1.1em 的列里，症状是一条要点**一行一个字**。解法是让箭头 `grid-row: 1 / span 2` 独占左列、`b` 和 `span` 都显式 `grid-column: 2`，标题与正文各占一行。
  （中途试过 `display:flex; flex-wrap:wrap` 让「› 标题 — 正文」连排：正文一折行，那个 `b::after` 的破折号会孤零零吊在行尾，像断词。分成两行既不需要破折号，也和 `.t-tl` 对齐方式一致。）
- `.t-tl li` 同一套：`span + b + p` 三个盒子两列 grid，让 `.t-year` 用 `grid-row: 1 / span 2` 跨两行，`p` 显式 `grid-column: 2`，否则标题把正文顶到下格。窄屏下两者都退回单列。
- 绝对定位的 `<img>` / `<video>` 若不给显式宽高会退回固有尺寸，`object-fit` 就失效——框内裁切看起来正常，其实是左上角溢出裁掉的。

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
