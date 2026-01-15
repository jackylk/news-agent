const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

class TopicRecommender {
  /**
   * 根据用户输入的主题关键词，使用 DeepSeek API 推荐优质信息源
   * @param {string} keywords - 用户输入的主题关键词
   * @returns {Promise<Array>} 推荐的信息源列表
   */
  async recommendSources(keywords) {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API Key 未配置');
    }
    
    const prompt = `请根据以下主题关键词，推荐世界上最好的、品质最高的RSS信息源。

主题关键词：${keywords}

**重要要求：**
1. **只推荐RSS源**，必须提供RSS Feed的URL（通常以 /rss、/feed、/atom.xml、.xml 结尾，或包含 rss、feed 等关键词）
2. **RSS URL格式示例**：
   - https://example.com/rss
   - https://example.com/feed
   - https://example.com/feed.xml
   - https://example.com/atom.xml
   - https://feeds.feedburner.com/example
3. **确保推荐的RSS源确实存在且可访问**，URL必须是真实有效的RSS Feed地址
4. **优先推荐知名专家、大V、权威机构的官方RSS源**
5. **信息源质量高、更新频率合理、内容专业**
6. **RSS源应该来自权威网站、新闻媒体、技术博客、专业机构等**

请按照以下JSON格式返回推荐结果，每个信息源包含以下字段：
- sourceName: 信息源名称（网站或博客名称）
- sourceUrl: RSS Feed的URL（必须是RSS URL，不是网站主页）
- sourceType: 固定为 "rss"
- category: 分类
- description: 简要描述（说明这个RSS源的特点和内容方向）
- region: 地区（"国内" 或 "国外"）。如果是中国（包括港澳台）的信息源，标记为"国内"；其他国家的信息源标记为"国外"

请返回一个JSON数组，格式如下：
[
  {
    "sourceName": "示例网站",
    "sourceUrl": "https://example.com/rss",
    "sourceType": "rss",
    "category": "科技",
    "description": "这是一个专注于...的优质RSS源",
    "region": "国外"
  }
]

请推荐15-20个最优质的RSS信息源，确保：
1. **所有URL都是RSS Feed URL**，可以直接用于RSS阅读器或RSS解析器
2. **URL必须真实有效**，确保RSS源确实存在且可访问
3. **包含一些知名大V、专家或权威机构的RSS源**
4. **必须同时包含国内和国外的信息源**
   - 国内信息源：推荐5-8个中国（包括港澳台）的权威、高质量RSS源，如知名技术网站、新闻媒体、专业机构的RSS源等
   - 国外信息源：推荐8-12个国际权威RSS源，如知名技术网站、新闻媒体、专家博客的RSS源等
5. 国内信息源应该包括但不限于：知名技术网站的RSS、新闻媒体的RSS、专业机构的RSS等

只返回JSON数组，不要添加其他说明文字。`;

    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的信息源推荐助手。请根据用户提供的主题关键词，推荐最优质的RSS信息源。只返回有效的JSON数组，不要添加任何其他文字。确保所有URL都是真实有效的RSS Feed URL。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.5
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content.trim();
        
        // 尝试解析JSON（可能包含markdown代码块）
        let jsonStr = content;
        
        // 如果包含代码块，提取JSON部分
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1];
        }
        
        // 尝试解析JSON
        try {
          const sources = JSON.parse(jsonStr);
          
          // 验证和清理数据
          if (Array.isArray(sources)) {
            return sources
              .filter(source => source.sourceName && source.sourceUrl)
              .map(source => ({
                sourceName: source.sourceName.trim(),
                sourceUrl: source.sourceUrl.trim(),
                sourceType: 'rss', // 强制设置为rss
                category: source.category || '未分类',
                description: source.description || '',
                region: source.region || '国外' // 默认为国外，如果没有指定
              }));
          }
        } catch (parseError) {
          console.error('解析DeepSeek返回的JSON失败:', parseError);
          console.error('原始内容:', content);
        }
      }
      
      // 如果解析失败，返回空数组
      return [];
    } catch (error) {
      console.error('DeepSeek API调用失败:', error.response?.data || error.message);
      throw new Error(`推荐信息源失败: ${error.message}`);
    }
  }
  
  /**
   * 验证信息源URL是否有效（针对RSS源）
   * @param {string} url - 信息源URL
   * @returns {Promise<{valid: boolean, error?: string}>} 验证结果
   */
  async validateSourceUrl(url) {
    try {
      console.log(`[验证信息源] 开始验证: ${url}`);
      
      // 首先尝试HEAD请求
      try {
        const headResponse = await axios.head(url, {
          timeout: 8000,
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        // 检查Content-Type是否包含xml、rss、atom等
        const contentType = headResponse.headers['content-type'] || '';
        console.log(`[验证信息源] HEAD请求成功，Content-Type: ${contentType}`);
        
        if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
          console.log(`[验证信息源] ✓ 验证通过 (通过Content-Type判断)`);
          return { valid: true };
        }
      } catch (headError) {
        console.log(`[验证信息源] HEAD请求失败，尝试GET请求: ${headError.message}`);
        // HEAD请求失败，尝试GET请求
      }
      
      // 尝试GET请求获取内容
      const getResponse = await axios.get(url, {
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      
      console.log(`[验证信息源] GET请求成功，状态码: ${getResponse.status}`);
      
      // 检查响应内容是否包含RSS/XML特征
      const content = getResponse.data;
      const contentType = getResponse.headers['content-type'] || '';
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      
      console.log(`[验证信息源] Content-Type: ${contentType}, 内容长度: ${contentStr.length}`);
      
      // 检查是否包含RSS/XML标签
      if (contentType.includes('xml') || 
          contentType.includes('rss') || 
          contentType.includes('atom') ||
          contentStr.includes('<rss') ||
          contentStr.includes('<feed') ||
          contentStr.includes('<?xml')) {
        console.log(`[验证信息源] ✓ 验证通过 (通过内容检查)`);
        return { valid: true };
      }
      
      console.log(`[验证信息源] ✗ 验证失败: 响应内容不是有效的RSS/XML格式`);
      return { valid: false, error: '响应内容不是有效的RSS/XML格式' };
    } catch (error) {
      const errorMsg = error.response?.status 
        ? `HTTP ${error.response.status}: ${error.response.statusText || '请求失败'}`
        : error.message || '连接失败';
      console.log(`[验证信息源] ✗ 验证失败: ${errorMsg}`);
      return { valid: false, error: errorMsg };
    }
  }
  
  /**
   * 验证多个信息源URL
   * @param {Array} sources - 信息源列表
   * @param {Function} onProgress - 进度回调函数 (sourceName, url, result, sourceData) => void
   * @returns {Promise<Array>} 带验证结果的信息源列表
   */
  async validateSources(sources, onProgress = null) {
    const validatedSources = [];
    
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const { sourceName, sourceUrl } = source;
      
      // 调用进度回调
      if (onProgress) {
        onProgress(sourceName, sourceUrl, { validating: true }, source);
      }
      
      // 验证URL
      const validationResult = await this.validateSourceUrl(sourceUrl);
      
      // 添加验证结果
      const validatedSource = {
        ...source,
        isValid: validationResult.valid,
        validationError: validationResult.error || null
      };
      
      validatedSources.push(validatedSource);
      
      // 调用进度回调，传入完整的源数据
      if (onProgress) {
        onProgress(sourceName, sourceUrl, validationResult, source);
      }
      
      // 避免请求过快，每个请求间隔500ms
      if (i < sources.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return validatedSources;
  }
}

module.exports = TopicRecommender;
