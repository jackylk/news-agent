# Vercel 前端部署指南

## 问题说明

如果在 Vercel 上部署后出现 "Unexpected token 'T', "The page c"... is not valid JSON" 错误，这是因为：

1. **Vercel 只部署静态文件**：Vercel 是一个静态网站托管服务，它不会运行 Node.js 后端服务器
2. **API 地址配置错误**：前端代码尝试从 Vercel 域名调用 `/api`，但 Vercel 上没有后端服务
3. **返回 HTML 而非 JSON**：当请求不存在的 API 时，Vercel 返回 404 页面（HTML），导致 JSON 解析失败

## 解决方案

### 方案一：前后端分离部署（推荐）

**前端部署到 Vercel，后端部署到 Railway**

#### 步骤：

1. **部署后端到 Railway**
   - 参考 `RAILWAY_DEPLOY.md`
   - 获取 Railway 提供的域名，例如：`https://your-app.up.railway.app`

2. **修改前端 API 地址**
   
   修改 `web/login.html` 和其他前端文件中的 `API_BASE_URL`：
   
   ```javascript
   const API_BASE_URL = (() => {
     // 本地开发
     if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
       return `${window.location.protocol}//${window.location.host}/api`;
     }
     // 生产环境：使用 Railway 后端地址
     return 'https://your-app.up.railway.app/api';
   })();
   ```
   
   或者使用环境变量（需要修改代码支持）：
   
   ```javascript
   const API_BASE_URL = window.API_BASE_URL || 
     (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
       ? `${window.location.protocol}//${window.location.host}/api`
       : 'https://your-app.up.railway.app/api');
   ```

3. **配置 CORS**
   
   在 Railway 后端的环境变量中设置：
   ```
   CORS_ORIGIN=https://your-vercel-app.vercel.app,https://your-custom-domain.com
   ```
   
   或者在 `server/server.js` 中配置：
   ```javascript
   app.use(cors({
     origin: [
       'https://your-vercel-app.vercel.app',
       'https://your-custom-domain.com',
       'http://localhost:3000'
     ]
   }));
   ```

4. **部署前端到 Vercel**
   - 访问 https://vercel.com
   - 导入 GitHub 仓库
   - 配置：
     - Framework Preset: Other
     - Root Directory: 保持默认
     - Build Command: 留空
     - Output Directory: `web`
   - 点击 Deploy

### 方案二：使用 Vercel Serverless Functions（高级）

如果要在 Vercel 上运行后端，需要使用 Vercel Serverless Functions。这需要重构代码，将 Express 路由转换为 Serverless Functions。

**不推荐**，因为：
- 需要大量代码重构
- Vercel Serverless Functions 有执行时间限制
- 定时任务需要额外配置
- 数据库连接池在 Serverless 环境下可能有问题

## 快速修复当前问题

### 临时方案：修改 API 地址

1. 找到所有前端文件中的 `API_BASE_URL` 配置
2. 将生产环境的 API 地址改为你的 Railway 后端地址

需要修改的文件：
- `web/login.html`
- `web/dashboard.html`
- `web/index.html`
- `web/article.html`
- `web/subscriptions.html`
- `web/topics.html`
- `web/admin.html`

### 使用环境变量（推荐）

1. **在 Vercel 项目设置中添加环境变量**
   - 进入 Vercel 项目设置
   - 选择 "Environment Variables"
   - 添加：`NEXT_PUBLIC_API_BASE_URL` = `https://your-railway-app.up.railway.app/api`

2. **修改前端代码支持环境变量**
   
   在每个 HTML 文件中，修改 `API_BASE_URL` 配置：
   
   ```javascript
   const API_BASE_URL = (() => {
     // 优先使用环境变量（Vercel 会自动注入）
     if (window.NEXT_PUBLIC_API_BASE_URL) {
       return window.NEXT_PUBLIC_API_BASE_URL;
     }
     
     // 本地开发
     if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
       return `${window.location.protocol}//${window.location.host}/api`;
     }
     
     // 默认：使用 Railway 后端地址（需要替换为你的实际地址）
     return 'https://your-railway-app.up.railway.app/api';
   })();
   ```

   **注意**：Vercel 的环境变量需要以 `NEXT_PUBLIC_` 开头才能在客户端访问。但由于这是纯静态 HTML，环境变量不会自动注入。需要：
   
   - 使用构建脚本在部署时替换
   - 或者使用 Vercel 的 Edge Functions 注入
   - 或者直接在代码中硬编码（不推荐）

## 推荐的部署架构

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │   Railway       │
│   (前端)        │────────▶│   (后端)        │
│                 │  API    │                 │
│  - HTML/CSS/JS  │         │  - Node.js      │
│  - 静态文件     │         │  - Express      │
│  - CDN 加速     │         │  - PostgreSQL   │
└─────────────────┘         └─────────────────┘
```

## 验证部署

1. **检查 API 地址**
   - 打开浏览器开发者工具（F12）
   - 查看 Network 标签
   - 确认所有 API 请求都指向正确的后端地址

2. **检查 CORS**
   - 如果看到 CORS 错误，检查后端 CORS 配置
   - 确保后端允许 Vercel 域名的请求

3. **测试登录**
   - 尝试登录
   - 如果仍然出现 JSON 解析错误，检查：
     - API 地址是否正确
     - 后端服务是否正常运行
     - 网络连接是否正常

## 常见错误

### 错误：Unexpected token 'T', "The page c"... is not valid JSON

**原因**：API 返回了 HTML（404 页面）而不是 JSON

**解决**：
1. 检查 `API_BASE_URL` 是否正确指向后端服务器
2. 确认后端服务正在运行
3. 检查网络请求，查看实际返回的内容

### 错误：CORS policy blocked

**原因**：后端未允许 Vercel 域名的请求

**解决**：
1. 在 Railway 环境变量中添加 `CORS_ORIGIN`
2. 或在后端代码中添加 Vercel 域名到允许列表

### 错误：Network Error 或 Failed to fetch

**原因**：无法连接到后端服务器

**解决**：
1. 检查后端服务是否正常运行
2. 检查 API 地址是否正确
3. 检查防火墙或网络设置

## 总结

**关键点**：
1. Vercel 只托管静态文件，不能运行 Node.js 后端
2. 后端必须单独部署（推荐 Railway）
3. 前端需要配置正确的后端 API 地址
4. 后端需要配置 CORS 允许 Vercel 域名

**推荐配置**：
- 前端：Vercel（全球 CDN，快速加载）
- 后端：Railway（稳定运行，支持定时任务）
- 数据库：Neon 或 Railway PostgreSQL
