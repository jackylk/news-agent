# Nitter 实例自建指南

## 什么是 Nitter？

Nitter 是一个开源的 Twitter/X 前端替代工具，可以将 Twitter 用户页面转换为 RSS 源，从而绕过 Twitter 的 API 限制。

## 为什么需要自建 Nitter 实例？

1. **稳定性**：公共 Nitter 实例可能随时失效或被封禁
2. **控制权**：自己部署可以完全控制实例的可用性
3. **性能**：自建实例通常响应更快
4. **隐私**：数据不会经过第三方服务器

## 部署方法

### 方法 1：部署到 Railway（推荐，最简单）

这是最简单的方法，适合在Railway上部署的项目。

#### 前置要求

1. GitHub账号
2. Railway账号（https://railway.app）
3. 已有Railway项目（用于部署网站后台）

#### 步骤

1. **创建Nitter GitHub仓库**

   - 在GitHub上创建新仓库（例如：`nitter-instance`）
   - 将 `nitter-instance/` 目录中的文件推送到仓库
   - 文件包括：`railway.json`、`Dockerfile`、`nitter.conf`、`docker-compose.yml`、`README.md`

2. **在Railway项目中添加Redis服务**

   - 登录Railway，进入你的项目（与网站后台同一个项目）
   - 点击 "New" → "Database" → "Add Redis"
   - Railway会自动创建Redis实例
   - 记下Redis服务的内部地址（格式：`redis-service.railway.internal:6379`）

3. **在Railway项目中添加Nitter服务**

   - 在同一个Railway项目中，点击 "New" → "GitHub Repo"
   - 选择刚才创建的Nitter仓库
   - Railway会自动检测Dockerfile并开始构建

4. **配置Nitter环境变量**

   在Nitter服务的设置中，添加以下环境变量：

   **必需的环境变量：**

   ```bash
   # Redis连接（Railway会自动提供，格式：redis://default:password@redis-service.railway.internal:6379）
   REDIS_URL=redis://default:password@redis-service.railway.internal:6379
   
   # 或者分别设置：
   REDIS_HOST=redis-service.railway.internal
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   REDIS_DB=0
   
   # Nitter域名（Railway会自动提供，格式：your-service.railway.app）
   # 部署后，在服务设置中查看Public URL
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

5. **获取Nitter实例URL**

   - 部署完成后，在Railway服务设置中查看 "Public URL"
   - 格式：`https://your-nitter-service.railway.app`

6. **测试Nitter实例**

   - 访问主页：`https://your-nitter-service.railway.app`
   - 测试RSS：`https://your-nitter-service.railway.app/OpenAI/rss`
   - 应该能看到RSS XML内容

7. **在网站后台添加实例**

   - 登录网站管理后台（`/admin.html`）
   - 进入 "Nitter管理" 页签
   - 点击 "添加Nitter实例"
   - 输入Nitter实例URL
   - 点击 "测试" 验证可用性

#### 优势

- ✅ 无需自己管理服务器
- ✅ 自动SSL证书
- ✅ 自动域名
- ✅ 与网站后台在同一项目中，便于管理
- ✅ 资源隔离，互不影响

#### 注意事项

- Railway免费版有资源限制，注意监控使用量
- Redis服务需要单独配置，确保Nitter能连接到Redis
- 多个服务可能增加Railway使用成本

### 方法 2：使用 Docker（本地或VPS）

这是适合在本地或VPS上部署的方法。

#### 前置要求

- 安装了 Docker 和 Docker Compose
- 一台服务器（VPS、云服务器等）
- 域名（可选，但推荐）

#### 步骤

1. **创建目录**

```bash
mkdir nitter
cd nitter
```

2. **创建 docker-compose.yml**

```yaml
version: '3'

services:
  nitter:
    image: zedeus/nitter:latest
    container_name: nitter
    restart: always
    ports:
      - "8080:8080"
    environment:
      - NITTER_DOMAIN=your-domain.com  # 替换为你的域名
      - NITTER_TITLE=Nitter
      - NITTER_THEME=auto
      - NITTER_REPLACE_TWITTER=twitter.com
      - NITTER_REPLACE_X=x.com
      - NITTER_REPLACE_INSTAGRAM=instagram.com
      - NITTER_REPLACE_REDDIT=reddit.com
      - NITTER_REPLACE_YOUTUBE=youtube.com
      - NITTER_REPLACE_IMGUR=imgur.com
      - NITTER_HMAC_KEY=your-secret-key-here  # 生成一个随机字符串
      - NITTER_BASE64SECRET=your-base64-secret  # 生成一个base64编码的随机字符串
    volumes:
      - ./data:/data
```

3. **生成密钥**

