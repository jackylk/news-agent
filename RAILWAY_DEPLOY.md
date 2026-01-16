# Railway 部署指南

本文档介绍如何将新闻应用部署到 Railway。

## 前置要求

1. GitHub 账号
2. Railway 账号（https://railway.app）
3. Neon 账号（用于 PostgreSQL 数据库，https://neon.tech）或使用 Railway 内置 PostgreSQL

## 部署步骤

### 1. 准备代码仓库

确保代码已推送到 GitHub 仓库。

### 2. 创建 Neon 数据库（推荐）

1. 访问 https://neon.tech
2. 使用 GitHub 账号登录
3. 创建新项目（Project）
4. 创建完成后，复制连接字符串，格式类似：
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

### 3. 在 Railway 上部署

1. **创建新项目**
   - 访问 https://railway.app
   - 使用 GitHub 账号登录
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的代码仓库

2. **配置环境变量**
   
   在 Railway 项目设置中，点击 "Variables"，添加以下环境变量：

   **必需的环境变量：**
   ```
   DATABASE_URL=你的Neon连接字符串
   # 或使用 Railway PostgreSQL（会自动设置 DATABASE_URL）
   ```

   **可选的环境变量：**
   ```
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN=*
   DEEPSEEK_API_KEY=你的DeepSeek API Key
   JWT_SECRET=你的JWT密钥（生产环境请使用强密码）
   ADMIN_TOKEN=你的管理员令牌（生产环境请使用强密码）
   ```

3. **使用 Railway PostgreSQL（推荐，更稳定）**
   
   Railway PostgreSQL 支持数据持久化，重新部署不会丢失数据：
   - 点击 "New" → "Database" → "Add PostgreSQL"
   - Railway 会自动创建数据库并设置 `DATABASE_URL` 环境变量
   - 数据存储在持久化卷中，容器重启或应用重新部署都不会丢失数据
   - 无需手动配置，Railway 会自动处理连接
   
   **数据持久化说明：**
   - ✅ Railway PostgreSQL 使用持久化卷存储数据
   - ✅ 重新部署后端应用时，数据库数据**不会丢失**
   - ✅ 数据与容器分离，即使容器重启数据也会保留
   - ✅ 只有明确删除数据库服务才会删除数据
   
   详细说明请参考：`RAILWAY_POSTGRESQL_SETUP.md`

4. **部署配置**
   
   Railway 会自动检测 `railway.json` 配置文件：
   - 根目录：`server`
   - 启动命令：`npm start`
   - Node.js 版本：20+

### 4. 部署完成

部署完成后，Railway 会：
- 自动构建应用
- 启动服务器
- 提供 `.railway.app` 域名
- 自动连接数据库并创建表结构

### 5. 访问应用

部署完成后，Railway 会提供一个 URL，例如：
```
https://your-app-name.up.railway.app
```

访问该 URL 即可使用应用。

## 配置文件说明

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "rootDirectory": "server",
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### nixpacks.toml

Railway 使用 Nixpacks 构建，配置文件已设置：
- Node.js 版本：20+
- 工作目录：server
- 启动命令：npm start

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 数据库连接字符串 |
| `PORT` | ❌ | 服务器端口（默认：3000） |
| `NODE_ENV` | ❌ | 环境模式（production/development） |
| `CORS_ORIGIN` | ❌ | CORS 允许的源（默认：*） |
| `DEEPSEEK_API_KEY` | ❌ | DeepSeek API 密钥（用于AI推荐） |
| `JWT_SECRET` | ❌ | JWT 令牌加密密钥 |
| `ADMIN_TOKEN` | ❌ | 管理员访问令牌 |

## 数据库初始化

首次部署时，应用会自动：
1. 连接到 PostgreSQL 数据库
2. 创建所需的表结构（news, users, user_topics, user_subscriptions, recommendation_history）
3. 创建必要的索引

## 定时任务

应用包含定时任务，每30分钟自动收集新闻。Railway 会保持应用运行，定时任务会自动执行。

## 故障排查

### 1. 数据库连接失败

- 检查 `DATABASE_URL` 环境变量是否正确
- 确认数据库服务是否正常运行
- 检查网络连接

### 2. 应用无法启动

- 检查 Node.js 版本是否为 20+
- 查看 Railway 日志，查找错误信息
- 确认所有依赖已正确安装

### 3. API 请求失败

- 检查 CORS 配置
- 确认 API 路由是否正确
- 查看服务器日志

## 更新部署

代码推送到 GitHub 后，Railway 会自动：
1. 检测代码变更
2. 重新构建应用
3. 重新部署

无需手动操作。

## 自定义域名

Railway 支持自定义域名：
1. 在项目设置中点击 "Settings"
2. 找到 "Domains" 部分
3. 添加你的自定义域名
4. 按照提示配置 DNS 记录

## 监控和日志

- Railway 提供实时日志查看
- 可以在项目页面查看应用状态
- 支持日志搜索和过滤

## 注意事项

1. **数据库备份**：定期备份数据库，Neon 提供自动备份功能
2. **API 密钥安全**：不要在代码中硬编码 API 密钥，使用环境变量
3. **JWT Secret**：生产环境必须使用强密码
4. **管理员令牌**：生产环境必须使用强密码
5. **免费额度**：Railway 和 Neon 都有免费额度，注意使用量

## 推荐配置

### 最小配置（仅必需）

```
DATABASE_URL=你的数据库连接字符串
```

### 完整配置（推荐）

```
DATABASE_URL=你的数据库连接字符串
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
DEEPSEEK_API_KEY=你的DeepSeek API Key
JWT_SECRET=强密码（至少32个字符）
ADMIN_TOKEN=强密码（至少16个字符）
```

## 支持

如有问题，请查看：
- Railway 文档：https://docs.railway.app
- Neon 文档：https://neon.tech/docs
- 项目 README.md
