# JWT_SECRET 设置指南

JWT_SECRET 是用于加密和验证用户登录 token 的密钥。在生产环境中必须设置一个强密码，否则会导致登录失败或安全问题。

## 为什么需要设置 JWT_SECRET？

1. **安全性**：JWT_SECRET 用于签名和验证用户的登录 token，如果使用默认值或弱密码，可能导致 token 被伪造
2. **稳定性**：如果多个服务器实例使用不同的 JWT_SECRET，会导致 token 无法跨实例验证，用户需要频繁重新登录
3. **生产环境要求**：生产环境必须使用强随机字符串作为 JWT_SECRET

## 如何生成 JWT_SECRET

### 方法 1：使用 Node.js 生成（推荐）

在终端运行以下命令：

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

这会生成一个 128 个字符的随机字符串，例如：
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2
```

### 方法 2：使用 OpenSSL 生成

```bash
openssl rand -hex 64
```

### 方法 3：使用在线工具生成

访问 https://randomkeygen.com/ 或类似工具，生成一个至少 32 个字符的随机字符串。

### 方法 4：使用 Python 生成

```bash
python3 -c "import secrets; print(secrets.token_hex(64))"
```

## 在 Railway 上设置 JWT_SECRET

### 步骤 1：生成 JWT_SECRET

使用上述任一方法生成一个随机字符串。

### 步骤 2：在 Railway 中添加环境变量

1. 登录 Railway：https://railway.app
2. 选择你的项目（news-agent）
3. 点击项目名称进入项目详情
4. 点击 **"Variables"** 标签页
5. 点击 **"New Variable"** 按钮
6. 输入以下信息：
   - **Variable Name**: `JWT_SECRET`
   - **Value**: 粘贴你生成的随机字符串（例如：`a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2`）
7. 点击 **"Add"** 保存

### 步骤 3：重新部署

设置环境变量后，Railway 会自动重新部署应用。如果没有自动部署，可以：
- 点击 **"Deployments"** 标签页
- 点击最新的部署记录
- 点击 **"Redeploy"** 按钮

### 步骤 4：验证设置

部署完成后，查看 Railway 日志，应该不再看到以下警告：
```
⚠️  警告: JWT_SECRET 使用默认值，这在生产环境中不安全！
```

## 在本地开发环境设置 JWT_SECRET

### 方法 1：使用 .env 文件（推荐）

1. 在 `server` 目录下创建或编辑 `.env` 文件：

```bash
cd server
nano .env  # 或使用其他编辑器
```

2. 添加以下内容：

```env
JWT_SECRET=你的生成的随机字符串
```

例如：
```env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2
```

3. 保存文件

4. 重启服务器

### 方法 2：使用环境变量

在启动服务器前设置环境变量：

**Linux/macOS:**
```bash
export JWT_SECRET=你的生成的随机字符串
cd server
npm start
```

**Windows (PowerShell):**
```powershell
$env:JWT_SECRET="你的生成的随机字符串"
cd server
npm start
```

**Windows (CMD):**
```cmd
set JWT_SECRET=你的生成的随机字符串
cd server
npm start
```

## JWT_SECRET 要求

- **长度**：建议至少 32 个字符，推荐 64-128 个字符
- **复杂度**：应包含字母、数字，可以使用特殊字符
- **随机性**：必须使用随机生成，不要使用有意义的字符串
- **唯一性**：每个环境（开发、生产）应该使用不同的 JWT_SECRET
- **保密性**：不要将 JWT_SECRET 提交到代码仓库

## 常见问题

### Q1: 如果忘记设置 JWT_SECRET 会怎样？

A: 系统会使用默认值 `your-secret-key-change-in-production`，但这会导致：
- 安全风险：token 可能被伪造
- 登录不稳定：如果服务器重启或使用多个实例，token 可能失效
- 生产环境警告：系统会显示警告信息

### Q2: 可以修改已设置的 JWT_SECRET 吗？

A: 可以，但需要注意：
- **修改 JWT_SECRET 后，所有已登录用户的 token 都会失效**
- 用户需要重新登录
- 建议在低峰期进行修改

### Q3: 开发环境和生产环境可以使用相同的 JWT_SECRET 吗？

A: 技术上可以，但**不推荐**。建议：
- 开发环境使用一个 JWT_SECRET
- 生产环境使用另一个不同的 JWT_SECRET
- 这样可以避免开发环境的 token 在生产环境生效

### Q4: 如何验证 JWT_SECRET 是否设置成功？

A: 查看服务器启动日志：
- 如果看到警告信息，说明未设置或使用默认值
- 如果没有警告，说明已正确设置

## 快速设置命令

### 生成并复制 JWT_SECRET（macOS/Linux）

```bash
# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" | pbcopy

# 然后粘贴到 Railway 环境变量中
```

### 生成并复制 JWT_SECRET（Windows PowerShell）

```powershell
# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" | clip

# 然后粘贴到 Railway 环境变量中
```

## 完整的环境变量配置示例

在 Railway 上，建议设置以下环境变量：

```
DATABASE_URL=你的数据库连接字符串
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
DEEPSEEK_API_KEY=你的DeepSeek API Key
JWT_SECRET=你的生成的强随机字符串（至少32个字符）
ADMIN_TOKEN=你的管理员令牌（至少16个字符）
```

## 安全建议

1. ✅ **使用强随机字符串**：至少 32 个字符，推荐 64-128 个字符
2. ✅ **定期更换**：建议每 6-12 个月更换一次（注意会影响所有用户）
3. ✅ **不要共享**：不同环境使用不同的 JWT_SECRET
4. ✅ **不要提交到代码仓库**：使用环境变量或 `.env` 文件（已加入 `.gitignore`）
5. ✅ **备份记录**：将 JWT_SECRET 保存在安全的地方（如密码管理器）

## 相关文件

- `server/env.example` - 环境变量示例文件
- `server/models/User.js` - JWT_SECRET 使用位置
- `RAILWAY_DEPLOY.md` - Railway 部署指南
