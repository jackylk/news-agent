# 科技新闻小程序

一个微信小程序应用，自动收集和展示科技新闻。支持多平台部署（Zeabur、Railway、Vercel、Render 等）。

## 项目结构

```
news-agent/
├── server/              # 服务器端
│   ├── config/         # 配置文件
│   ├── models/         # 数据模型
│   ├── routes/         # API路由
│   ├── services/       # 业务逻辑（新闻收集）
│   ├── database/       # 数据库文件（自动生成）
│   ├── server.js       # 服务器入口
│   └── package.json    # 依赖配置
├── web/                # Web 前端
│   ├── index.html     # 新闻首页
│   ├── admin.html     # 管理后台
│   ├── dashboard.html # 用户面板
│   └── ...
├── miniprogram/        # 微信小程序前端
│   ├── pages/          # 页面
│   │   ├── index/      # 新闻列表页
│   │   └── detail/     # 新闻详情页
│   ├── utils/          # 工具函数
│   ├── app.js          # 小程序入口
│   └── app.json        # 小程序配置
├── Dockerfile          # Docker 构建文件
├── zeabur.json        # Zeabur 部署配置
└── railway.json       # Railway 部署配置
```

## 功能特性

- ✅ 自动收集科技新闻（RSS源 + 网页爬虫）
- ✅ 支持 Puppeteer 无头浏览器爬取 JavaScript 渲染页面
- ✅ AI 智能摘要（DeepSeek API）
- ✅ 用户认证与个性化订阅
- ✅ 主题管理与推荐
- ✅ 按日期分组展示新闻列表
- ✅ 新闻详情页面
- ✅ 定时任务自动收集（每天凌晨2点）
- ✅ RESTful API接口
- ✅ 管理后台
- ✅ PostgreSQL 数据库支持
- ✅ 前后端一体部署

## 🚀 快速部署

### 推荐方式：Zeabur（5 分钟部署）

**特点**：使用现有 Dockerfile、内置 PostgreSQL、前后端一体部署

📖 **快速开始**：见 [`ZEABUR_QUICK_START.md`](./ZEABUR_QUICK_START.md)（5 分钟上手）

📚 **详细文档**：见 [`ZEABUR_DEPLOY.md`](./ZEABUR_DEPLOY.md)（完整指南）

✅ **测试清单**：见 [`ZEABUR_TEST_CHECKLIST.md`](./ZEABUR_TEST_CHECKLIST.md)（部署后测试）

### 其他部署方式

- **Railway**：见 [`RAILWAY_DEPLOY.md`](./RAILWAY_DEPLOY.md)
- **Vercel**：见 [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)
- **Render**：见 [`DEPLOY.md`](./DEPLOY.md)（方案二）
- **本地部署**：见 [`LOCAL_DEPLOY.md`](./LOCAL_DEPLOY.md)

## 快速开始（本地开发）

### 1. 安装服务器依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
PORT=3000
DB_PATH=./database/news.db
CORS_ORIGIN=*
```

### 3. 启动服务器

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

### 4. 手动收集新闻（可选）

```bash
npm run collect
```

### 5. 配置小程序

1. 打开微信开发者工具
2. 导入项目，选择 `miniprogram` 目录
3. 修改 `miniprogram/app.js` 中的 `apiBaseUrl` 为你的服务器地址
4. 修改 `miniprogram/project.config.json` 中的 `appid` 为你的小程序AppID

## API接口

### 获取新闻列表
```
GET /api/news/list
```

返回按日期分组的新闻列表。

### 获取新闻详情
```
GET /api/news/:id
```

返回指定ID的新闻详情。

### 手动触发新闻收集
```
POST /api/collect
```

手动触发新闻收集任务。

## 定时任务

服务器会自动在每天凌晨2点收集新闻。你也可以通过API手动触发收集。

## 数据库

使用 SQLite 数据库，数据库文件会自动创建在 `server/database/news.db`。

## 注意事项

1. **小程序配置**：需要在微信公众平台配置服务器域名，将你的API服务器地址添加到request合法域名中。

2. **RSS源**：默认使用几个公开的RSS源，你可以根据需要修改 `server/services/newsCollector.js` 中的 `RSS_FEEDS` 数组。

3. **新闻API**：如果需要使用新闻API（如NewsAPI），需要：
   - 注册获取API Key
   - 在 `.env` 文件中设置 `NEWS_API_KEY`

4. **生产环境**：
   - 将服务器部署到云服务器
   - 修改小程序中的 `apiBaseUrl` 为生产环境地址
   - 配置HTTPS（小程序要求）

## 开发建议

- 可以根据需要添加更多RSS源
- 可以添加新闻分类功能
- 可以添加搜索功能
- 可以添加收藏功能
- 可以优化新闻内容提取算法

## License

MIT
# news-agent
