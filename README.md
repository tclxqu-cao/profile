# Caoqu — 个人主页

仿 Apple 设计风格的个人网站：毛玻璃导航、大字 Hero、苹果系统配色与字体栈。
纯静态四件套（`index.html` + `style.css` + `main.js` + `webgl.js`），零依赖、无构建、无后端。

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

## 本地预览

直接双击 `index.html`，或起个静态服务：

```sh
python3 -m http.server 8000   # 打开 http://localhost:8000
```

## 免费托管（Vercel / Netlify / GitHub Pages）

纯静态站，任何静态托管平台都能免费部署：

- **Vercel**：在本目录执行 `npx vercel --prod`（Framework Preset 选 Other，输出目录为根目录），或推到 GitHub 后在 vercel.com/new 导入，零配置。
- **Netlify**：`npx netlify deploy --prod --dir .`
- **GitHub Pages**：推仓库后 Settings → Pages 选分支根目录。

无构建步骤、无环境变量。
