# 部署指南

本文档介绍如何将新闻应用部署到云端。

## 方案一：Railway + Neon（推荐，Serverless PostgreSQL）

Railway 支持 Node.js 应用，Neon 提供 Serverless PostgreSQL 数据库服务。

### 步骤：

1. **注册 Railway 账号**
   - 访问 https://railway.app
   - 使用 GitHub 账号登录

2. **注册 Neon 账号并创建数据库**
   - 访问 https://neon.tech
   - 使用 GitHub 账号登录（推荐）
   - 创建新项目（Project）
   - 创建完成后，Neon 会提供一个连接字符串，格式类似：
     ```
     postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
     ```
   - 复制这个连接字符串，稍后会在 Railway 中使用

3. **在 Railway 上创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的代码仓库

4. **配置 Neon 数据库连接**
   - 在 Railway 项目设置中，点击 "Variables"
   - 添加环境变量：
     ```
     DATABASE_URL=你的Neon连接字符串
     ```
   - 例如：
     ```
     DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
     ```

5. **配置其他环境变量（可选）**
   - 如需其他环境变量，在项目设置中添加：
     ```
     PORT=3000
     NODE_ENV=production
     CORS_ORIGIN=*
     ```

6. **部署**
   - Railway 会自动检测 `package.json` 并部署
   - 部署完成后会提供一个 `.railway.app` 域名
   - 首次部署后，服务器会自动连接 Neon 数据库并创建表结构
   - 服务器启动时会自动收集新闻并存储到 Neon 数据库

7. **配置前端**
   - 修改 `web/index.html` 中的 `API_BASE_URL` 为你的 Railway 域名
   - 或者将前端也部署到 Railway 或 Vercel

### 优点：
- ✅ Neon 免费层：512MB 存储，每月 0.5 小时计算时间
- ✅ Serverless：按使用量计费，不使用时自动暂停
- ✅ 数据持久化：数据存储在 Neon 云端，容器重启不会丢失
- ✅ 自动扩展：根据负载自动扩展
- ✅ Railway 自动部署和 HTTPS
- ✅ 支持数据库分支和即时恢复

### 替代方案：使用 Railway 内置 PostgreSQL

如果你不想使用 Neon，也可以使用 Railway 内置的 PostgreSQL：

1. 在 Railway 项目中，点击 "New" → "Database" → "Add PostgreSQL"
2. Railway 会自动创建 PostgreSQL 数据库并设置 `DATABASE_URL` 环境变量
3. 无需手动配置，直接使用即可

---

## 方案二：Render（免费，推荐）

Render 提供免费层，适合中小型应用。

### 步骤：

1. **注册 Render 账号**
   - 访问 https://render.com
   - 使用 GitHub 账号登录

2. **创建 Web Service**
   - 点击 "New +" → "Web Service"
   - 连接你的 GitHub 仓库
   - 选择 `server` 目录作为根目录

3. **配置**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

4. **环境变量**
   - 添加环境变量：
     ```
     PORT=10000
     NODE_ENV=production
     ```

5. **部署**
   - 点击 "Create Web Service"
   - 等待部署完成

6. **定时任务（可选）**
   - 可以创建一个 Cron Job 来定期收集新闻
   - 或者使用外部服务如 cron-job.org

### 优点：
- ✅ 完全免费
- ✅ 自动 HTTPS
- ✅ 自动部署

---

## 方案三：Vercel（前端）+ Railway/Render（后端）

将前端和后端分开部署。

### 步骤：

1. **部署后端**（使用 Railway 或 Render，参考方案一或二）

2. **部署前端到 Vercel**
   - 访问 https://vercel.com
   - 导入你的 GitHub 仓库
   - 设置：
     - Framework Preset: Other
     - Root Directory: `web`
     - Build Command: 留空
     - Output Directory: `.`

3. **配置 API 地址**
   - 修改 `web/index.html` 中的 `API_BASE_URL` 为后端地址

### 优点：
- ✅ 前端全球 CDN 加速
- ✅ 后端独立部署
- ✅ 完全免费

---

## 方案四：Zeabur（推荐，一键部署）

Zeabur 支持从 GitHub 一键部署，使用根目录 Dockerfile 构建，并支持内置 PostgreSQL。

### 步骤：

1. **注册 Zeabur 账号**：访问 https://zeabur.com，使用 GitHub 登录
2. **创建项目**：New Project → Deploy from GitHub → 选择 `news-agent` 仓库
3. **添加 PostgreSQL**：Add Service → Marketplace → PostgreSQL（或使用 Neon 并设置 `DATABASE_URL`）
4. **配置环境变量**：在应用服务中设置 `DATABASE_URL`（若用 Zeabur PostgreSQL 且已连接可能已自动注入）、`JWT_SECRET`、`ADMIN_TOKEN` 等
5. **部署**：Zeabur 会自动检测 Dockerfile 并构建、部署，提供 `*.zeabur.app` 域名

详细步骤、环境变量说明和故障排查见 **`ZEABUR_DEPLOY.md`**。

### 优点：
- ✅ 使用现有 Dockerfile，无需改构建方式
- ✅ 支持 Zeabur 内置 PostgreSQL 或 Neon
- ✅ 前后端一体部署，同一域名
- ✅ 自动 HTTPS 与域名

---

## 方案五：使用 Docker（适合 VPS）

如果你有自己的服务器，可以使用 Docker 部署。

### 步骤：

1. **创建 Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY server/package*.json ./
   RUN npm install
   COPY server/ .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **创建 docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       volumes:
         - ./server/database:/app/database
       environment:
         - NODE_ENV=production
         - PORT=3000
   ```

3. **部署**
   ```bash
   docker-compose up -d
   ```

---

## 部署前准备

### 1. 修改前端 API 地址

部署后，需要修改 `web/index.html` 中的 API 地址：

```javascript
const API_BASE_URL = 'https://your-backend-url.com/api';
```

### 2. 配置 CORS

确保服务器允许前端域名的请求。在 `server/server.js` 中：

```javascript
app.use(cors({
  origin: ['https://your-frontend-url.com', 'http://localhost:3000']
}));
```

### 3. 环境变量

创建 `.env` 文件（不要提交到 Git）：

```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.com
```

### 4. 数据库持久化

确保数据库文件会被持久化保存。在云平台上，可能需要使用卷（Volume）来保存数据库文件。

---

## 推荐方案

**对于快速部署，推荐使用 Zeabur 或 Railway**：
- **Zeabur**：使用现有 Dockerfile，支持内置 PostgreSQL，前后端一体部署，详见 `ZEABUR_DEPLOY.md`
- **Railway**：一键部署，支持定时任务，免费额度足够使用，详见 `RAILWAY_DEPLOY.md`

**如果需要更好的前端性能，推荐 Vercel + Railway/Zeabur**：
- 前端全球 CDN
- 后端稳定运行

---

## 注意事项

1. **数据库备份**：定期备份 SQLite 数据库文件
2. **定时任务**：确保定时任务在云平台上正常运行
3. **日志监控**：关注应用日志，及时发现问题
4. **API 限流**：考虑添加 API 限流保护
5. **HTTPS**：确保使用 HTTPS（云平台通常自动提供）

---

## 快速开始（Railway）

1. 在 GitHub 上创建仓库并推送代码
2. 访问 https://railway.app 并登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你的仓库
5. 等待部署完成
6. 复制提供的域名
7. 修改前端 `API_BASE_URL` 并重新部署前端

完成！
