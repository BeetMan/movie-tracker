# 观影数据库（Movie Tracker）

[![CI](https://github.com/BeetMan/movie-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/BeetMan/movie-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.1-amber)](https://github.com/BeetMan/movie-tracker/releases)

个人影院观影记录管理应用。记录每一场电影：片名、日期、影院、影厅、座位、票价（多币种）、制式（IMAX / 杜比视界 / CINITY / 中国巨幕 / 4DX 等），并生成观影统计图表。支持票根截图识别自动填表、TMDB 海报墙。

纯前端，无后端，数据保存在浏览器 localStorage，不上传任何服务器。

**在线体验**：<https://beetya.ng/movie/>（内置 185 条演示数据，打开即用）

## 功能

- **记录管理**：增删改查，搜索、多维度筛选（年份 / 地区 / 制式 / 影院）、排序、分页
  - 删除后可「撤销」；新增时自动检测同片名同日期的疑似重复记录
  - 复选批量操作：批量删除（可撤销）、批量修改地区
  - 移动端自动切换为卡片布局，桌面端为表格
  - 连续录入模式：「保存并继续下一张」，攒票根批量补录不中断
  - 快捷键：`N` 记一笔、`/` 聚焦搜索
- **分享图生成**（canvas）：单条记录生成票根风卡片 PNG；一键生成「年度观影报告」长图（大数字、同比、制式分布、日历热力、海报条、条码编号），均可下载
- **海报墙**（TMDB）：按片名去重展示海报，年份筛选、二刷角标；错配可手动换海报，匹配结果缓存本地；记录列表同步显示海报缩略图
- **统计概览**（recharts）：总览卡片、年度 & 月度场次与花费趋势、制式分布饼图、常去影院 TOP 10、二刷影片榜、年度观影日历热力图、与上一年的同期对比
- **票根识别**（双模式）：
  - **AI 模式**：浏览器直连视觉大模型（OpenAI 兼容格式），支持 **Moonshot（Kimi）/ DeepSeek** 两家服务方，Key 与模型各自独立存储；自动适配锁死 `temperature=1` 的新模型
  - **本地 OCR**：tesseract.js 纯浏览器端离线识别，引擎 / WASM / 中英文语言包全部自托管（`public/tess`、`public/tessdata`），不依赖 CDN
  - 识别完成后 toast 列出自动填了哪些字段
- **数据安全**：
  - JSON / CSV 导出备份；导入可选「合并」（按 片名+日期+影院+座位 去重）或「整体替换」
  - 设置备份：识别方式、各服务方 Key / 模型、主题、海报匹配缓存一键导出/导入
  - 超过 30 天未导出时显示备份提醒横幅
  - 全局错误边界兜底，崩溃页面也可一键导出数据
- **多币种票价**：CNY / HKD / MOP / TWD / USD / EUR / JPY / KRW，统计时分币种汇总
- **深 / 浅双主题**：手动切换，写入 localStorage，首屏无闪烁

## 技术栈

React 19 · TypeScript · Vite 7 · Tailwind CSS 3.4 · shadcn/ui · react-router v7 · recharts · sonner · tesseract.js 7

## 开发

```bash
npm install      # 还原依赖
npm run dev      # 开发服务器（localhost:3000）
npm run build    # 构建（产物在 dist/）
npm run lint     # ESLint
npm test         # vitest 单元测试
```

## 项目结构

```
src/
├── data/movies.json        # 内置演示数据（185 条）
├── types/movie.ts          # 数据模型、制式词表与归类、币种、日期归一化
├── hooks/
│   ├── useMovies.ts        # 数据层：CRUD、合并导入、localStorage 持久化、导入导出
│   └── useTheme.ts         # 主题切换 + recharts 图表配色
├── lib/
│   ├── vision.ts           # AI 票根识别（服务方注册表：Moonshot / DeepSeek）
│   ├── ocr.ts              # 本地 OCR 票根识别（tesseract.js，全自托管）
│   ├── tmdb.ts             # TMDB 海报匹配 + 可订阅的本地缓存 store
│   ├── settings.ts         # 设置导出/导入
│   └── stats.ts            # 统计聚合函数
├── sections/               # 记录表格 / 表单 / 统计 / 海报墙 / 设置
├── components/
│   ├── ErrorBoundary.tsx   # 全局错误边界（带数据导出逃生按钮）
│   └── ui/                 # shadcn/ui 组件
└── pages/Home.tsx          # 主页面
public/
├── tess/                   # 自托管 OCR 引擎（worker + WASM 核心）
└── tessdata/               # 中英文语言包
```

## 数据说明

- 运行时数据存 localStorage（key：`movie-db-v1`），读取优先级：localStorage > 内置 `movies.json`
- 建议定期通过「导出 JSON」备份；清除浏览器数据会导致记录丢失
- 迁移设备：旧设备导出 JSON + 设置备份 → 新设备分别导入，海报匹配结果也一并带走

## 部署

### 通用静态托管

`npm run build` 产物在 `dist/`，base 为相对路径 `./`，可直接丢到任意静态托管（含子目录）。

### Cloudflare（子路径部署，例如 `your-domain.com/movie/`）

仓库内不含任何个人域名配置，按以下步骤部署到你自己的域名：

```bash
cp wrangler.toml.example wrangler.toml   # 生成你自己的配置
# 编辑 wrangler.toml：routes 改成你的域名和路径，zone_name 改成你的域名，
#                     [vars] BASE_PATH 改成你的子路径（不带尾斜杠）

# package.json 里 build:cf 脚本的 --base 也要改成同一路径（带首尾斜杠，如 /movie/）
npm run build:cf
npx wrangler deploy                      # 首次会引导 OAuth 登录
```

原理：`worker.js` 是一个通用的子路径前缀剥离器（从 `BASE_PATH` 读取），配合静态资产 Worker 把应用挂到已有站点的子路径下，不影响域名上其他内容。注意 `routes` 是 TOML 顶层字段，必须写在 `[assets]` 表之前。

## License

[MIT](LICENSE)
