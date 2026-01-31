# Railway 快速部署指南

本项目已配置好 Railway 部署，只需几步即可完成部署。

## 🚀 快速开始

### 1. 推送代码到 GitHub

```bash
git push origin main
```

### 2. 在 Railway 上创建项目

1. 访问 [Railway](https://railway.app)
2. 使用 GitHub 账号登录
3. 点击 **"New Project"**
4. 选择 **"Deploy from GitHub repo"**
5. 选择 `news-agent` 仓库

### 3. 添加 PostgreSQL 数据库

1. 在 Railway 项目页面，点击 **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway 会自动创建数据库并设置 `DATABASE_URL` 环境变量
3. 等待数据库创建完成（约 1-2 分钟）

### 4. 配置环境变量（可选）

在项目的 **"Variables"** 中添加以下可选环境变量：

```
DEEPSEEK_API_KEY=你的DeepSeek API Key（用于AI推荐）
JWT_SECRET=强密码（至少32个字符）
ADMIN_TOKEN=强密码（至少16个字符）
```

### 5. 部署完成

Railway 会自动：
- 构建 Docker 镜像
- 启动应用
- 提供访问 URL（例如：`https://your-app.railway.app`）

## ✅ 验证部署

访问 Railway 提供的 URL，应该看到应用首页。

## 📚 详细文档

- [完整部署指南](./RAILWAY_DEPLOY.md)
- [PostgreSQL 设置](./RAILWAY_POSTGRESQL_SETUP.md)
- [环境变量配置](./server/env.example)

## 🔧 配置文件

本项目使用以下配置文件：

- `railway.json` - Railway 部署配置
- `Dockerfile` - Docker 构建配置
- `nixpacks.toml` - Nixpacks 构建配置（备用）
- `.dockerignore` - Docker 忽略文件

## 💡 提示

1. **数据持久化**：Railway PostgreSQL 使用持久化卷，重新部署不会丢失数据
2. **自动部署**：推送到 GitHub 后会自动触发部署
3. **日志查看**：在 Railway 控制台可以实时查看日志
4. **免费额度**：Railway 提供免费额度，足够测试和小型项目使用

## ❓ 遇到问题？

查看 [Railway 部署指南](./RAILWAY_DEPLOY.md) 中的"故障排查"部分。
