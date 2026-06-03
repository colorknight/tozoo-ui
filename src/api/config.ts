/**
 * API 根地址（不含路径）。
 * - 开发：默认不设 `VITE_API_BASE`，请求 `/member/...` 与页面同源，由 Vite 代理到 member，**无跨域**。
 *   若设置 `VITE_API_BASE` 为外网域名，浏览器会跨域直连，需后端 CORS。
 * - 构建部署：可设为 `http://192.168.0.222:38172` 或同源反代
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "";
}

/** 必填请求头 I18n（OpenAPI） */
export function i18nHeader(): string {
  // 优先使用环境变量（便于测试/部署强制指定语言）
  const env = import.meta.env.VITE_I18N_HEADER?.trim();
  if (env) return env;

  // 浏览器通常是 BCP47（如 zh-CN / en-US），后端库 `TOZOO_I18N.LANG` 使用 Java Locale 风格（如 zh_CN）
  const nav = (typeof navigator !== "undefined" && (navigator.languages?.[0] || navigator.language)) || "";
  const t = nav.trim();
  if (t) {
    const parts = t.replace("-", "_").split("_").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].toLowerCase()}_${parts[1].toUpperCase()}`;
    }
    if (parts.length === 1) {
      // 只有语言时，兜底到常用地区（与现有库一致）
      if (parts[0].toLowerCase() === "zh") return "zh_CN";
      return parts[0].toLowerCase();
    }
  }

  return "zh_CN";
}
