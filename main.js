/* Caoqu — 个人主页交互 */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 导航：滚动时显示发丝线 */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* 移动端菜单：overflow 锁定 + 菜单层拦截触摸滚动，避免滚动穿透 */
  const toggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    document.body.style.overflow = open ? "hidden" : "";
  };
  navLinks.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  document.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => setOpen(false))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) setOpen(false);
  });

  /* 滚动显现：同一批进入视口的元素依次级联 */
  const revealEls = document.querySelectorAll(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        const batch = entries.filter((e) => e.isIntersecting);
        batch
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .forEach((entry, i) => {
            entry.target.style.setProperty("--d", `${Math.min(i * 0.09, 0.45)}s`);
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* 数字滚动 */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const animateNum = (el) => {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = (target * easeOut(p)).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    if (prefersReduced) {
      el.textContent = target.toFixed(decimals) + suffix;
    } else {
      requestAnimationFrame(tick);
    }
  };
  const statEls = document.querySelectorAll(".stat-num");
  if ("IntersectionObserver" in window && !prefersReduced) {
    const statIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animateNum(e.target);
            statIO.unobserve(e.target);
          }
        }),
      { threshold: 0.6 }
    );
    statEls.forEach((el) => statIO.observe(el));
  } else {
    statEls.forEach((el) => {
      el.textContent =
        parseFloat(el.dataset.target).toFixed(parseInt(el.dataset.decimals || "0", 10)) +
        (el.dataset.suffix || "");
    });
  }

  /* 3D 倾斜：指针驱动的透视微动，只在精确指针 + 可 hover 的设备上开 */
  const canTilt =
    !prefersReduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canTilt) {
    document.documentElement.classList.add("tilt-on");
    document.querySelectorAll(".card").forEach((el) => {
      let raf = 0;
      const apply = (rx, ry, mx, my) => {
        el.style.setProperty("--rx", `${rx}deg`);
        el.style.setProperty("--ry", `${ry}deg`);
        el.style.setProperty("--mx", `${mx}%`);
        el.style.setProperty("--my", `${my}%`);
      };
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          apply(-ny * 5.5, nx * 5.5, (nx + 1) * 50, (ny + 1) * 50);
        });
      }, { passive: true });
      el.addEventListener("pointerleave", () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        apply(0, 0, 50, 50);
      });
    });
  }

  /* 作品录屏：滚到画面里就自己播，离开再停 —— 触屏没有 hover，不能只绑悬停 */
  const shots = [...document.querySelectorAll(".shot[data-video]")];
  shots.forEach((shot) => {
    const vid = shot.querySelector(".shot-vid");
    let loaded = false;
    shot._play = () => {
      if (!loaded) {
        vid.src = shot.dataset.video;
        loaded = true;
      }
      shot.classList.add("is-playing");
      const p = vid.play();
      if (p) p.catch(() => shot.classList.remove("is-playing"));
    };
    shot._stop = () => {
      shot.classList.remove("is-playing");
      if (loaded) vid.pause();
    };
  });
  if (shots.length && !prefersReduced && "IntersectionObserver" in window) {
    const shotIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target._play();
          else e.target._stop();
        }),
      { threshold: 0.55 }
    );
    shots.forEach((s) => shotIO.observe(s));
  }

  /* 滚动视差：截图在框里反向漂一点，比整页跟着滚要有纵深 */
  const views = prefersReduced ? [] : [...document.querySelectorAll(".shot-view")];
  if (views.length) {
    let ticking = 0;
    const sync = () => {
      ticking = 0;
      const mid = window.innerHeight / 2;
      views.forEach((v) => {
        const r = v.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const off = ((r.top + r.height / 2 - mid) / window.innerHeight) * 26;
        v.style.setProperty("--py", `${Math.max(-22, Math.min(22, off)).toFixed(1)}px`);
      });
    };
    window.addEventListener("scroll", () => {
      if (!ticking) ticking = requestAnimationFrame(sync);
    }, { passive: true });
    sync();
  }

  /* 终端首屏：命令的输出全部现从页面 DOM 里读，
     改了文案 / 数字，终端不会反过来讲一套假话 */
  const term = document.querySelector(".term");
  const termBody = document.querySelector(".term-body");
  const termOut = document.getElementById("term-out");
  const termForm = document.getElementById("term-form");
  const termInput = document.getElementById("term-input");
  const termMeasure = document.getElementById("term-measure");

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const txt = (root, sel) => (root.querySelector(sel) || {}).textContent || "";
  const norm = (s) => s.trim().toLowerCase().replace(/[/／]$/, "").replace(/[\s·、]+/g, "-");

  /* 作品清单以首屏那行 `ls works/` 为准，open 的别名再补上卡片标题。
     开头缓存一次：命令输出里会出现它的副本，再查 DOM 就成双份了 */
  const WORK_LINKS = [...document.querySelectorAll(".t-files a")].map((a) => {
    const row = document.querySelector(a.getAttribute("href"));
    return {
      label: a.textContent.trim(),
      row,
      name: row ? txt(row, ".work-copy h3").trim() : "",
      tags: row ? txt(row, ".work-tags").trim() : "",
      keys: [norm(a.textContent), norm(row ? txt(row, ".work-copy h3") : "")].filter(Boolean),
    };
  });
  const workList = () => WORK_LINKS;

  const jump = (node) => {
    if (!node) return;
    node.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  };

  const cmds = {
    help: (b) => {
      const grid = el("div", "t-cols");
      [
        ["whoami", "我是做什么的"],
        ["works", "列作品（可 open <名字>）"],
        ["skills", "能力清单"],
        ["timeline", "轨迹"],
        ["stats", "页面上的数字"],
        ["contact", "联系方式"],
        ["clear", "清空屏幕"],
      ].forEach(([k, v]) => {
        grid.append(el("dt", null, k), el("dd", null, v));
      });
      b.append(grid, el("p", "t-dim", "↑↓ 翻历史 · Tab 补全 · 点击建议词也行"));
    },

    whoami: (b) => {
      const meta = txt(document.querySelector(".term"), ".t-meta");
      const desc = txt(document.querySelector(".term"), ".t-desc").replace(/\s+/g, " ").trim();
      b.append(el("p", "t-ok", "caoqu"), el("p", null, meta), el("p", "t-dim", desc));
    },

    ls: (b) => b.append(document.querySelector(".t-files").cloneNode(true)),
    works: (b) => {
      workList().forEach((w) => b.append(jumpLine(w.label.replace(/\/$/, ""), w.row, w.tags)));
      b.append(el("p", "t-dim", "open <名字> 直接跳过去"));
    },

    open: (b, arg) => {
      if (!arg) return el("p", "t-hl", "用法：open <作品名>　例如 open flow-studio");
      const q = norm(arg);
      const hit = workList().find((w) => w.keys.some((k) => k.startsWith(q)));
      if (!hit) return el("p", "t-err", `open: no such file or directory: ${arg}`);
      jump(hit.row);
      return el("p", "t-ok", `→ ${hit.name}`);
    },

    skills: (b) => {
      [...document.querySelectorAll("#skills .card h3")].forEach((h) =>
        b.append(jumpLine(h.textContent.trim(), h.closest(".card")))
      );
    },

    timeline: (b) => {
      [...document.querySelectorAll(".t-row")].forEach((row) => {
        const line = el("p");
        line.append(
          el("span", "t-link", txt(row, ".t-year").trim()),
          el("span", null, "  " + txt(row, ".t-body h3").trim())
        );
        b.append(line);
      });
      b.append(jumpLine("→ 跳到轨迹", document.getElementById("journey")));
    },

    stats: (b) => {
      const grid = el("div", "t-cols");
      [...document.querySelectorAll(".stat")].forEach((s) => {
        grid.append(
          el("dt", "t-hl", txt(s, ".stat-num").trim()),
          el("dd", null, txt(s, ".stat-label").trim())
        );
      });
      b.append(grid, el("p", "t-dim", "每个数字旁边都写了量它的命令，可以自己复算"));
    },

    contact: (b) => {
      document.querySelectorAll(".contact-links a").forEach((a) => {
        const p = el("p");
        p.append(
          el("span", null, a.textContent.replace("›", "").trim()),
          el("span", "t-dim", "  " + (/^https?:/.test(a.href) ? a.href : a.getAttribute("href")))
        );
        b.append(p);
      });
      b.append(jumpLine("→ 跳到联系区", document.getElementById("contact")));
    },

    date: () => el("p", null, new Date().toString()),
  };

  function jumpLine(label, target, note) {
    const p = el("p");
    const btn = el("button", "t-jump", label);
    btn.type = "button";
    btn.addEventListener("click", () => jump(target));
    p.append(btn);
    if (note) p.append(el("span", "t-dim", "  " + note.replace(/\s+/g, " ").trim()));
    return p;
  }

  /* 只清掉命令打出来的东西，首屏那段欢迎语是 HTML 里的原文。
     表单是 #term-out 的兄弟节点：新输出往上长，光标行自然被顶下去 */
  const clearScreen = () => {
    termOut.querySelectorAll(".t-echo, .t-block").forEach((c) => c.remove());
  };

  const run = (raw) => {
    const [name, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ");
    if (!name) return;
    if (name === "clear") return clearScreen();
    const b = el("div", "t-block");
    termOut.append(b);

    if (name === "sudo")
      return void b.append(
        el("p", "t-err", "caoqu is not in the sudoers file. This incident will be reported."),
        el("p", "t-dim", "而且就算报了也没用——内部系统的截图和数据都不外传。")
      );
    if (/^(vim|vi|nano|emacs)$/.test(name))
      return void b.append(el("p", "t-hl", "这台机器没装编辑器。整站零依赖，所以我也不装。"));
    if (/^(npm|yarn|pnpm|node)$/.test(name))
      return void b.append(
        el("p", "t-hl", "npm 在这里没有。四个文件、零个包，构建步骤就是「拷文件」。")
      );
    if (/^(exit|quit|logout)$/.test(name))
      return void b.append(el("p", "t-dim", "这不是一个真会话，关掉标签页就行。"));
    if (cmds[name]) {
      const ret = cmds[name](b, arg);
      if (ret) b.append(ret);
      return;
    }
    b.append(
      el("p", "t-err", `zsh: command not found: ${name}`),
      el("p", "t-dim", "试试 help、works、open flow-studio")
    );
  };

  const runAndShow = (raw) => {
    const line = el("p", "t-line t-echo");
    line.append(el("span", "t-prompt", "caoqu@local:~$"), document.createTextNode(raw));
    termOut.append(line);
    run(raw);
    termBody.scrollTop = termBody.scrollHeight;
  };

  const history = [];
  let cursor = 0;

  termForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = termInput.value;
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

  document.querySelectorAll("#term-chips button").forEach((btn) =>
    btn.addEventListener("click", () => {
      termInput.focus();
      runAndShow(btn.dataset.cmd);
    })
  );

  term.addEventListener("focusin", () => term.classList.add("is-focused"));
  term.addEventListener("focusout", () => term.classList.remove("is-focused"));
  /* 手机上点终端别弹键盘，读东西比敲命令重要 */
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches)
    termBody.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button")) return;
      termInput.focus();
    });

  /* ---------- 开机动画 ----------
     首屏那几行不是贴上去的字，是当场敲出来的：命令逐字打、输出整行打印，
     最后才亮出输入行，顺便告诉来访者「这个框能输入」。隐藏状态由 JS 挂类才开始，
     脚本没跑或直接报错都只会退化成完整静态内容。 */
  const termChips = document.getElementById("term-chips");
  let bootTimers = [];
  let booted = false;
  let bootStarted = false;

  const bootFinish = () => {
    if (booted) return;
    booted = true;
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
    term.querySelectorAll(".t-wait").forEach((n) => n.classList.remove("t-wait"));
    termOut.querySelectorAll(".t-ch").forEach((n) => n.classList.add("on"));
    const caret = termOut.querySelector(".t-boot-caret");
    if (caret) caret.remove();
    termOut.setAttribute("aria-live", "polite");
  };

  const startBoot = () => {
    if (bootStarted || booted) return;
    bootStarted = true;

    const wait = (n) => {
      n.classList.add("t-fade", "t-wait");
      return n;
    };
    const acts = [];

    [...termOut.children].forEach((node) => {
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
        [...node.querySelectorAll("a")].forEach((a) => {
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

    /* 逐字点亮期间别让 aria-live 把半截命令念一遍 */
    termOut.setAttribute("aria-live", "off");
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

  if (!prefersReduced) {
    const skip = () => bootFinish();
    document.addEventListener(
      "keydown",
      (e) => {
        if (booted) return;
        bootFinish();
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) termInput.focus();
      },
      { capture: true }
    );
    term.addEventListener("pointerdown", skip, { capture: true });
    /* 后台标签页的 setTimeout 会被限流到 1s，回来时不该还剩半屏没打完 */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) bootFinish();
    });
    if ("IntersectionObserver" in window) {
      const bootIo = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          bootIo.disconnect();
          startBoot();
        },
        { threshold: 0.3 }
      );
      bootIo.observe(term);
    } else {
      startBoot();
    }
  }

  /* 页脚年份 */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