```bash
# 生成 HMAC Key（随机字符串）
openssl rand -hex 32

# 生成 Base64 Secret
openssl rand -base64 32
```

将生成的密钥填入 `docker-compose.yml`。

4. **启动服务**

```bash
docker-compose up -d
```

5. **验证**

访问 `http://your-server-ip:8080` 或 `https://your-domain.com`，应该能看到 Nitter 界面。

### 方法 2：使用 Nix（高级）

如果你使用 NixOS 或熟悉 Nix，可以使用 Nix 包管理器安装。

```bash
nix-env -iA nixos.nitter
```

### 方法 3：从源码编译

适合想要自定义或贡献代码的开发者。

```bash
git clone https://github.com/zedeus/nitter.git
cd nitter
nimble build -d:release
```

## 配置反向代理（推荐）

如果你有域名，建议使用 Nginx 或 Caddy 配置反向代理和 SSL。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name nitter.your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后使用 Let's Encrypt 配置 SSL：

```bash
certbot --nginx -d nitter.your-domain.com
```

### Caddy 配置示例

```caddy
nitter.your-domain.com {
    reverse_proxy localhost:8080
}
```

## 在后台添加 Nitter 实例

部署完成后，在管理后台添加你的 Nitter 实例：

1. 登录管理后台（`/admin.html`）
2. 找到 "Nitter实例管理" 部分
3. 点击 "添加Nitter实例"
4. 输入你的 Nitter 实例 URL（例如：`https://nitter.your-domain.com`）
5. 可选：设置名称和优先级
6. 点击 "测试" 按钮验证实例是否可用

## 故障排查

### 问题：无法访问 Nitter 实例

1. **检查 Docker 容器状态**
   ```bash
   docker ps
   docker logs nitter
   ```

2. **检查端口是否开放**
   ```bash
   # 检查防火墙
   sudo ufw status
   # 如果需要，开放端口
   sudo ufw allow 8080
   ```

3. **检查域名解析**
   ```bash
   nslookup nitter.your-domain.com
   ```

### 问题：RSS 源返回错误

1. **检查 Nitter 日志**
   ```bash
   docker logs nitter
   ```

2. **测试 RSS URL**
   访问 `https://your-nitter-instance.com/OpenAI/rss`，应该能看到 RSS XML。

3. **检查 Twitter 是否可访问**
   Nitter 需要能够访问 Twitter，确保服务器网络正常。

### 问题：实例经常失效

1. **使用代理**：如果 Twitter 在你的服务器上被屏蔽，可以配置代理
2. **定期重启**：设置定时任务定期重启容器
3. **监控**：使用监控工具（如 Uptime Robot）监控实例状态

## 性能优化

1. **使用 Redis 缓存**（可选）
   ```yaml
   # 在 docker-compose.yml 中添加 Redis
   redis:
     image: redis:alpine
     volumes:
       - redis-data:/data
   
   # 在 nitter 服务中添加环境变量
   - NITTER_REDIS_HOST=redis
   ```

2. **限制并发连接**
   ```yaml
   - NITTER_MAX_CONNECTIONS=100
   ```

3. **使用 CDN**（如果有域名）
   配置 Cloudflare 或其他 CDN 加速访问

## 安全建议

1. **使用 HTTPS**：始终使用 SSL 证书
2. **限制访问**：如果不需要公开访问，可以限制 IP
3. **定期更新**：定期更新 Docker 镜像
   ```bash
   docker-compose pull
   docker-compose up -d
   ```
4. **监控日志**：定期检查日志，发现异常及时处理

## 维护

### 更新 Nitter

```bash
cd nitter
docker-compose pull
docker-compose up -d
```

### 备份数据

```bash
# 备份数据目录
tar -czf nitter-backup-$(date +%Y%m%d).tar.gz ./data
```

### 查看日志

```bash
docker logs -f nitter
```

## 相关资源

- **Nitter GitHub**: https://github.com/zedeus/nitter
- **Nitter 文档**: https://github.com/zedeus/nitter/wiki
- **公共 Nitter 实例列表**: https://github.com/zedeus/nitter/wiki/Instances

## 注意事项

⚠️ **重要提示**：

1. **法律风险**：使用 Nitter 抓取 Twitter 内容可能违反 Twitter 的服务条款，请自行评估风险
2. **稳定性**：Nitter 可能因为 Twitter 的变更而失效，需要定期维护
3. **资源消耗**：Nitter 需要一定的服务器资源，建议至少 1GB RAM
4. **速率限制**：不要过于频繁地请求，避免被 Twitter 封禁

## 总结

自建 Nitter 实例可以大大提高 Twitter/X 推文抓取的稳定性。虽然需要一些技术知识，但使用 Docker 部署相对简单。建议有条件的用户都自建一个实例，以获得更好的体验。
