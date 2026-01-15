# 本地部署指南

## 前置要求

- Node.js 20+ 
- npm 或 yarn

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

`.env` 文件已创建，包含以下配置：

- `DATABASE_URL`: Neon 数据库连接字符串（已配置 pooler 连接）
- `PORT`: 服务器端口（默认 3000）
- `DEEPSEEK_API_KEY`: DeepSeek API 密钥（用于文章摘要）
- `ADMIN_TOKEN`: 管理员令牌（用于管理界面）

### 3. 测试数据库连接

```bash
cd server
node test-db-connection.js
```

或者直接使用连接字符串：

```bash
node test-db-connection.js "postgresql://..."
```

### 4. 启动服务器

```bash
cd server
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

### 5. 访问应用

- **用户界面**: http://localhost:3000
- **管理界面**: http://localhost:3000/admin.html
- **API 文档**: 
  - 新闻列表: `GET http://localhost:3000/api/news/list`
  - 新闻详情: `GET http://localhost:3000/api/news/:id`
  - 管理员接口: `GET http://localhost:3000/api/admin/stats` (需要 `x-admin-token` 头)

## 数据库连接信息

当前使用的 Neon 数据库连接：
- **类型**: Pooler 连接（推荐用于 serverless 环境）
- **连接字符串**: 已配置在 `.env` 文件中
- **状态**: ✅ 测试通过
- **数据**: 当前有 1285 条新闻

## 常见问题

### 连接超时

如果遇到连接超时错误：
1. 检查网络连接
2. 确认 Neon 数据库服务正常
3. 连接超时已设置为 60 秒

### 环境变量未加载

确保：
1. `.env` 文件在 `server/` 目录下
2. 服务器使用 `require('dotenv').config()` 加载环境变量

### 端口被占用

如果 3000 端口被占用，可以修改 `.env` 文件中的 `PORT` 值。

## 下一步

1. 测试新闻收集功能：访问管理界面，手动触发新闻刷新
2. 查看新闻列表：访问用户界面
3. 测试翻译和摘要功能：打开一篇英文新闻，测试翻译和摘要按钮
