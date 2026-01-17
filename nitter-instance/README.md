# Nitter 实例部署

这是用于在Railway上部署Nitter实例的配置文件。

## 什么是Nitter？

Nitter是一个开源的Twitter/X前端替代工具，可以将Twitter用户页面转换为RSS源。

## 部署到Railway

### 前置要求

1. GitHub账号
2. Railway账号（https://railway.app）
3. 本仓库已推送到GitHub

### 部署步骤

#### 1. 在Railway项目中添加Redis服务

1. 登录Railway，进入你的项目
2. 点击 "New" → "Database" → "Add Redis"
3. Railway会自动创建Redis实例
4. 记下Redis连接URL（会在环境变量中自动设置）

#### 2. 在Railway项目中添加Nitter服务

1. 在Railway项目中，点击 "New" → "GitHub Repo"
2. 选择本仓库（nitter-instance）
3. Railway会自动检测Dockerfile并开始构建

#### 3. 配置环境变量

在Nitter服务的设置中，添加以下环境变量：

**必需的环境变量：**

```bash
# Redis连接（方式1：使用完整URL，推荐）
REDIS_URL=redis://default:password@redis-service.railway.internal:6379

# 或者方式2：分别设置（如果REDIS_URL不可用）
REDIS_HOST=redis-service.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Nitter域名（部署后，在服务设置中查看Public URL）
# 格式：your-nitter-service.railway.app
NITTER_DOMAIN=your-nitter-service.railway.app

# HMAC密钥（生成随机字符串）
NITTER_HMAC_KEY=your-hmac-key-here

# Base64密钥（生成随机base64字符串）
NITTER_BASE64SECRET=your-base64-secret-here
```

**生成密钥：**

```bash
# 生成HMAC Key
openssl rand -hex 32

# 生成Base64 Secret
openssl rand -base64 32
```

**可选的环境变量：**

```bash
NITTER_TITLE=Nitter
NITTER_THEME=auto
PORT=8080  # Railway会自动设置，无需手动配置
```

**获取Redis连接信息：**

1. 在Railway项目中，点击Redis服务
2. 在"Variables"标签页中，查找以下变量：
   - `REDIS_URL` - 完整的Redis连接URL
   - 或者 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 等单独变量
3. 将这些值复制到Nitter服务的环境变量中

**注意**：如果Redis服务在同一Railway项目中，可以使用内部服务名：
- 内部服务名格式：`redis-service.railway.internal`
- 或者使用Railway提供的连接变量

#### 5. 获取Nitter实例URL

部署完成后，Railway会提供一个URL，例如：
```
https://your-nitter-service.railway.app
```

#### 6. 测试Nitter实例

访问以下URL测试：
- 主页：`https://your-nitter-service.railway.app`
- 用户RSS：`https://your-nitter-service.railway.app/OpenAI/rss`
- 用户页面：`https://your-nitter-service.railway.app/OpenAI`

#### 7. 在网站后台添加实例

1. 登录网站管理后台
2. 进入"Nitter管理"页签
3. 点击"添加Nitter实例"
4. 输入Nitter实例URL
5. 点击"测试"验证可用性

## 本地测试

使用Docker Compose在本地测试：

```bash
# 生成密钥
export NITTER_HMAC_KEY=$(openssl rand -hex 32)
export NITTER_BASE64SECRET=$(openssl rand -base64 32)

# 启动服务
docker-compose up -d

# 访问
# http://localhost:8080
```

## 故障排查

### 问题：Nitter无法连接Redis

- 检查`REDIS_URL`或`REDIS_HOST`环境变量是否正确
- 确认Redis服务在Railway中正常运行
- 检查网络连接

### 问题：RSS端点返回错误

- 检查`NITTER_DOMAIN`环境变量是否设置为正确的域名
- 确认HTTPS配置正确（Railway自动处理）
- 查看Nitter服务日志

### 问题：推文抓取失败

- Nitter可能因为Twitter/X的变更而失效
- 检查Nitter服务日志
- 考虑更新Nitter镜像版本

## 更新Nitter

```bash
# 在Railway中，重新部署服务会自动拉取最新镜像
# 或者手动触发重新部署
```

## 相关资源

- Nitter GitHub: https://github.com/zedeus/nitter
- Railway文档: https://docs.railway.app
- Nitter文档: https://github.com/zedeus/nitter/wiki
