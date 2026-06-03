import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * `/member` 开发代理：未设置环境变量时固定转发到远程
 * `http://192.168.0.222:38172`。
 * 仅当你在本机启动 member-api、需要打本地断点/看本地日志时，才在 `.env.development` 里设
 * `VITE_DEV_PROXY_TARGET` 指向本机（例如 http://127.0.0.1:实际端口）。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET?.trim() || "http://192.168.0.222:38172";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/member": {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (_proxyReq, req) => {
              const u = req.url ?? "";
              console.log(
                `[vite proxy] ${req.method ?? "?"} ${u} -> ${proxyTarget}${u}`,
              );
            });
            proxy.on("error", (err) => {
              console.error("[vite proxy] error:", err.message);
            });
          },
        },
      },
    },
  };
});
