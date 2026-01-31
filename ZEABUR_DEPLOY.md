# Zeabur 部署指南

本文档介绍如何将新闻应用部署到 Zeabur。

## 前置要求

1. **GitHub 账号**，代码已推送到 GitHub 仓库
2. **Zeabur 账号**：https://zeabur.com
3. 数据库将使用 **Zeabur 内置 PostgreSQL**（推荐，支持数据持久化）

## 部署步骤

### 1. 创建项目并连接 GitHub

1. 访问 https://zeabur.com，使用 GitHub 登录
2. 点击 **New Project**（新建项目），输入项目名称如 `news-agent`
3. 进入项目后，点击 **Add Service**
4. 选择 **Deploy from GitHub**
5. 授权 Zeabur 访问你的 GitHub，选择 `news-agent` 仓库
6. **重要**：确认 **Root Directory**（根目录）设置为空或 `/`（即仓库根目录）
   - Zeabur 会自动检测根目录的 `Dockerfile` 进行构建
   - `Dockerfile` 已配置好从根目录复制 `server/` 和 `web/` 目录

### 2. 添加 Zeabur 内置 PostgreSQL

1. 在同一项目中，点击 **Add Service**（添加服务）
2. 选择 **Marketplace**（市场）
3. 搜索 **PostgreSQL**，选择并点击 **Deploy**
4. Zeabur 会自动创建 PostgreSQL 服务，数据存储在持久化卷中
5. **关键步骤**：在 PostgreSQL 服务页面，找到环境变量注入信息：
   - Zeabur 会自动将数据库连接信息注入到**同一项目内**的所有服务
   - 注入的变量包括：`POSTGRES_HOST`、`POSTGRES_PORT`、`POSTGRES_DATABASE`、`POSTGRES_USERNAME`、`POSTGRES_PASSWORD`
   - 可能还会注入 `DATABASE_URL`（完整连接字符串）

### 3. 配置应用服务使用数据库

**好消息**：本应用的 `server/config/database.js` 已支持 Zeabur PostgreSQL 自动注入的所有环境变量格式！

Zeabur PostgreSQL 会自动注入以下变量到同一项目内的服务：
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DATABASE`
- `POSTGRES_USERNAME`
- `POSTGRES_PASSWORD`

应用会**自动识别并使用**这些变量，**无需手动配置 DATABASE_URL**！

如果你希望使用 `DATABASE_URL` 格式（可选），可以在应用的环境变量中手动添加：

```bash
DATABASE_URL=postgresql://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}
```

但通常不需要这一步，应用会自动处理。

### 4. 配置其他必需环境变量

在 Zeabur 控制台打开你的**应用服务** → **Variables**（环境变量），配置以下变量：

**必需（安全相关）：**

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `JWT_SECRET` | 用户登录 Token 加密密钥，**生产环境务必使用强随机字符串** | 使用随机生成器生成 32 位以上字符串 |
| `ADMIN_TOKEN` | 管理后台访问令牌，**生产环境务必使用强密码** | 设置一个强密码 |

**数据库连接（自动识别）：**

无需手动配置！应用已支持 Zeabur PostgreSQL 注入的 `POSTGRES_*` 变量。

如果你使用的是其他数据库（如 Neon），可添加：

| 变量名 | 值 |
|--------|------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` |

**可选（功能增强）：**

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key（用于 AI 摘要功能） | 无则跳过摘要 |
| `NITTER_INSTANCES` | Twitter/X 抓取用的 Nitter 实例 URL，多个用逗号分隔 | 使用默认公共实例 |
| `CORS_ORIGIN` | 允许的跨域来源（若前后端分离部署才需要） | `*` |

**自动注入（无需手动设置）：**

| 变量名 | 说明 |
|--------|------|
| `PORT` | Zeabur 自动注入服务端口 |
| `NODE_ENV` | `zeabur.json` 中已设置为 `production` |

### 5. 部署与访问

1. **自动构建与部署**：
   - 保存环境变量后，Zeabur 会自动根据根目录的 `Dockerfile` 构建应用
   - 构建过程：安装 Node.js 20、Chromium（供爬虫使用）、复制 `server/` 和 `web/` 目录、安装依赖
   - 部署成功后，应用会自动连接 PostgreSQL 并初始化数据库表

2. **开启公网访问**：
   - 在应用服务中点击 **Networking** → **Generate Domain** 或 **Public Networking**
   - Zeabur 会分配一个 `*.zeabur.app` 的免费域名
   - 也可绑定自己的自定义域名

3. **访问应用**：
   - 前后端一体部署，访问分配的域名即可使用
   - 例如：`https://news-agent-xxxxx.zeabur.app`
   - 应用首页在 `/`，管理后台在 `/admin.html`

### 6. 验证部署

访问以下 URL 验证部署是否成功：

