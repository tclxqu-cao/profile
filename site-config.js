/* 浏览器只配置公开入口，认证密钥放在网站服务端环境变量中。 */
window.PORTFOLIO_CONFIG = Object.freeze({
  mainFlowUrl: "/api/command",
  assetBaseUrl: "",
  timeoutMs: 305000,
  autoDemo: true,
  ...(window.PORTFOLIO_CONFIG_OVERRIDE || {}),
});
