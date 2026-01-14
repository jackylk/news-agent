# 新闻代理服务器

## 数据库说明

本项目使用 PostgreSQL 数据库，支持多种 PostgreSQL 服务：

### 推荐：Neon Serverless PostgreSQL

- **Serverless**：按使用量计费，不使用时自动暂停
- **免费层**：512MB 存储，每月 0.5 小时计算时间
- **自动扩展**：根据负载自动扩展
- **数据持久化**：数据存储在云端，容器重启不会丢失数据
- **易于使用**：只需一个连接字符串即可

### 其他选项

- **Railway PostgreSQL**：Railway 内置的 PostgreSQL 服务
- **本地 PostgreSQL**：用于本地开发

### 为什么使用 PostgreSQL？

- **持久化存储**：数据存储在独立服务中，容器重启不会丢失数据
- **生产环境友好**：更适合生产环境，支持并发访问
- **标准兼容**：支持所有 PostgreSQL 兼容的服务（Neon、Railway、Supabase 等）

### 使用 Neon（推荐）

1. **注册并创建 Neon 数据库**
   - 访问 https://neon.tech
   - 使用 GitHub 账号登录
   - 创建新项目（Project）
   - 复制连接字符串

2. **配置环境变量**
   - 在 Railway 或本地 `.env` 文件中设置：
     ```bash
     DATABASE_URL=你的Neon连接字符串
     ```

3. **启动应用**
   - 应用会自动连接 Neon 数据库
   - 首次启动会自动创建表结构

### 本地开发设置

**方式1：使用 Neon（推荐，无需本地安装）**
```bash
# 1. 在 Neon 创建数据库并获取连接字符串
# 2. 创建 .env 文件
DATABASE_URL=你的Neon连接字符串
PORT=3000
CORS_ORIGIN=*

# 3. 安装依赖并启动
npm install
npm start
```

**方式2：使用本地 PostgreSQL**
```bash
# 1. 安装 PostgreSQL
# macOS
brew install postgresql
brew services start postgresql

# 或使用 Docker
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres

# 2. 创建数据库
createdb news_db

# 3. 配置环境变量（创建 .env 文件）
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/news_db
PORT=3000
CORS_ORIGIN=*

# 4. 安装依赖并启动
npm install
npm start
```

### Railway 部署设置

**使用 Neon：**
1. 在 Neon 创建数据库并获取连接字符串
2. 在 Railway 项目设置中添加环境变量：`DATABASE_URL=你的Neon连接字符串`
3. 部署应用，会自动连接 Neon 数据库

**使用 Railway PostgreSQL：**
1. 在 Railway 项目中，点击 "New" → "Database" → "Add PostgreSQL"
2. Railway 会自动设置 `DATABASE_URL` 环境变量
3. 无需额外配置，应用会自动连接数据库

### 数据库表结构

```sql
CREATE TABLE news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  source TEXT,
  url TEXT UNIQUE,
  image_url TEXT,
  publish_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 主要变更

- 参数占位符：从 `?` 改为 `$1, $2, $3...`
- 日期函数：`DATE()` 在 PostgreSQL 中同样支持
- 搜索函数：从 `instr()` 改为 `ILIKE`（不区分大小写）
- 自增ID：从 `AUTOINCREMENT` 改为 `SERIAL`
