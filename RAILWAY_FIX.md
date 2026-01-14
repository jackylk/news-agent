# Railway 部署数据库连接问题修复指南

## 错误信息
```
数据库连接失败: connect ECONNREFUSED ::1:5432
```

## 问题原因
这个错误表示应用试图连接到本地数据库（localhost:5432），说明 `DATABASE_URL` 环境变量未在 Railway 上正确设置。

## 解决方案

### 方案 1：使用 Neon（推荐）

1. **创建 Neon 数据库**
   - 访问 https://neon.tech
   - 使用 GitHub 账号登录
   - 创建新项目（Project）
   - 创建完成后，复制连接字符串

2. **在 Railway 中配置**
   - 打开 Railway 项目
   - 点击你的服务（Service）
   - 点击 "Variables" 标签
   - 点击 "New Variable"
   - 添加：
     - **Name**: `DATABASE_URL`
     - **Value**: 你的 Neon 连接字符串（格式类似：`postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`）
   - 点击 "Add"

3. **重新部署**
   - Railway 会自动检测环境变量变更并重新部署
   - 或者手动触发重新部署

### 方案 2：使用 Railway 内置 PostgreSQL

1. **添加 PostgreSQL 服务**
   - 在 Railway 项目中，点击 "New"
   - 选择 "Database"
   - 选择 "Add PostgreSQL"
   - Railway 会自动创建 PostgreSQL 数据库

2. **连接服务**
   - Railway 会自动将 PostgreSQL 服务的 `DATABASE_URL` 环境变量添加到你的应用服务
   - 如果未自动连接：
     - 点击你的应用服务
     - 点击 "Variables" 标签
     - 检查是否有 `DATABASE_URL` 变量
     - 如果没有，点击 PostgreSQL 服务，复制连接字符串，手动添加到应用服务

3. **重新部署**
   - Railway 会自动重新部署

## 验证配置

部署完成后，检查日志应该看到：
```
✅ 已连接到 PostgreSQL 数据库
数据库表初始化完成
```

而不是：
```
❌ 数据库连接失败: connect ECONNREFUSED ::1:5432
```

## 常见问题

### Q: 如何查看 Railway 环境变量？
A: 在 Railway 项目中，点击你的服务 → "Variables" 标签

### Q: Neon 连接字符串在哪里？
A: 在 Neon 控制台中，点击你的项目 → "Connection Details" → 复制连接字符串

### Q: Railway PostgreSQL 的连接字符串在哪里？
A: Railway 会自动设置，在应用服务的 "Variables" 中查看 `DATABASE_URL`

### Q: 环境变量设置后还是连接失败？
A: 
1. 确认连接字符串格式正确（以 `postgresql://` 开头）
2. 确认数据库服务正在运行
3. 检查 Railway 日志中的详细错误信息
4. 尝试重新部署服务
