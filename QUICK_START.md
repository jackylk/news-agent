# 快速启动指南

## 1. 安装依赖

```bash
cd server
npm install bcrypt jsonwebtoken
```

## 2. 配置环境变量

确保 `server/.env` 文件包含：

```env
PORT=3030
DATABASE_URL=postgresql://neondb_owner:npg_2UJ1VikvuajH@ep-ancient-violet-ahl8fbj4-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
CORS_ORIGIN=*
DEEPSEEK_API_KEY=sk-30d75a8ee66d43e89449736541fc6fdb
ADMIN_TOKEN=admin123
JWT_SECRET=your-secret-key-change-in-production
```

## 3. 启动服务器

```bash
cd server
npm start
```

## 4. 访问网站

- **主页**: http://localhost:3030
- **登录/注册**: http://localhost:3030/login.html
- **主题管理**: http://localhost:3030/topics.html
- **订阅管理**: http://localhost:3030/subscriptions.html
- **管理员页面**: http://localhost:3030/admin.html

## 5. 测试流程

1. **注册用户**
   - 访问 `/login.html`
   - 点击"注册"标签
   - 输入用户名、邮箱、密码
   - 点击"注册"

2. **添加主题**
   - 登录后，点击"管理主题"
   - 输入关键词（如"人工智能"）
   - 点击"获取推荐"
   - 选择想要订阅的信息源
   - 点击"订阅选中"

3. **查看新闻**
   - 返回主页
   - 等待 10 分钟（或手动触发收集）
   - 查看收集的新闻

4. **管理员功能**
   - 访问 `/admin.html`
   - 输入管理员令牌（`admin123`）
   - 查看用户列表和新闻源管理

## 故障排除

### 数据库连接失败
- 检查 `DATABASE_URL` 是否正确
- 确保使用 pooler 连接字符串（包含 `-pooler.neon.tech`）

### 依赖安装失败
- 确保 Node.js 版本 >= 20
- 尝试删除 `node_modules` 和 `package-lock.json` 后重新安装

### DeepSeek API 推荐失败
- 检查 `DEEPSEEK_API_KEY` 是否正确
- 检查 API 额度是否充足

### 用户登录失败
- 检查 `JWT_SECRET` 是否配置
- 检查密码是否正确
