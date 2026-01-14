# 快速修复：手机无法访问 Vercel 域名

## 立即检查清单

### 1. 确认 Vercel 部署成功

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到项目 `news-agent`
3. **确认最新部署状态为 "Ready"（绿色）**
4. 如果显示 "Error" 或 "Building"，等待完成或查看错误日志

### 2. 在电脑浏览器测试

在电脑浏览器中打开：`https://news-agent-seven.vercel.app`

- ✅ **如果能看到页面**：说明部署成功，问题可能是手机端特定
- ❌ **如果看不到页面**：说明部署有问题，继续下面的步骤

### 3. 如果电脑也打不开

#### 检查 Vercel 项目设置

1. 在 Vercel Dashboard 中，进入项目设置
2. 选择 **Settings** > **General**
3. 确认以下配置：
   ```
   Framework Preset: Other
   Root Directory: (留空)
   Build Command: (留空)
   Output Directory: web  ← 重要！
   Install Command: (留空)
   ```

4. 如果配置不对，修改后点击 **Save**
5. 点击 **Redeploy** 重新部署

#### 检查 vercel.json 文件

确保项目根目录有 `vercel.json` 文件，内容为：

```json
{
  "version": 2,
  "buildCommand": null,
  "outputDirectory": "web",
  "cleanUrls": true,
  "trailingSlash": false
}
```

### 4. 如果电脑能打开，但手机打不开

#### 检查手机浏览器

1. **使用 HTTPS**：确保地址是 `https://news-agent-seven.vercel.app`（不是 http）
2. **清除缓存**：
   - Android Chrome: 设置 > 隐私和安全 > 清除浏览数据
   - iOS Safari: 设置 > Safari > 清除历史记录和网站数据
3. **尝试其他浏览器**：
   - 如果 Chrome 不行，试试 Safari 或 Firefox
4. **检查网络**：
   - 尝试切换 Wi-Fi 和移动数据
   - 确认手机网络正常

#### 检查控制台错误

如果可能，在手机上打开开发者工具：

**Android Chrome:**
1. 在电脑 Chrome 地址栏输入 `chrome://inspect`
2. 用 USB 连接手机
3. 在手机上打开网站
4. 点击 "inspect" 查看控制台错误

**iOS Safari:**
1. 在 iPhone 设置中启用 "Web Inspector"（设置 > Safari > 高级）
2. 在 Mac Safari 中：开发 > [你的 iPhone] > [网页]
3. 查看控制台错误

### 5. 测试 API 连接

访问测试页面：`https://news-agent-seven.vercel.app/test.html`

这个页面会：
- 显示基本信息（URL、User Agent 等）
- 自动测试 API 连接
- 测试 CORS 配置

根据测试结果判断问题所在。

### 6. 常见问题快速解决

#### 问题：页面显示 "404 Not Found"

**解决方法：**
- 确认 Vercel 项目设置中 `Output Directory` 为 `web`
- 确认 `web/index.html` 文件存在
- 重新部署

#### 问题：页面空白

**解决方法：**
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签的错误
3. 查看 Network 标签，确认 API 请求是否成功
4. 确认 Railway 后端服务正常运行

#### 问题：API 请求失败

**解决方法：**
1. 确认 Railway 后端服务正常运行
2. 访问 `https://news-agent-production-c5db.up.railway.app/api/health` 测试后端
3. 检查后端 CORS 配置（应该允许所有来源）

### 7. 如果以上都不行

#### 方案 A：重新创建 Vercel 项目

1. 在 Vercel Dashboard 中删除现有项目
2. 重新导入 GitHub 仓库
3. 重新配置并部署

#### 方案 B：使用其他静态托管

如果 Vercel 有问题，可以尝试：

**Netlify:**
1. 访问 [Netlify](https://www.netlify.com)
2. 导入 GitHub 仓库
3. 设置 Build command: 留空
4. 设置 Publish directory: `web`

**GitHub Pages:**
1. 在 GitHub 仓库设置中启用 Pages
2. 设置 Source: `web` 目录

### 8. 联系支持

如果问题仍然存在，请提供：
1. Vercel 部署日志截图
2. 浏览器控制台错误截图
3. 手机浏览器类型和版本
4. 具体错误信息

## 最可能的原因

根据经验，最常见的问题是：

1. **Vercel 项目设置中 `Output Directory` 未设置为 `web`** ← 最常见
2. **部署失败但未注意到**（检查部署状态）
3. **手机浏览器缓存问题**（清除缓存）
4. **网络问题**（切换网络测试）

按照上面的清单逐一检查，应该能找到问题所在。
