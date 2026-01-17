# DeepSeek API 配置指南

## 已配置的 API Key

你的 DeepSeek API Key 已添加到配置中：
```
sk
```

## 在 Railway 上配置

### 步骤：

1. **打开 Railway 项目**
   - 访问 https://railway.app
   - 进入你的项目

2. **添加环境变量**
   - 点击你的服务（Service）
   - 点击 "Variables" 标签
   - 点击 "New Variable"
   - 添加：
     - **Name**: `DEEPSEEK_API_KEY`
     - **Value**: `sk-30d75a8ee66d43e89449736541fc6fdb`
   - 点击 "Add"

3. **重新部署**
   - Railway 会自动检测环境变量变更并重新部署
   - 或者手动触发重新部署

## 验证配置

部署完成后，测试摘要功能：
1. 打开一篇超过500字的新闻
2. 点击"生成摘要"按钮
3. 应该能看到由 DeepSeek AI 生成的简洁摘要（100-150字）

## API 使用说明

- **模型**: `deepseek-chat`
- **摘要长度**: 100-150字
- **温度**: 0.3（较低温度，生成更稳定的摘要）
- **最大 tokens**: 200

## 备选方案

如果 DeepSeek API 不可用，系统会自动尝试：
1. OpenAI API（如果配置了 `OPENAI_API_KEY`）
2. Hugging Face API（免费，但质量较低）
3. 简单提取式摘要（最后备选）

## 注意事项

- API Key 已配置在环境变量中，不会暴露给前端
- 建议定期检查 API 使用量和费用
- DeepSeek API 文档：https://platform.deepseek.com/api-docs/
