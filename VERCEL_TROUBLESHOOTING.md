# Vercel 部署故障排查指南

## 问题：手机无法访问 Vercel 域名

### 1. 检查 Vercel 部署状态

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到你的项目 `news-agent`
3. 检查最新的部署状态：
   - ✅ **Ready** - 部署成功
   - ⏳ **Building** - 正在构建
   - ❌ **Error** - 部署失败（查看错误日志）

### 2. 如果部署失败，检查以下配置

#### 在 Vercel 项目设置中确认：

1. **Framework Preset**: `Other`
2. **Root Directory**: 留空（使用根目录）
3. **Build Command**: 留空
4. **Output Directory**: `web` ⚠️ **重要**
5. **Install Command**: 留空

#### 检查 vercel.json 文件

确保 `vercel.json` 文件在项目根目录，内容如下：

```json
{
  "version": 2,
  "buildCommand": null,
  "outputDirectory": "web",
  "cleanUrls": true,
  "trailingSlash": false
}
```

### 3. 重新部署

如果配置有问题：

1. 在 Vercel Dashboard 中，进入项目设置
2. 选择 "Settings" > "General"
3. 检查并修正配置
4. 点击 "Redeploy" 重新部署

或者：

1. 在 GitHub 上推送一个新的 commit（即使只是修改 README）
2. Vercel 会自动触发重新部署

### 4. 验证部署文件

部署成功后，检查部署的文件：

1. 在 Vercel Dashboard 中，点击最新的部署
2. 查看 "Source" 标签，确认 `web/index.html` 被包含
3. 如果 `web/index.html` 不在部署文件中，说明 `Output Directory` 配置错误

### 5. 测试域名访问

#### 在电脑浏览器中测试

1. 打开 `https://news-agent-seven.vercel.app`
2. 应该能看到新闻列表页面
3. 如果看到 404 或空白页，说明部署配置有问题

#### 在手机浏览器中测试

1. 确保使用 **HTTPS** 协议：`https://news-agent-seven.vercel.app`
2. 不要使用 HTTP（Vercel 会自动重定向，但可能有问题）
3. 清除浏览器缓存后重试

### 6. 常见错误及解决方法

#### 错误：404 Not Found

**原因：** `Output Directory` 配置错误或文件路径不对

**解决方法：**
- 确认 Vercel 项目设置中 `Output Directory` 为 `web`
- 确认 `web/index.html` 文件存在
- 检查 `vercel.json` 配置

#### 错误：页面空白

**原因：** JavaScript 错误或 API 请求失败

**解决方法：**
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签的错误信息
3. 查看 Network 标签，确认 API 请求是否成功
4. 确认 Railway 后端服务正常运行

#### 错误：CORS 错误

**原因：** 后端 CORS 配置不允许 Vercel 域名

**解决方法：**
1. 检查 `server/server.js` 中的 CORS 配置
2. 确认 `origin: '*'` 或包含 Vercel 域名
3. 检查 Railway 环境变量 `CORS_ORIGIN`

#### 错误：连接超时

**原因：** 网络问题或域名解析问题

**解决方法：**
1. 尝试使用不同的网络（Wi-Fi / 移动数据）
2. 清除 DNS 缓存
3. 尝试使用 Vercel 提供的其他域名（如 `news-agent-git-main-xxx.vercel.app`）

### 7. 检查部署日志

1. 在 Vercel Dashboard 中，点击最新的部署
2. 查看 "Build Logs" 标签
3. 查找错误信息：
   - 如果看到 "Output Directory not found"，说明 `web` 目录不存在
   - 如果看到 "Build failed"，查看具体错误信息

### 8. 手动验证文件结构

确保项目结构如下：

```
news-agent/
├── web/
│   └── index.html
├── server/
│   └── ...
├── vercel.json
└── ...
```

### 9. 如果仍然无法访问

1. **检查 Vercel 账户状态**
   - 确认账户未过期
   - 确认项目未暂停

2. **尝试重新创建项目**
   - 在 Vercel 中删除现有项目
   - 重新导入 GitHub 仓库
   - 重新配置并部署

3. **联系 Vercel 支持**
   - 如果以上方法都无效，可能是 Vercel 平台问题
   - 在 Vercel Dashboard 中提交支持请求

### 10. 临时解决方案

如果 Vercel 部署有问题，可以临时使用：

1. **GitHub Pages**（免费静态托管）
2. **Netlify**（类似 Vercel 的静态托管服务）
3. **Railway 静态文件服务**（在 Railway 后端添加静态文件服务）

## 快速检查清单

- [ ] Vercel 部署状态为 "Ready"
- [ ] `Output Directory` 设置为 `web`
- [ ] `web/index.html` 文件存在
- [ ] `vercel.json` 配置正确
- [ ] 电脑浏览器可以访问域名
- [ ] 手机浏览器使用 HTTPS 协议
- [ ] Railway 后端服务正常运行
- [ ] 浏览器控制台无错误
- [ ] Network 标签中 API 请求成功
