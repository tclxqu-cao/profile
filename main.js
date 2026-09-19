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

  /* 页脚年份 */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
