# Twitter/X 推文抓取功能使用指南

## 概述

本系统支持通过 Nitter 实例将 Twitter/X 用户的推文转换为 RSS 源，然后自动抓取并保存到数据库中。

## 工作原理

由于 Twitter/X 已经关闭了免费 API，我们使用以下方案：

1. **Nitter**：一个开源的 Twitter 前端替代工具，可以将 Twitter 用户页面转换为 RSS 源
2. 系统自动从 Nitter RSS 源抓取推文
3. 推文会被保存为新闻条目，支持主题过滤、翻译等功能

## 配置方法

### 1. 环境变量配置（可选）

在 `.env` 文件中配置 Nitter 实例：

```bash
# 配置多个Nitter实例作为备用（用逗号分隔）
NITTER_INSTANCES=https://nitter.net,https://nitter.it,https://nitter.pussthecat.org
```

**注意**：
- 如果不配置，系统会使用默认的公共 Nitter 实例（可能不稳定）
- 建议自己部署 Nitter 实例以获得更好的稳定性
- 公共 Nitter 实例可能随时失效或被封禁

### 2. 添加 Twitter/X 订阅源

在订阅管理界面添加 Twitter/X 源时，可以使用以下格式：

- **Twitter URL**：`https://twitter.com/username` 或 `https://x.com/username`
- **X URL**：`https://x.com/username`
- **Nitter URL**：`https://nitter.net/username`
- **用户名**：直接输入 `username` 或 `@username`

系统会自动识别并提取用户名。

### 3. 源类型设置

在添加订阅时，将 `source_type` 设置为以下任一值：
- `twitter`
- `x`
- `social`

或者直接使用 Twitter/X URL，系统会自动识别。

## 使用示例

### 示例 1：订阅 OpenAI 的 Twitter

```
源名称: OpenAI Twitter
源URL: https://twitter.com/OpenAI
源类型: twitter
分类: AI研究
```

### 示例 2：订阅个人账号

```
源名称: 某位AI研究者
源URL: @username
源类型: twitter
分类: AI研究
```

## 注意事项

### 法律和合规风险

⚠️ **重要提示**：

1. **服务条款**：Twitter/X 的服务条款明确禁止未经授权的爬取和抓取。使用此功能可能违反服务条款。

2. **法律风险**：
   - 虽然抓取公开内容在某些司法管辖区可能是合法的，但仍存在被起诉的风险
   - 建议咨询法律顾问，特别是如果用于商业用途

3. **IP 封禁风险**：
   - 频繁抓取可能导致 IP 被封禁
   - 建议使用代理或自建 Nitter 实例

### 技术限制

1. **Nitter 实例稳定性**：
   - 公共 Nitter 实例可能随时失效
   - 建议自己部署 Nitter 实例

2. **抓取频率**：
   - 系统会自动限制抓取频率，避免被封禁
   - 建议不要过于频繁地抓取同一个用户

3. **内容限制**：
   - 只能抓取公开账号的公开推文
   - 无法抓取私密账号或需要登录才能查看的内容

## 自建 Nitter 实例（推荐）

为了获得更好的稳定性和控制权，建议自己部署 Nitter 实例：

### 使用 Docker 部署

```bash
docker run -d -p 8080:8080 zedeus/nitter
```

### 配置环境变量

```bash
NITTER_INSTANCES=http://localhost:8080
```

### 更多信息

- Nitter GitHub: https://github.com/zedeus/nitter
- XRSS GitHub: https://github.com/Thytu/XRSS（另一个可选方案）

## 替代方案

如果 Nitter 不可用，可以考虑以下替代方案：

1. **XRSS**：另一个开源工具，支持 Twitter/X RSS 生成
2. **RSS.app**：第三方 RSS 生成服务（可能有费用）
3. **官方 API**：Twitter/X 官方 API（费用昂贵，约 $42,000/年起）

## 故障排查

### 问题：无法抓取推文

1. **检查 Nitter 实例**：
   - 访问 Nitter 实例的网页，确认是否可用
   - 尝试访问 `https://nitter.net/username/rss` 查看 RSS 是否正常

2. **检查用户名**：
   - 确认用户名格式正确（只包含字母、数字和下划线）
   - 确认账号是公开的

3. **查看日志**：
   - 检查服务器日志，查看具体错误信息
   - 如果所有 Nitter 实例都失败，可能需要更换实例

### 问题：抓取频率过低

- 系统会自动限制抓取频率，这是为了防止被封禁
- 如果需要更频繁的更新，可以调整抓取间隔（需要修改代码）

## 支持的功能

Twitter/X 推文抓取支持以下功能：

- ✅ 自动抓取新推文
- ✅ 主题关键词过滤（使用 DeepSeek AI）
- ✅ 推文翻译
- ✅ 推文摘要生成
- ✅ 按日期分组显示
- ✅ 搜索功能

## 更新日志

- **2024-12-XX**：初始版本，支持通过 Nitter 抓取 Twitter/X 推文
