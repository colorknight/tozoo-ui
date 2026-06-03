/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 扁平化命名，确保 @apply 能找到对应 utility
        "admin-bg": "#f1f5f9",
        "admin-surface": "#ffffff",
        "admin-sidebar": "#0f172a",
        "admin-sidebar-hover": "#1e293b",
        "admin-border": "#e2e8f0",
        "admin-muted": "#64748b",
        "admin-accent": "#2563eb",
        "admin-accent-hover": "#1d4ed8",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
