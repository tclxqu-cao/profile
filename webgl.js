/* Caoqu — Hero 3D：零依赖 WebGL 光线步进「液态铬极光球」
   渐进增强：拿不到 WebGL 上下文时直接 return，页面上的 CSS 极光球原样保留。 */
(() => {
  "use strict";

  const canvas = document.getElementById("hero-3d");
  const orb = document.querySelector(".orb");
  if (!canvas || !orb) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 700px)").matches;

  const VS = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uPtr;
    uniform float uSpin;
    uniform float uFade;
    uniform float uSteps;

    const vec3 C0 = vec3(0.039, 0.518, 1.000); /* #0A84FF */
    const vec3 C1 = vec3(0.749, 0.353, 0.949); /* #BF5AF2 */
    const vec3 C2 = vec3(1.000, 0.216, 0.373); /* #FF375F */
    const vec3 C3 = vec3(1.000, 0.624, 0.039); /* #FF9F0A */

    /* 极光四色。走三角波往返而不是环形：橙→蓝直接插值会经过灰绿，脏色就来自这里 */
    vec3 aurora(float t) {
      float u = abs(fract(t) * 2.0 - 1.0) * 3.0;
      float f = smoothstep(0.0, 1.0, fract(u));
      vec3 a = C0, b = C1;
      if (u >= 1.0) { a = C1; b = C2; }
      if (u >= 2.0) { a = C2; b = C3; }
      return mix(a, b, f);
    }

    /* 平滑取并集：四个球相互渗透成液滴，而不是刚性拼装 */
    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float map(vec3 p) {
      float t = uTime * 0.32;
      float d = length(p) - 0.92;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float a = t + fi * 1.5707963;
        vec3 c = vec3(cos(a) * 0.52, sin(a * 1.3 + fi) * 0.38, sin(a) * 0.52);
        float r = 0.50 + 0.08 * sin(t * 1.7 + fi * 2.1);
        d = smin(d, length(p - c) - r, 0.56);
      }
      return d + 0.020 * sin(8.0 * p.x + t * 2.0) * sin(8.0 * p.y - t * 1.6) * sin(8.0 * p.z + t * 1.2);
    }

    vec3 normalAt(vec3 p) {
      vec2 e = vec2(0.0035, -0.0035);
      return normalize(
        e.xyy * map(p + e.xyy) +
        e.yyx * map(p + e.yyx) +
        e.yxy * map(p + e.yxy) +
        e.xxx * map(p + e.xxx)
      );
    }

    /* 程序化影棚环境：地平线式明暗转折 + 主光/辅光/顶光，省去贴图依赖 */
    vec3 studio(vec3 r) {
      vec3 sky = mix(vec3(0.28, 0.30, 0.38), vec3(1.0), smoothstep(-0.18, 0.10, r.y));
      sky += pow(max(dot(r, normalize(vec3(0.30, 0.85, 0.42))), 0.0), 60.0) * 2.6;
      sky += pow(max(dot(r, normalize(vec3(-0.55, -0.05, 0.72))), 0.0), 12.0) * 0.30;
      sky += smoothstep(0.55, 1.0, r.y) * 0.35;
      return sky;
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;

      float az = 0.55 + uPtr.x * 0.42 + uSpin;
      float el = 0.16 + uPtr.y * 0.30;
      float dist = 4.45;
      vec3 ro = vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el)) * dist;
      vec3 fw = normalize(-ro);
      vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
      vec3 up = cross(fw, rt);
      vec3 rd = normalize(uv.x * rt + uv.y * up + 2.5 * fw);

      float tm = 2.9, tHit = -1.0, closest = 1e5;
      for (int i = 0; i < 78; i++) {
        if (float(i) > uSteps) break;
        float d = map(ro + rd * tm);
        closest = min(closest, d);
        if (d < 0.0012) { tHit = tm; break; }
        if (tm > 8.0) break;
        tm += d * 0.8;
      }

      /* 像素角尺寸决定边缘软化宽度：没有 MSAA 也拿得到抗锯齿边 */
      float px = 2.5 / uRes.y;
      float cover = 1.0 - smoothstep(0.0, px * 1.8, closest);

      vec3 col = vec3(0.0);

      if (cover > 0.001) {
        vec3 p = ro + rd * (tHit > 0.0 ? tHit : tm);
        vec3 n = normalAt(p);
        vec3 r = reflect(rd, n);
        float fres = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 3.0);
        vec3 base = studio(r);
        /* 保留影棚明度、只替换色度：直接拿饱和色乘暗部会得到褐色 */
        /* 色相区间刻意锁在蓝→紫→粉（u≈0..1.9），橙色只做边缘点缀 */
        vec3 film = aurora(0.50 + fres * 0.26 + r.y * 0.07 + sin(uTime * 0.1) * 0.03);
        float lum = dot(base, vec3(0.299, 0.587, 0.114));
        col = mix(base, film * (0.45 + 0.80 * lum), 0.44 + 0.42 * fres);
        col += film * pow(fres, 3.0) * 0.40;
        col *= 0.90 + 0.16 * smoothstep(-0.9, 0.5, n.y);
      }

      col = col / (1.0 + col * 0.28);
      col = pow(max(col, 0.0), vec3(0.92));
      col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.02;

      /* 白底上任何非零 alpha 的暗色都会糊成灰块，所以轮廓外必须严格为 0 */
      float alpha = cover * uFade;
      gl_FragColor = vec4(col * alpha, alpha);
    }
  `;

  let gl = null;
  try {
    const opts = { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
    gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  } catch (e) {
    gl = null;
  }
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[hero-3d] shader 编译失败：", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[hero-3d] program 链接失败：", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uRes", "uTime", "uPtr", "uSpin", "uFade", "uSteps"].forEach((n) => {
    U[n] = gl.getUniformLocation(prog, n);
  });

  const MAX_SIDE = isMobile ? 720 : 1000;
  let resScale = isMobile ? 0.62 : 0.8;
  let w = 0, h = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || orb.clientWidth;
    const ch = canvas.clientHeight || orb.clientHeight;
    if (!cw || !ch) return;
    let bw = Math.round(cw * dpr * resScale);
    let bh = Math.round(ch * dpr * resScale);
    const over = Math.max(bw, bh) / MAX_SIDE;
    if (over > 1) {
      bw = Math.round(bw / over);
      bh = Math.round(bh / over);
    }
    if (bw === w && bh === h) return;
    w = bw;
    h = bh;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  };

  resize();
  orb.classList.add("webgl-on");

  const ptr = { x: 0, y: 0 };
  const ptrTarget = { x: 0, y: 0 };
  let spin = 0;
  let spinTarget = 0;
  let fade = 0;
  let time = 3.4;

  if (!reduced) {
    window.addEventListener(
      "pointermove",
      (e) => {
        ptrTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
        ptrTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true }
    );

    const onScroll = () => {
      const rect = orb.getBoundingClientRect();
      const p = Math.min(Math.max(-rect.top / Math.max(window.innerHeight, 1), 0), 1);
      spinTarget = p * 1.35;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  let onScreen = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
    }, { threshold: 0 }).observe(orb);
  }

  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(orb);

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) loop(performance.now());
  });

  gl.clearColor(0, 0, 0, 0);

  const draw = () => {
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uPtr, ptr.x, ptr.y);
    gl.uniform1f(U.uSpin, spin);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uSteps, isMobile ? 52 : 78);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  let last = performance.now();
  let acc = 0, frames = 0;

  const loop = (now) => {
    const dt = Math.min(now - last, 50);
    last = now;
    time += dt * 0.001;
    fade = Math.min(fade + dt / 900, 1);
    ptr.x = lerp(ptr.x, ptrTarget.x, 0.06);
    ptr.y = lerp(ptr.y, ptrTarget.y, 0.06);
    spin = lerp(spin, spinTarget, 0.08);
    draw();

    /* 掉帧就降内部分辨率，宁可糊一点也不卡 */
    acc += dt;
    frames++;
    if (frames >= 45) {
      if (acc / frames > 21 && resScale > 0.45) {
        resScale = Math.max(0.45, resScale * 0.78);
        w = h = 0;
      }
      acc = frames = 0;
    }
  };

  const tick = (now) => {
    if (running && onScreen && !reduced) loop(now);
    else last = now;
    requestAnimationFrame(tick);
  };

  if (reduced) {
    fade = 1;
    draw();
  } else {
    requestAnimationFrame(tick);
  }
})();
