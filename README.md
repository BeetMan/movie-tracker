# 观影数据库（Movie Tracker）

个人影院观影记录管理应用。记录每一场电影：片名、日期、影院、影厅、座位、票价（多币种）、制式（IMAX / 杜比视界 / CINITY / 中国巨幕 / 4DX 等），并生成观影统计图表。支持票根截图识别自动填表。

纯前端，无后端，数据保存在浏览器 localStorage。

## 功能

- **记录管理**：观影记录的增删改查，支持搜索、筛选、排序
- **统计概览**：按年份 / 制式 / 地区 / 影院等维度的图表统计（recharts）
- **票根识别**（双模式）：
  - **AI 模式**：浏览器直连 Moonshot API（OpenAI 兼容 vision 格式），Key 存 localStorage，模型默认 `kimi-latest`
  - **本地 OCR**：tesseract.js 纯浏览器端识别，中英文语言包内置（`public/tessdata/`），无需联网
- **数据导入导出**：JSON / CSV 导出备份，JSON 导入恢复，可一键重置为内置演示数据
- **深 / 浅双主题**：跟随系统或手动切换，无闪烁
- **多币种票价**：CNY / HKD / MOP / TWD / USD / EUR / JPY / KRW

## 技术栈

React 19 · TypeScript · Vite 7 · Tailwind CSS 3.4 · shadcn/ui · react-router v7 · recharts · sonner · tesseract.js 7

## 开发

```bash
npm install      # 还原依赖
npm run dev      # 开发服务器
npm run build    # 构建（产物在 dist/）
npm run lint     # ESLint
```

## 数据说明

- 内置 `src/data/movies.json` 为演示数据；运行时的增删改全部写入 localStorage（key：`movie-db-v1`），读取优先级：localStorage > 内置 JSON
- 通过页面「设置 → 导出」可随时备份为 JSON / CSV；「导入」可恢复数据
- 所有数据均保存在你自己的浏览器中，不会上传到任何服务器

## License

[MIT](LICENSE)
