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
    
    const prompt = `请根据以下主题关键词，推荐世界上最好的、品质最高的信息源（包括网站、博客、RSS源、大V等）。

主题关键词：${keywords}

请按照以下JSON格式返回推荐结果，每个信息源包含以下字段：
- sourceName: 信息源名称
- sourceUrl: 信息源的RSS URL或博客URL（优先RSS）
- sourceType: 类型（rss/blog/twitter/linkedin等）
- category: 分类
- description: 简要描述
- region: 地区（"国内" 或 "国外"）。如果是中国（包括港澳台）的信息源，标记为"国内"；其他国家的信息源标记为"国外"

如果没有找到RSS URL，请提供博客主页URL。

请返回一个JSON数组，格式如下：
[
  {
    "sourceName": "示例网站",
    "sourceUrl": "https://example.com/rss",
    "sourceType": "rss",
    "category": "科技",
    "description": "这是一个专注于...的优质信息源",
    "region": "国外"
  }
]

请推荐15-20个最优质的信息源，确保：
1. 信息源确实存在且可访问
2. 优先推荐有RSS源的信息源
3. 包含一些知名大V或专家的信息源
4. 信息源质量高、更新频率合理
5. **重要：必须同时包含国内和国外的信息源**
   - 国内信息源：推荐5-8个中国（包括港澳台）的权威、高质量信息源，如知名科技媒体、专业博客、行业专家等
   - 国外信息源：推荐8-12个国际权威信息源，如知名科技网站、国际专家博客等
6. 国内信息源应该包括但不限于：36氪、虎嗅、机器之心、InfoQ中文站、极客时间、少数派、阮一峰的网络日志、知名技术专家的博客等

只返回JSON数组，不要添加其他说明文字。`;

    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的信息源推荐助手。请根据用户提供的主题关键词，推荐最优质的信息源。只返回有效的JSON数组，不要添加任何其他文字。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7
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
                sourceType: source.sourceType || 'rss',
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
   * 验证信息源URL是否有效
   * @param {string} url - 信息源URL
   * @returns {Promise<boolean>} 是否有效
   */
  async validateSourceUrl(url) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TopicRecommender;
