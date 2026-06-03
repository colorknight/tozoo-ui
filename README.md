# Tozoo 商城前端

Vite + React + TypeScript + Tailwind。用于 **Tozoo** 的商城展示壳层；商品上架、定价、收费在 **Tozoo 管理端** 维护，本仓库专注浏览与后续对接列表/详情接口。

## 开发

```bash
cd E:\vscode\tozoo
npm install
npm run dev
```

浏览器打开 <http://localhost:5173>。

## 构建

```bash
npm run build
npm run preview
```

## 与后端

- **商品列表**：`GET /member/commodity/list`（query：`pageNumber`、`pageSize`、`name`、`commodityStatus` 等），请求头 **`I18n`**（默认 `zh-CN`，可用 `VITE_I18N_HEADER` 覆盖）。
- **开发**：未设置 `VITE_API_BASE` 时，请求走相对路径 `/member/...`，由 Vite 代理到 **`http://192.168.0.222:38172`**（见 `vite.config.ts`）。
- **生产 / 直连**：设置 `VITE_API_BASE=http://192.168.0.222:38172`（或同源网关）。
- 算子包导入（IDE 插件）：`POST /member/commodity/importCommodity/operator`，`multipart` 字段 `file`。

## 目录

| 路径 | 说明 |
|------|------|
| `src/pages/HomePage.tsx` | 商城首页 / 商品栅格 |
| `src/pages/ProductDetailPage.tsx` | 商品详情（列表带入或分页查找） |
| `src/components/ProductCard.tsx` | 商品卡片 |
| `src/api/commodity.ts` | 列表 / 按 id 查找 |
| `src/api/config.ts` | `VITE_API_BASE`、`I18n` |
