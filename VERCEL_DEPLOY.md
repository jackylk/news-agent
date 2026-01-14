# Vercel 部署前端指南

## 概述

前端网页需要部署到 Vercel 才能让手机正常访问。后端 API 继续在 Railway 上运行。

## 部署步骤

### 1. 准备 GitHub 仓库

确保代码已推送到 GitHub 仓库。

### 2. 在 Vercel 上部署

1. 访问 [Vercel](https://vercel.com)
2. 使用 GitHub 账号登录
3. 点击 "Add New Project"
4. 选择你的 GitHub 仓库 `news-agent`
5. 配置项目设置：
   - **Framework Preset**: Other
   - **Root Directory**: 保持默认（根目录）
   - **Build Command**: 留空（静态站点，无需构建）
   - **Output Directory**: `web`
   - **Install Command**: 留空
6. 点击 "Deploy"

### 3. 获取部署域名

部署完成后，Vercel 会提供一个域名，例如：
- `news-agent-xxx.vercel.app`
- 或你的自定义域名（如果已配置）

### 4. 验证部署

1. 在浏览器中打开 Vercel 提供的域名
2. 应该能看到新闻列表页面
3. 打开浏览器开发者工具（F12），检查 Network 标签：
   - 确认所有 API 请求都指向 `https://news-agent-production-c5db.up.railway.app/api`
   - 确认没有 CORS 错误
   - 确认没有混合内容（HTTP/HTTPS）错误

### 5. 手机端测试

1. 在手机浏览器（Chrome/Safari）中打开 Vercel 域名
2. 确认页面正常加载
3. 确认新闻列表显示正常
4. 点击新闻条目，确认详情页正常显示
5. 测试翻译功能（如果是英文文章）
6. 测试分类筛选功能

## 环境变量配置（可选）

如果需要更改后端 API 地址，可以在 Vercel 项目设置中添加环境变量：

1. 进入 Vercel 项目设置
2. 选择 "Environment Variables"
3. 添加变量：
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`（注意：当前代码使用硬编码，如需使用环境变量需要修改代码）

## 故障排查

### 问题：页面空白

- 检查浏览器控制台是否有错误
- 确认 API 请求是否成功（Network 标签）
- 确认 Railway 后端服务正常运行

### 问题：CORS 错误

- 确认后端 `server/server.js` 中的 CORS 配置允许 Vercel 域名
- 检查 `CORS_ORIGIN` 环境变量是否包含 `*` 或具体域名

### 问题：API 请求失败

- 确认 Railway 后端服务正常运行
- 检查 API 地址是否正确：`https://news-agent-production-c5db.up.railway.app/api`
- 确认网络连接正常

## 自动部署

Vercel 会自动监听 GitHub 仓库的推送，每次代码更新后会自动重新部署。

## 自定义域名（可选）

1. 在 Vercel 项目设置中选择 "Domains"
2. 添加你的自定义域名
3. 按照提示配置 DNS 记录
