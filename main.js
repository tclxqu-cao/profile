/* Caoqu — 个人主页：整站一屏终端的交互
   内容源是 index.html 里的 <template>，命令只负责把它 clone 进 #term-out。
   所以终端没法反过来讲一套假话：改文案不用碰这个文件。 */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const term = document.querySelector(".term");
  const scroller = document.getElementById("term-scroll");
  const termOut = document.getElementById("term-out");
  const termForm = document.getElementById("term-form");
  const termInput = document.getElementById("term-input");
  const termMeasure = document.getElementById("term-measure");
  const termChips = document.getElementById("term-chips");
  const motd = document.querySelector(".t-motd");
  const ttyStatus = document.getElementById("tty-status");

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const norm = (s) =>
    String(s).trim().toLowerCase().replace(/[/／]$/, "").replace(/[\s·、]+/g, "-");

  /* ---------- 内容源 ---------- */

  const SEC = {
    whoami: "sec-whoami",
    works: "sec-works",
    skills: "sec-skills",
    stats: "sec-stats",
    timeline: "sec-timeline",
    contact: "sec-contact",
  };

  /* 作品清单以 #sec-works 那份为准：open 的名字、别名、模板都从它推出来，
     加一个项目只要多写一个 <template id="proj-x"> 和在清单里加一行。
     注意 <template> 的内容是另一棵碎片树，document.querySelectorAll 穿不进去，
     必须先拿 .content 再查。 */
  const WORKS_SRC = document.getElementById(SEC.works).content;
  const PROJECTS = [...WORKS_SRC.querySelectorAll(".t-cmd")]
    .map((btn) => {
      const key = btn.dataset.cmd.replace(/^open\s+/, "").trim();
      const tpl = document.getElementById("proj-" + key);
      if (!tpl) return null;
      const h2 = tpl.content.querySelector(".t-h2");
      const name = (h2 ? h2.firstChild.textContent : key).trim();
      const dd = btn.parentElement.nextElementSibling;
      return {
        key,
        name,
        tpl,
        desc: dd ? dd.textContent.trim() : "",
        keys: [...new Set([norm(key), norm(name)].filter(Boolean))],
      };
    })
    .filter(Boolean);

  /* 数字旁边的占位 0 只是模板写法，进终端前必须换成终值：
     终端里没有「等滚动到那一屏才开始」这回事 */
  const fillNums = (root) => {
    root.querySelectorAll(".stat-num").forEach((n) => {
      const dec = parseInt(n.dataset.decimals || "0", 10);
      n.textContent = parseFloat(n.dataset.target).toFixed(dec) + (n.dataset.suffix || "");
    });
  };

  /* 框里的媒体：有录屏的就地把截图换成循环播放的静音视频（poster 仍是那张真截图，
     所以不会有黑框），没有录屏的保持 <img>。两者都要能被键盘点开进放大层。
     替换只发生在 clone 出来的活 DOM 上——模板源码里永远是 <img>，
     爬虫、禁用 JS、要求降低动效的人拿到的都是静态截图。 */
  const shotIO =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              const v = en.target;
              if (en.isIntersecting) {
                const pr = v.play();
                if (pr && pr.catch) pr.catch(() => {});
              } else v.pause();
            }),
          { root: scroller, threshold: 0.2 }
        )
      : null;

  const prepShots = (root) => {
    root.querySelectorAll(".t-shot").forEach((shot) => {
      const img = shot.querySelector("img");
      if (!img) return;
      const src = shot.dataset.video;
      let media = img;
      if (src && !prefersReduced) {
        const v = el("video");
        v.src = src;
        v.poster = img.currentSrc || img.src;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.autoplay = true;
        img.replaceWith(v);
        media = v;
        if (shotIO) shotIO.observe(v);
      }
      media.tabIndex = 0;
      media.setAttribute("role", "button");
      media.setAttribute("aria-label", src ? "放大这段录屏" : "放大这张截图");
    });
  };

  const render = (id) => {
    const frag = document.getElementById(id).content.cloneNode(true);
    fillNums(frag);
    prepShots(frag);
    return frag;
  };

  /* ---------- 流式输出 ----------
     命令结果不是一次砸出来的，是像模型回话那样逐字淌出来。
     还没淌到的块用 visibility 藏（不是 display:none）：布局从第一帧就是终态，
     打字期间块高不变，placeBlock 和「是不是滚到底」的判据都不会被动画自己推走。
     任何新命令、按键、点击都立刻补完——没人愿意等上一段打完才能问下一句。 */
  const STREAM_MAX_MS = 1200;
  const STREAM_MIN_CPS = 90;
  let streamJob = null;

  const streamFinish = () => {
    if (streamJob) streamJob.done();
  };

  const streamInto = (block) => {
    if (prefersReduced || !block.firstChild) return;
    streamFinish();

    const items = [];
    let total = 0;
    [...block.children].forEach((child) => {
      child.classList.add("t-hold");
      items.push({ show: child });
      const walk = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        items.push({ node: n, text: n.nodeValue, at: 0 });
        total += n.nodeValue.length;
        n.nodeValue = "";
      }
    });

    const caret = el("span", "t-stream-caret", "▋");
    let i = 0;
    let raf = 0;
    const t0 = performance.now();
    let emitted = 0;
    const cps = Math.max(STREAM_MIN_CPS, total / (STREAM_MAX_MS / 1000));

    const done = () => {
      cancelAnimationFrame(raf);
      if (streamJob === job) streamJob = null;
      for (; i < items.length; i++) {
        const it = items[i];
        if (it.show) it.show.classList.remove("t-hold");
        else it.node.nodeValue = it.text;
      }
      caret.remove();
    };
    const job = { done };
    if (!total) return done();

    const step = (now) => {
      /* 用「到现在为止应该淌出多少字」做绝对基准，而不是每帧算增量：
         120Hz 下单帧增量不足 1 字，取整会把小数丢掉，动画就永远卡在原地。 */
      let budget = Math.floor(((now - t0) / 1000) * cps) - emitted;
      while (i < items.length) {
        const it = items[i];
        if (it.show) {
          it.show.classList.remove("t-hold");
          i++;
          continue;
        }
        if (budget < 1) break;
        const take = Math.min(it.text.length - it.at, budget);
        it.at += take;
        emitted += take;
        it.node.nodeValue = it.text.slice(0, it.at);
        budget -= take;
        it.node.after(caret);
        if (it.at >= it.text.length) i++;
        else break;
      }
      if (i >= items.length) return done();
      raf = requestAnimationFrame(step);
    };

    streamJob = job;
    raf = requestAnimationFrame(step);
  };

  /* 把「建议下一条命令」写成能点的：报错不该只让人自己去猜 */
  const suggest = (prefix, names) => {
    const p = el("p", "t-dim");
    p.append(prefix);
    names.forEach((c, i) => {
      if (i) p.append("　");
      const b = el("button", "t-cmd", c);
      b.type = "button";
      b.dataset.cmd = c;
      p.append(b);
    });
    return p;
  };

  /* ---------- 滚动与放大层 ---------- */

  const atBottom = () =>
    scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 56;

  const scrollBottom = () =>
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: prefersReduced ? "auto" : "smooth" });

  /* 案例块比一屏高，贴到底等于只露出它的尾巴；这类块对齐到顶，短的仍滚到底 */
  const placeBlock = (block) => {
    const r = block.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    if (r.height > scroller.clientHeight - 40) {
      scroller.scrollTop = Math.max(0, scroller.scrollTop + (r.top - s.top) - 12);
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  };

  let lb, lbClose, lbBack;
  const lbOpen = (shot, opener) => {
    lb.querySelectorAll("img, video").forEach((n) => {
      if (n.tagName === "VIDEO") n.pause();
      n.remove();
    });
    const src = shot.dataset.video;
    let media;
    if (src) {
      media = el("video");
      media.src = src;
      media.controls = true;
      media.autoplay = true;
      media.loop = true;
      media.playsInline = true;
    } else {
      const img = shot.querySelector("img");
      media = el("img");
      media.src = img.currentSrc || img.src;
      media.alt = img.alt;
    }
    lb.append(media);
    lb.hidden = false;
    lbBack = opener;
    requestAnimationFrame(() => lb.classList.add("is-on"));
    lbClose.focus();
  };

  const lbCloseFn = () => {
    if (lb.hidden) return;
    lb.querySelectorAll("video").forEach((v) => v.pause());
    lb.classList.remove("is-on");
    setTimeout(() => {
      if (!lb.classList.contains("is-on")) lb.hidden = true;
      lb.querySelectorAll("img, video").forEach((n) => n.remove());
    }, 280);
    if (lbBack && term.contains(lbBack)) lbBack.focus();
    lbBack = null;
  };

  /* 挂在 <body> 下：.term-foot 有 backdrop-filter，会成为 fixed 后代的包含块 */
  lb = el("div", "lb");
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "放大查看运行截图");
  lbClose = el("button", "lb-close", "×");
  lbClose.type = "button";
  lbClose.setAttribute("aria-label", "关闭放大视图");
  lbClose.addEventListener("click", lbCloseFn);
  lb.append(lbClose);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) lbCloseFn();
  });
  document.body.append(lb);

  /* ---------- 跃迁转场（频道切换，不再滚动页面）---------- */

  const WARP_COLORS = ["#0a84ff", "#bf5af2", "#ff375f", "#ff9f0a", "#64d2ff", "#30d158"];
  const WARP_TRAVEL = 300;
  const WARP_HOLD = 170;
  let warping = false;

  const spawnStar = (fresh) => ({
    x: (Math.random() * 2 - 1) * 1.7,
    y: (Math.random() * 2 - 1) * 1.7,
    z: fresh ? 0.3 + Math.random() * 1.5 : 1.55 + Math.random() * 0.5,
    c: WARP_COLORS[(Math.random() * WARP_COLORS.length) | 0],
  });

  const warp = (swap) => {
    if (warping || prefersReduced || !window.requestAnimationFrame) return swap();
    warping = true;

    const cv = el("canvas", "warp");
    cv.setAttribute("aria-hidden", "true");
    const core = el("div", "warp-core");
    core.setAttribute("aria-hidden", "true");
    document.body.append(core, cv);
    const ctx = cv.getContext && cv.getContext("2d");
    const end = () => {
      cv.classList.remove("is-on");
      core.classList.remove("is-on");
      setTimeout(() => {
        cv.remove();
        core.remove();
      }, 300);
      warping = false;
    };
    if (!ctx) {
      swap();
      end();
      return;
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2;
    const cy = H / 2;
    const fl = Math.min(W, H) * 0.62;
    const stars = Array.from(
      { length: Math.round(Math.min(1300, Math.max(520, (W * H) / 1250))) },
      () => spawnStar(true)
    );
    const px = (s) => cx + (s.x / s.z) * fl;
    const py = (s) => cy + (s.y / s.z) * fl;

    requestAnimationFrame(() => {
      cv.classList.add("is-on");
      core.classList.add("is-on");
    });
    ctx.fillStyle = "#090912";
    ctx.fillRect(0, 0, W, H);

    const t0 = performance.now();
    let swapped = false;
    requestAnimationFrame(function frame(now) {
      const p = Math.min((now - t0) / (WARP_TRAVEL + WARP_HOLD), 1);
      const v = 1.5 + 4.6 * p * p;
      /* 每帧只盖一层半透明底色：拖尾自然叠出来，比逐条画尾迹省 */
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(9, 9, 18, 0.3)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(p * 0.34);
      ctx.translate(-cx, -cy);
      ctx.lineCap = "round";
      for (const s of stars) {
        const x0 = px(s);
        const y0 = py(s);
        s.z -= v * 0.017;
        if (s.z < 0.14) Object.assign(s, spawnStar(false));
        const x1 = px(s);
        const y1 = py(s);
        /* 越近（z 越小）越粗越亮；宽而淡的一层当辉光，窄而亮的一层当核心 */
        const near = 1 / s.z;
        ctx.strokeStyle = s.c;
        ctx.globalAlpha = Math.min(0.5, near * 0.22);
        ctx.lineWidth = Math.min(7, near * 1.5);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = Math.min(1, near * 0.42);
        ctx.lineWidth = Math.min(2.4, near * 0.42);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      if (!swapped && now - t0 >= WARP_TRAVEL) {
        swapped = true;
        swap();
      }
      if (p < 1) requestAnimationFrame(frame);
      else end();
    });
  };

  /* ---------- 命令 ---------- */

  const cmds = {
    help: (b) => {
      const grid = el("dl", "t-cols");
      [
        ["whoami", "我是做什么的"],
        ["works", "作品清单（可 open <名字>）"],
        ["skills", "能力清单"],
        ["stats", "页面上的数字与量它的命令"],
        ["timeline", "轨迹"],
        ["contact", "联系方式"],
        ["ls", "整站的文件清单"],
        ["clear", "清空屏幕"],
      ].forEach(([k, v]) => {
        const dt = el("dt");
        const btn = el("button", "t-cmd", k);
        btn.type = "button";
        btn.dataset.cmd = k;
        dt.append(btn);
        grid.append(dt, el("dd", null, v));
      });
      b.append(grid, el("p", "t-dim", "↑↓ 翻历史 · Tab 补全 · Ctrl-L 清屏 · 点建议词也行"));
    },

    whoami: (b) => b.append(el("p", "t-ok", "caoqu"), render(SEC.whoami)),

    works: (b) => b.append(render(SEC.works)),
    skills: (b) => b.append(render(SEC.skills)),
    stats: (b) => b.append(render(SEC.stats)),
    timeline: (b) => b.append(render(SEC.timeline)),
    contact: (b) => b.append(render(SEC.contact)),

    ls: (b, arg) => {
      const q = norm(arg);
      if (!arg) {
        b.append(
          el("p", "t-out", "index.html   main.js   style.css"),
          el("p", "t-dim", "整站就这三个文件：没有 node_modules，也没有构建步骤")
        );
        return;
      }
      if (q === "works" || q === "works-") {
        const files = motd.querySelector(".t-files").cloneNode(true);
        /* 开机动画可能正盖着 t-wait，克隆体不能带着「隐藏」出厂 */
        files.querySelectorAll(".t-wait").forEach((n) => n.classList.remove("t-wait"));
        b.append(files);
        return;
      }
      return el("p", "t-err", `ls: ${arg}: No such file or directory`);
    },

    open: (b, arg) => {
      if (!arg) {
        return suggest("用法：open <作品名>　例如", [
          "open flow-studio",
          "open 美图工坊",
        ]);
      }
      const q = norm(arg);
      const hit = PROJECTS.find((w) => w.keys.some((k) => k.startsWith(q)));
      if (!hit) {
        b.append(el("p", "t-err", `open: no such project: ${arg}`));
        return suggest("可选项：", PROJECTS.map((w) => `open ${w.key}`));
      }
      const block = el("div", "t-block");
      const frag = hit.tpl.content.cloneNode(true);
      fillNums(frag);
      prepShots(frag);
      block.append(frag);
      warp(() => {
        termOut.append(block);
        placeBlock(block);
        streamInto(block);
      });
      return el("p", "t-ok", `→ ${hit.name}　${hit.desc}`);
    },

    uptime: () => el("p", null, `up ${fmtUptime()}, 零依赖, 1 user`),

    date: () => el("p", null, new Date().toString()),
  };

  /* #term-out 里只有跑出来的东西，欢迎语在 .t-motd：整块清空就是清屏 */
  const clearScreen = () => {
    streamFinish();
    termOut.replaceChildren();
  };

  /* 返回本次输出的块，让调用方去逐字淌出来；clear 没有块可淌 */
  const run = (raw) => {
    const [name, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ");
    if (!name) return null;
    if (name === "clear") return void clearScreen();

    const b = el("div", "t-block");
    termOut.append(b);

    if (name === "sudo")
      b.append(
        el("p", "t-err", "caoqu is not in the sudoers file. This incident will be reported."),
        el("p", "t-dim", "而且就算报了也没用——内部系统的截图和数据都不外传。")
      );
    else if (/^rm/.test(name))
      b.append(
        el("p", "t-hl", "rm: 这里没有可删的东西。整站三个文件，删了就没站了。"),
        el("p", "t-dim", "真要清理的是我知识库里那些过期的数字。")
      );
    else if (/^(vim|vi|nano|emacs)$/.test(name))
      b.append(el("p", "t-hl", "这台机器没装编辑器。整站零依赖，所以我也不装。"));
    else if (/^(npm|yarn|pnpm|node)$/.test(name))
      b.append(
        el("p", "t-hl", "npm 在这里没有。三个文件、零个包，构建步骤就是「拷文件」。")
      );
    else if (/^(exit|quit|logout)$/.test(name))
      b.append(el("p", "t-dim", "这不是一个真会话，关掉标签页就行。"));
    else if (cmds[name]) {
      const ret = cmds[name](b, arg);
      if (ret) b.append(ret);
    } else
      b.append(
        el("p", "t-err", `zsh: command not found: ${name}`),
        suggest("试试：", ["help", "works", "open flow-studio"])
      );
    return b;
  };

  const runAndShow = (raw) => {
    const line = el("p", "t-line t-echo");
    line.append(el("span", "t-prompt", "caoqu@local:~$"), document.createTextNode(raw));
    termOut.append(line);
    /* 上一段还没淌完就先补全：问下一句不该等上一句 */
    streamFinish();
    const b = run(raw);
    if (b) streamInto(b);
    if (!atBottom()) scrollBottom();
  };

  /* ---------- 输入 ---------- */

  const history = [];
  let cursor = 0;

  termForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = termInput.value;
    demoStop();
    if (!raw.trim()) return runAndShow("");
    history.push(raw);
    cursor = history.length;
    termInput.value = "";
    fitInput();
    runAndShow(raw);
  });

  const ALL_CMDS = [...Object.keys(cmds), "clear", "help", "sudo", "exit"];

  termInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!history.length) return;
      e.preventDefault();
      cursor = Math.max(0, Math.min(history.length, cursor + (e.key === "ArrowUp" ? -1 : 1)));
      termInput.value = history[cursor] || "";
      fitInput();
    } else if (e.key === "Tab") {
      const head = norm(termInput.value);
      if (!head) return;
      const hit = ALL_CMDS.filter((c) => c.startsWith(head));
      if (hit.length === 1) {
        e.preventDefault();
        termInput.value = hit[0] + " ";
        fitInput();
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      clearScreen();
    } else if (e.key === "Escape") {
      termInput.blur();
    }
  });

  /* input 没有 auto 宽度：拿一个隐形 span 量当前文本有多宽再写回去。
     空着的时候量 placeholder，否则提示语会被切掉半个汉字 */
  const fitInput = () => {
    termMeasure.textContent = termInput.value || termInput.placeholder;
    termInput.style.width = `${termMeasure.getBoundingClientRect().width + 2}px`;
    termForm.classList.toggle("is-empty", !termInput.value);
  };
  termInput.addEventListener("input", fitInput);
  fitInput();

  /* 人一碰就把画面定下来：开机动画、自动演示、正在淌的输出全部立刻补完。
     反过来不行——不能让无人值守的动画跟真人抢同一块屏。 */
  const takeOver = () => {
    bootFinish();
    demoStop();
    streamFinish();
  };

  /* 首屏项目名、建议词、help 清单、报错里的可选项、ls 的克隆体——
     全走这一条委托，clone 出来的新节点不用重新绑 */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cmd]");
    if (!btn) return;
    takeOver();
    runAndShow(btn.dataset.cmd);
  });

  /* 截图放大：同样用委托，块是 clone 出来的。
     认 .t-shot 而不是里面的 <img>——有录屏时那张 <img> 已被换成 <video> */
  const shotOf = (node) => node.closest(".t-shot");
  termOut.addEventListener("click", (e) => {
    const shot = shotOf(e.target);
    if (!shot) return;
    lbOpen(shot, e.target);
  });
  termOut.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const shot = shotOf(e.target);
    if (!shot) return;
    e.preventDefault();
    lbOpen(shot, e.target);
  });

  /* ---------- 标题栏：红绿灯是真的窗口按钮 ---------- */

  term.querySelectorAll(".t-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      takeOver();
      const act = dot.dataset.dot;
      if (act === "clear") clearScreen();
      else if (act === "min") term.classList.add("is-min");
      else if (act === "max") {
        term.classList.remove("is-min");
        scrollBottom();
      }
    });
  });

  const started = Date.now();
  const pad = (n) => String(n).padStart(2, "0");
  const fmtUptime = () => {
    const s = Math.floor((Date.now() - started) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m${pad(s % 60)}s`;
    return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}m`;
  };
  const tickStatus = () => {
    const d = new Date();
    const off = -d.getTimezoneOffset() / 60;
    const clock = prefersReduced
      ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
      : `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    ttyStatus.textContent = `${clock} UTC${off >= 0 ? "+" : "-"}${Math.abs(off)} · up ${fmtUptime()}`;
  };
  tickStatus();
  setInterval(tickStatus, prefersReduced ? 60000 : 1000);

  /* 手机上点终端别弹键盘，读东西比敲命令重要 */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches)
    scroller.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button, [role=button]")) return;
      termInput.focus();
    });

  /* ---------- 门牌打字机 ----------
     首屏那段门牌不是贴上去的字，是当场敲出来的；打完之后终端自己敲一串命令循环演示，
     来访者一碰键盘、一点屏幕就把控制权交回去，从此不再自动打。
     隐藏状态由 JS 挂类才开始，脚本没跑或直接报错都只会退化成完整静态内容。 */
  let bootTimers = [];
  let booted = false;
  let bootStarted = false;

  const startBoot = () => {
    if (bootStarted || booted) return;
    bootStarted = true;

    const wait = (n) => {
      n.classList.add("t-fade", "t-wait");
      return n;
    };
    const acts = [];

    [...motd.children].forEach((node) => {
      if (node.classList.contains("t-line")) {
        const tn = node.lastChild;
        const raw = tn && tn.nodeType === 3 ? tn.textContent : "";
        const chars = [];
        if (raw.trim()) {
          const frag = document.createDocumentFragment();
          tn.textContent = raw.slice(0, raw.length - raw.trimStart().length);
          for (const ch of raw.trimStart()) {
            if (ch === " ") {
              frag.append(" ");
              continue;
            }
            const sp = el("span", "t-ch");
            sp.textContent = ch;
            frag.append(sp);
            chars.push(sp);
          }
          node.append(frag);
        }
        const caret = el("span", "t-boot-caret");
        /* 整行连提示符一起等到轮到自己：否则开机时屏上会先挂着两个后面空着的提示符 */
        wait(node);
        acts.push({
          ms: 120,
          fn: () => {
            node.classList.remove("t-wait");
            if (chars.length) chars[0].before(caret);
            else node.append(caret);
          },
        });
        chars.forEach((c) =>
          acts.push({
            ms: 26,
            fn: () => {
              c.classList.add("on");
              c.after(caret);
            },
          })
        );
        acts.push({ ms: 190, fn: () => caret.remove() });
      } else if (node.classList.contains("t-files")) {
        [...node.querySelectorAll("button")].forEach((a) => {
          wait(a);
          acts.push({ ms: 65, fn: () => a.classList.remove("t-wait") });
        });
      } else {
        wait(node);
        acts.push({ ms: 110, fn: () => node.classList.remove("t-wait") });
      }
    });

    wait(termForm);
    wait(termChips);
    acts.push({ ms: 200, fn: () => termForm.classList.remove("t-wait") });
    acts.push({ ms: 240, fn: () => termChips.classList.remove("t-wait") });

    let i = 0;
    const tick = () => {
      if (booted) return;
      if (i >= acts.length) {
        bootFinish();
        return;
      }
      const a = acts[i++];
      a.fn();
      bootTimers.push(setTimeout(tick, a.ms));
    };
    bootTimers.push(setTimeout(tick, 420));
    setTimeout(bootFinish, 8000);
  };

  const bootFinish = () => {
    if (booted) return;
    booted = true;
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
    term.querySelectorAll(".t-wait").forEach((n) => n.classList.remove("t-wait"));
    motd.querySelectorAll(".t-ch").forEach((n) => n.classList.add("on"));
    const caret = motd.querySelector(".t-boot-caret");
    if (caret) caret.remove();
    startDemo();
  };

  /* ---------- 自动演示 ----------
     一串真命令轮流敲：命令字符逐个进输入行（绿光标表示不是人在打），
     回车后走的是和用户手敲完全同一条 run() 路径，所以输出永远是页面真数据。
     敲完一轮 clear 再从头来。标签页切走、或者人已经往上翻回去读东西了，就原地 parked。 */
  const DEMO_CMDS = ["whoami", "ls works/", "stats", "skills", "clear"];
  let demoTimer = 0;
  let demoIdx = 0;
  let demoOn = !prefersReduced;
  let waitResume = null;

  const later = (fn, ms) => {
    clearTimeout(demoTimer);
    demoTimer = setTimeout(() => {
      if (!demoOn) return;
      if (document.hidden || !atBottom()) {
        termForm.classList.remove("is-demo");
        waitResume = fn;
        return;
      }
      fn();
    }, ms);
  };

  const resumeDemo = () => {
    if (!demoOn || waitResume === null || document.hidden || !atBottom()) return;
    const fn = waitResume;
    waitResume = null;
    fn();
  };

  const demoStop = () => {
    if (!demoOn) return;
    demoOn = false;
    clearTimeout(demoTimer);
    waitResume = null;
    termForm.classList.remove("is-demo");
    if (termInput.value) {
      termInput.value = "";
      fitInput();
    }
    termOut.setAttribute("aria-live", "polite");
  };

  const demoStep = () => {
    waitResume = null;
    const cmd = DEMO_CMDS[demoIdx++ % DEMO_CMDS.length];
    let i = 0;
    termForm.classList.add("is-demo");
    const type = () => {
      termInput.value = cmd.slice(0, ++i);
      fitInput();
      if (i < cmd.length) return later(type, 44 + Math.random() * 34);
      later(() => {
        termForm.classList.remove("is-demo");
        termInput.value = "";
        fitInput();
        runAndShow(cmd);
        later(demoStep, cmd === "clear" ? 780 : 1800);
      }, 300);
    };
    type();
  };

  function startDemo() {
    if (!demoOn) return;
    /* 自动循环期间关掉 aria-live，否则读屏会被无限念的命令淹掉 */
    termOut.setAttribute("aria-live", "off");
    later(demoStep, 1000);
  }

  if (demoOn) {
    scroller.addEventListener("scroll", resumeDemo, { passive: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) bootFinish();
        else resumeDemo();
      },
      { capture: true }
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (!lb.hidden && e.key === "Escape") {
        lbCloseFn();
        return;
      }
      if (lb.hidden && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        takeOver();
        termInput.focus();
      }
    },
    { capture: true }
  );
  term.addEventListener(
    "pointerdown",
    () => {
      takeOver();
    },
    { capture: true }
  );

  /* 一屏终端没有「滚进视野」这回事：可见就开机，不可见只是标签页在后台。
     门牌打字机本身就是动效，要求降低动效时直接落到终态，不靠 CSS 兜。 */
  if (prefersReduced) bootFinish();
  else startBoot();
})();
