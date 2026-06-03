/**
 * API 基础路径，用于避免跨域。
 * - 开发/预览：不设置时使用相对路径，由 Vite 代理 /yansee 到后端。
 * - 若后端不在 localhost:8080，在 .env 中设置 VITE_PROXY_TARGET。
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
