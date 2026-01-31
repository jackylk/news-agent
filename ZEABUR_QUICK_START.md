# Zeabur 快速部署指南（5 分钟上手）

本指南帮助你在 5 分钟内快速将应用部署到 Zeabur。

## 🚀 快速部署步骤

### 第 1 步：准备代码（1 分钟）

确保代码已推送到 GitHub：

```bash
git add .
git commit -m "准备部署到 Zeabur"
git push origin main
```

### 第 2 步：创建 Zeabur 项目（2 分钟）

1. 访问 https://zeabur.com，使用 GitHub 登录
2. 点击 **New Project**，输入项目名如 `news-agent`
3. 点击 **Add Service** → **Deploy from GitHub**
4. 选择你的 `news-agent` 仓库
5. ✅ 确认 **Root Directory** 为空或 `/`（根目录）

### 第 3 步：添加数据库（1 分钟）

1. 在同一项目中，点击 **Add Service**
2. 选择 **Marketplace** → 搜索 **PostgreSQL**
3. 点击 **Deploy**
4. ✅ 等待 PostgreSQL 服务启动（绿色状态）

### 第 4 步：配置环境变量（1 分钟）

在应用服务中点击 **Variables**，添加：

**必需**（使用强随机值）：
```bash
JWT_SECRET=你的32位随机字符串
ADMIN_TOKEN=你的管理员密码
```

**可选**（启用 AI 摘要）：
```bash
DEEPSEEK_API_KEY=你的DeepSeek密钥
```

> 💡 生成随机密钥：`openssl rand -hex 32`

### 第 5 步：开启公网访问并部署

1. 在应用服务中点击 **Networking**
2. 点击 **Generate Domain** 生成域名
3. 等待部署完成（约 2-3 分钟）
4. ✅ 服务显示绿色"运行中"状态

## ✅ 验证部署

访问以下 URL 确认部署成功：

### 1. 健康检查
```
https://你的域名.zeabur.app/health
```
应返回：`{"status":"ok","message":"服务器运行正常"}`

### 2. 应用首页
```
https://你的域名.zeabur.app/
```
应显示新闻列表页面

### 3. 管理后台
```
https://你的域名.zeabur.app/admin.html
```
输入你设置的 `ADMIN_TOKEN` 访问

## 📋 查看日志

在 Zeabur 控制台：
1. 进入你的项目
2. 点击应用服务
3. 点击 **Logs** 查看日志

**确认日志显示**：
- ✅ "📦 使用独立环境变量连接数据库"
- ✅ "✅ 已连接到 PostgreSQL 数据库"
- ✅ "数据库表初始化完成"
- ✅ "服务器运行在端口 xxxx"

## 🎯 下一步

### 初始化数据

1. 访问管理后台添加新闻源
2. 手动触发新闻收集（测试爬虫功能）
3. 在登录页注册第一个用户

### 完整测试

使用 **`ZEABUR_TEST_CHECKLIST.md`** 进行全面测试。

## ⚠️ 常见问题

### 数据库连接失败

**症状**：日志显示 "❌ 数据库连接失败"

**解决**：
1. 确认 PostgreSQL 服务在同一项目中且显示绿色
2. 重启应用服务
3. 查看日志确认环境变量注入

### 爬虫无法运行

**症状**：新闻收集失败，日志有 Puppeteer 错误

**解决**：
- 查看日志中的具体错误
- 确认 Dockerfile 中已安装 Chromium（已包含）
- 联系 Zeabur 支持确认 Docker 容器权限

### 页面 404

**症状**：访问前端页面显示 404

**解决**：
1. 确认 `web/` 目录已提交到 Git
2. 确认 Dockerfile 中有 `COPY web/ ./web/`
3. 重新部署应用

## 📚 详细文档

- **完整部署指南**：`ZEABUR_DEPLOY.md`
- **测试清单**：`ZEABUR_TEST_CHECKLIST.md`
- **故障排查**：见 `ZEABUR_DEPLOY.md` 故障排查章节

## 🎉 部署成功！

恭喜！你的应用现在已经在 Zeabur 上运行了。

**记录你的信息**：
- 应用域名：`https://__________.zeabur.app`
- ADMIN_TOKEN：`__________`（安全保存）
- 部署时间：`__________`

享受你的新闻应用吧！ 🚀