- **健康检查**：`https://你的域名/health` → 应返回 `{"status":"ok","message":"服务器运行正常"}`
- **应用首页**：`https://你的域名/` → 显示新闻列表页面
- **管理后台**：`https://你的域名/admin.html` → 输入 `ADMIN_TOKEN` 访问

如果无法访问，查看 Zeabur 控制台的**服务日志**排查问题。

## 项目结构说明（根目录部署）

本项目按**仓库根目录**部署，Zeabur 会自动检测并使用根目录的配置文件：

```
news-agent/（仓库根目录，Zeabur Root Directory 设为此处）
├── Dockerfile              ← Zeabur 用此构建镜像
├── zeabur.json            ← Zeabur 项目配置（可选，补充说明）
├── server/                ← 后端代码，Dockerfile 会 COPY 进镜像
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── database.js    ← 支持 DATABASE_URL 和 DB_* 环境变量
│   └── ...
└── web/                   ← 前端静态文件，Dockerfile 会 COPY 进镜像
    ├── index.html
    ├── admin.html
    └── ...
```

**关键点**：
- `Dockerfile` 在根目录，会复制 `server/` 和 `web/`，启动时 `server.js` 会以 Express 同时提供 API 和静态页面
- Zeabur 的 **Root Directory** 应设为 `/` 或留空（即仓库根目录）
- 无需手动修改前端 API 地址，前后端同域部署

## 注意事项

1. **数据库持久化**：
   - Zeabur PostgreSQL 使用持久化卷存储数据
   - 应用重新部署或容器重启**不会丢失**数据库数据
   - 数据与容器分离，只有删除 PostgreSQL 服务才会删除数据

2. **环境变量安全**：
   - `JWT_SECRET` 和 `ADMIN_TOKEN` 必须设为强随机值
   - **不要**使用文档示例值或简单密码
   - 可用工具生成：`openssl rand -hex 32`

3. **数据库连接**：
   - 应用已支持 Zeabur PostgreSQL 的 `POSTGRES_*` 变量，会自动连接
   - 也支持 `DATABASE_URL` 格式（如使用 Neon）
   - 还支持 `DB_*` 标准变量（通用格式）
   - 如遇连接问题，检查服务日志确认变量是否正确注入

4. **Puppeteer/Chromium**：
   - `Dockerfile` 已安装 Alpine 版 Chromium，适配 Puppeteer 无头浏览器爬虫
   - 若遇到爬虫问题，查看日志确认 Chromium 是否正常启动

5. **根目录部署**：
   - 确保 Zeabur 的 **Root Directory** 设为 `/` 或留空
   - 不要设为 `server/`，因为 `Dockerfile` 在根目录

## 故障排查

### 构建失败

**症状**：Zeabur 构建时报错 "Dockerfile not found" 或构建失败

**解决**：
1. 确认仓库根目录存在 `Dockerfile`（大小写敏感）
2. 确认 Zeabur 服务的 **Root Directory** 设为 `/` 或留空（不是 `server/`）
3. 确认 `server/package.json` 已提交到 Git 仓库

### 数据库连接失败

**症状**：应用日志显示 "数据库连接失败" 或 "未配置数据库连接"

**解决**：
1. 确认已在项目中添加 PostgreSQL 服务（Marketplace → PostgreSQL）
2. 查看 PostgreSQL 服务是否正常运行（显示绿色运行状态）
3. 确认应用服务和 PostgreSQL 服务在**同一个 Zeabur 项目**中
4. 查看应用日志，确认是否显示 "使用独立环境变量连接数据库"
5. 如果日志显示 "警告: 未配置数据库连接"，说明环境变量未正确注入：
   - 尝试重启应用服务
   - 或在应用环境变量中手动添加 `DATABASE_URL`（格式见步骤 3）

### 无法访问应用

**症状**：访问域名显示 502 Bad Gateway 或无法连接

**解决**：
1. 确认已在服务中开启 **Public Networking**（公网访问）
2. 查看服务日志，确认应用是否成功启动
3. 确认日志中显示的监听端口与 Zeabur 注入的 `PORT` 一致
4. 检查应用日志是否有启动错误

### 爬虫功能异常

**症状**：新闻抓取失败，日志显示 Puppeteer 错误

**解决**：
1. 确认 `Dockerfile` 中已安装 Chromium（已包含）
2. 查看日志中 Chromium 启动错误信息
3. 可能需要调整 Puppeteer 启动参数（在 `server/services/crawlers/PuppeteerHelper.js` 中）

### 查看日志

在 Zeabur 控制台：
1. 进入你的项目
2. 点击应用服务
3. 点击 **Logs**（日志）查看实时日志和历史日志

## 参考

- Zeabur 文档：https://zeabur.com/docs
- 使用 Dockerfile 部署：https://zeabur.com/docs/en-US/deploy/dockerfile
- 环境变量：https://zeabur.com/docs/en-US/deploy/variables
