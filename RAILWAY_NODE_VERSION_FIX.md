# Railway Node.js 版本修复指南

## 问题

部署到 Railway 时出现错误：
```
ReferenceError: File is not defined
```

这是因为：
- `cheerio` 库的依赖 `undici` 需要 Node.js 20+
- Railway 默认可能使用 Node.js 18
- Node.js 18 不支持 `File` API

## 解决方案

### 方案 1: 使用 nixpacks.toml（推荐）

已在项目根目录创建 `nixpacks.toml` 文件，指定使用 Node.js 20。

Railway 会自动检测并使用此配置。

### 方案 2: 在 Railway 项目设置中指定 Node.js 版本

1. 进入 Railway 项目设置
2. 找到 "Variables" 或 "Environment" 部分
3. 添加环境变量：
   - **Name**: `NIXPACKS_NODE_VERSION`
   - **Value**: `20`

### 方案 3: 使用 Dockerfile

如果 Railway 支持 Dockerfile，已更新 `Dockerfile` 使用 `node:20-alpine`。

## 验证

部署后，检查日志应该看到：
- ✅ 没有 `File is not defined` 错误
- ✅ 服务器正常启动
- ✅ 数据库连接成功

## 如果仍然失败

1. 确认 Railway 项目设置中 Node.js 版本为 20+
2. 检查 `nixpacks.toml` 文件是否在项目根目录
3. 重新部署项目
4. 查看 Railway 构建日志，确认使用的 Node.js 版本
