# Agent 智能体开发者新闻源推荐

## 推荐的权威网站和博客（按优先级排序）

### 1. AI Agent 框架官方博客（高优先级）

#### LangChain
- **网站**: https://blog.langchain.dev/
- **RSS**: https://blog.langchain.dev/rss.xml 或 https://blog.langchain.dev/feed
- **说明**: LangChain 是最流行的 AI Agent 开发框架之一，官方博客定期发布教程、更新和新功能

#### AutoGPT
- **网站**: https://autogpt.net/
- **RSS**: 需要检查是否有 RSS
- **说明**: AutoGPT 是自主 AI Agent 的开源项目

#### CrewAI
- **网站**: https://www.crewai.com/blog
- **RSS**: 需要检查是否有 RSS
- **说明**: CrewAI 专注于多 Agent 协作框架

#### AutoGen (Microsoft)
- **网站**: https://microsoft.github.io/autogen/
- **GitHub**: https://github.com/microsoft/autogen
- **说明**: 微软的 AutoGen 框架，可能有博客或更新日志

### 2. 大模型公司官方博客（高优先级）

#### OpenAI Blog
- **网站**: https://openai.com/blog/
- **RSS**: https://openai.com/blog/rss.xml
- **说明**: OpenAI 官方博客，经常发布关于 GPT、Agent 相关的最新进展

#### Anthropic Blog
- **网站**: https://www.anthropic.com/news
- **RSS**: 需要检查是否有 RSS
- **说明**: Claude 的开发者 Anthropic 的官方博客

#### Google AI Blog
- **网站**: https://ai.googleblog.com/
- **RSS**: https://ai.googleblog.com/feeds/posts/default
- **说明**: Google AI 研究博客，包含 Agent 相关研究

#### DeepMind Blog
- **网站**: https://www.deepmind.com/blog
- **RSS**: 需要检查是否有 RSS
- **说明**: DeepMind 在强化学习和 Agent 研究方面处于前沿

### 3. AI/ML 开发者社区和技术博客（中优先级）

#### Hugging Face Blog
- **网站**: https://huggingface.co/blog
- **RSS**: https://huggingface.co/blog/feed.xml
- **说明**: Hugging Face 博客，经常有 Agent 和 LLM 相关文章

#### Replicate Blog
- **网站**: https://replicate.com/blog
- **RSS**: 需要检查是否有 RSS
- **说明**: AI 模型部署平台，有相关技术文章

#### Pinecone Blog
- **网站**: https://www.pinecone.io/learn/
- **RSS**: 需要检查是否有 RSS
- **说明**: 向量数据库，Agent 开发中常用

#### Weaviate Blog
- **网站**: https://weaviate.io/blog
- **RSS**: 需要检查是否有 RSS
- **说明**: 另一个流行的向量数据库

### 4. AI Agent 相关技术新闻网站（中优先级）

#### The Batch (DeepLearning.AI)
- **网站**: https://www.deeplearning.ai/the-batch/
- **RSS**: 需要检查是否有 RSS
- **说明**: Andrew Ng 的 AI 新闻简报

#### AI News (VentureBeat)
- **网站**: https://venturebeat.com/ai/
- **RSS**: https://venturebeat.com/ai/feed/
- **说明**: 科技新闻网站，有 AI/Agent 专栏

#### MIT Technology Review - AI
- **网站**: https://www.technologyreview.com/topic/artificial-intelligence/
- **RSS**: https://www.technologyreview.com/feed/
- **说明**: MIT 科技评论的 AI 专栏

### 5. 中文 AI Agent 相关资源（可选）

#### 机器之心
- **网站**: https://www.jiqizhixin.com/
- **RSS**: https://www.jiqizhixin.com/rss
- **说明**: 中文 AI 科技媒体

#### AI 科技大本营
- **网站**: https://www.csdn.net/tags/AI
- **RSS**: 需要检查是否有 RSS
- **说明**: CSDN 的 AI 专栏

#### 极客时间 - AI 专栏
- **网站**: https://time.geekbang.org/
- **RSS**: 需要检查是否有 RSS
- **说明**: 技术学习平台

## 需要验证的 RSS 源

以下网站需要手动检查是否有 RSS 源：

1. **AutoGPT**: https://autogpt.net/ - 检查是否有 RSS
2. **CrewAI**: https://www.crewai.com/blog - 检查是否有 RSS
3. **Anthropic**: https://www.anthropic.com/news - 检查是否有 RSS
4. **DeepMind**: https://www.deepmind.com/blog - 检查是否有 RSS
5. **Replicate**: https://replicate.com/blog - 检查是否有 RSS
6. **Pinecone**: https://www.pinecone.io/learn/ - 检查是否有 RSS
7. **Weaviate**: https://weaviate.io/blog - 检查是否有 RSS

## 已验证的 RSS 源列表

经过测试，以下是已验证可用的 RSS 源：

```javascript
const RSS_FEEDS = [
  // AI Agent 框架官方博客（高优先级）
  'https://openai.com/news/rss.xml', // OpenAI 官方博客 ✅ 已验证可用
  
  // AI/ML 开发者社区
  'https://venturebeat.com/ai/feed', // VentureBeat AI News ✅ 已验证可用（注意：没有尾部斜杠）
  
  // 技术新闻
  'https://www.technologyreview.com/feed/', // MIT Technology Review ✅ 已验证可用
  
  // 中文资源
  'https://www.jiqizhixin.com/rss', // 机器之心 ✅ 已验证可用
];
```

### 需要进一步验证的源

以下源需要手动访问网站确认 RSS 链接：

1. **LangChain Blog**: 原链接 `blog.langchain.dev/rss.xml` 重定向，需要找到正确的 RSS 链接
2. **Google AI Blog**: `https://ai.googleblog.com/feeds/posts/default` - 可能需要检查
3. **Hugging Face Blog**: `https://huggingface.co/blog/feed.xml` - 需要验证
4. **Anthropic Blog**: 需要查找 RSS 链接
5. **DeepMind Blog**: 需要查找 RSS 链接
6. **AutoGPT**: 需要检查是否有 RSS
7. **CrewAI**: 需要检查是否有 RSS

## 下一步行动

1. **验证 RSS 源**: 需要手动访问每个网站，确认 RSS 链接是否正确
2. **测试内容质量**: 添加几个源后，观察内容是否适合 Agent 开发者
3. **逐步添加**: 先添加已验证的高优先级源，然后根据内容质量逐步扩展
4. **更新分类**: 将分类从"科技/云技术/综合"改为更符合 Agent 开发者的分类，如：
   - Agent 框架
   - AI 研究
   - 开发工具
   - 行业新闻
