# 个人信息整理网站 - 迁移指南

## 概述

网站已从"新闻聚合网站"改造为"个人信息整理网站"，支持用户个性化订阅和管理。

## 主要变更

### 1. 数据库结构

新增了以下表：
- `users`: 用户表（用户名、邮箱、密码哈希、管理员标识）
- `user_topics`: 用户主题表（用户关注的关键词）
- `user_subscriptions`: 用户订阅表（用户订阅的信息源）
- `news` 表新增 `user_id` 字段，用于关联用户

### 2. 用户认证系统

- **注册**: `POST /api/auth/register`
- **登录**: `POST /api/auth/login`
- **获取当前用户**: `GET /api/auth/me`

使用 JWT token 进行身份验证，token 有效期 7 天。

### 3. 主题管理

- **添加主题**: `POST /api/user/topics`
- **获取主题列表**: `GET /api/user/topics`
- **推荐信息源**: `POST /api/user/topics/recommend`

用户输入关注的关键词后，系统通过 DeepSeek API 推荐优质信息源。

### 4. 订阅管理

- **添加订阅**: `POST /api/user/subscriptions`
- **获取订阅列表**: `GET /api/user/subscriptions`
- **删除订阅**: `DELETE /api/user/subscriptions/:sourceName`

### 5. 新闻收集

- 改为按用户订阅收集，每 10 分钟执行一次
- 每个用户只收集其订阅的信息源
- 新闻数据关联到用户（`user_id` 字段）

## 安装新依赖

```bash
cd server
npm install bcrypt jsonwebtoken
```

## 环境变量

在 `.env` 文件中添加：

```env
JWT_SECRET=your-secret-key-change-in-production
DEEPSEEK_API_KEY=your-deepseek-api-key
```

## 数据库迁移

数据库表会在服务器启动时自动创建。如果已有数据：

1. 备份现有数据
2. 运行服务器，新表会自动创建
3. `news` 表的 `user_id` 字段会自动添加（已有数据为 NULL）

## API 使用示例

### 用户注册

```bash
curl -X POST http://localhost:3030/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 用户登录

```bash
curl -X POST http://localhost:3030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### 添加主题并获取推荐

```bash
# 1. 添加主题
curl -X POST http://localhost:3030/api/user/topics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "keywords": "人工智能 机器学习"
  }'

# 2. 获取推荐信息源
curl -X POST http://localhost:3030/api/user/topics/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "keywords": "人工智能 机器学习"
  }'
```

### 添加订阅

```bash
curl -X POST http://localhost:3030/api/user/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subscriptions": [
      {
        "sourceName": "OpenAI Blog",
        "sourceUrl": "https://openai.com/news/rss.xml",
        "sourceType": "rss",
        "category": "AI研究"
      }
    ]
  }'
```

### 获取新闻列表（需要登录）

```bash
curl -X GET "http://localhost:3030/api/news/list" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 前端更新

前端界面需要更新以支持：
1. 用户注册/登录页面
2. 主题管理界面（输入关键词、查看推荐、选择订阅）
3. 个人订阅管理界面
4. 按用户过滤的新闻列表

## 管理员功能

管理员可以：
- 查看所有用户列表
- 管理用户（待实现）

## 注意事项

1. **JWT Secret**: 生产环境必须使用强密码
2. **密码安全**: 使用 bcrypt 加密存储
3. **API 限流**: 建议添加 API 限流保护
4. **DeepSeek API**: 确保 API Key 有效且有足够额度

## 下一步

1. 更新前端界面（登录/注册、主题管理）
2. 完善管理员用户管理功能
3. 添加 API 限流
4. 优化新闻收集性能
