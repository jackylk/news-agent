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
    
    const prompt = `请根据以下主题关键词，推荐世界上最好的、品质最高的信息源，包括RSS源、Feed源、XML源、Atom源、博客、新闻网站等多种类型。

主题关键词：${keywords}

**重要要求：**
1. **推荐多种类型的信息源**，包括但不限于：
   - **RSS源 (rss)**：提供RSS Feed的URL（通常以 /rss、/feed、.rss 结尾，或包含 rss 关键词）
   - **Feed源 (feed)**：提供Feed的URL（通常以 /feed、/feeds、.feed 结尾，或包含 feed 关键词）
   - **XML源 (xml)**：提供XML格式的Feed URL（通常以 .xml、/xml、/atom.xml 结尾）
   - **Atom源 (atom)**：提供Atom Feed的URL（通常以 /atom、/atom.xml、.atom 结尾）
   - **博客 (blog)**：提供博客主页URL（知名个人博客、技术博客、专业博客等）
   - **新闻网站 (news)**：提供新闻网站的主页URL或特定栏目URL
   - **专业网站 (website)**：提供专业机构、学术网站、行业网站的主页URL
   - **社交媒体 (social)**：提供知名专家的社交媒体主页（如Twitter、LinkedIn等，如果支持RSS则提供RSS URL）

2. **URL格式示例**：
   - RSS源：https://example.com/rss、https://example.com/rss.xml、https://example.com/feed.rss
   - Feed源：https://example.com/feed、https://example.com/feeds/all
   - XML源：https://example.com/feed.xml、https://example.com/sitemap.xml
   - Atom源：https://example.com/atom.xml、https://example.com/feed/atom
   - 博客：https://example.com/blog、https://blog.example.com
   - 新闻网站：https://example.com/news、https://example.com/category/tech
   - 专业网站：https://example.com

3. **确保推荐的信息源确实存在且可访问**，URL必须是真实有效的地址
4. **优先推荐知名专家、大V、权威机构的官方信息源**
5. **信息源质量高、更新频率合理、内容专业**
6. **信息源应该来自权威网站、新闻媒体、技术博客、专业机构等**

请按照以下JSON格式返回推荐结果，每个信息源包含以下字段：
- sourceName: 信息源名称（网站或博客名称）
- sourceUrl: 信息源的URL（RSS Feed URL、Feed URL、XML URL、Atom URL、博客主页URL、新闻网站URL等）
- sourceType: 信息源类型，必须是以下之一：
  - "rss"：RSS Feed源（URL是RSS Feed地址）
  - "feed"：Feed源（URL是Feed地址，可能是RSS或Atom格式）
  - "xml"：XML源（URL是XML格式的Feed）
  - "atom"：Atom源（URL是Atom Feed地址）
  - "blog"：博客（URL是博客主页或文章列表页）
  - "news"：新闻网站（URL是新闻网站主页或特定栏目）
  - "website"：专业网站（URL是网站主页）
  - "social"：社交媒体（URL是社交媒体主页或RSS Feed）
- category: 分类（如：科技、新闻、技术、行业等）
- description: 简要描述（说明这个信息源的特点和内容方向）
- region: 地区（"国内" 或 "国外"）。如果是中国（包括港澳台）的信息源，标记为"国内"；其他国家的信息源标记为"国外"

请返回一个JSON数组，格式如下：
[
  {
    "sourceName": "示例RSS源",
    "sourceUrl": "https://example.com/rss",
    "sourceType": "rss",
    "category": "科技",
    "description": "这是一个专注于...的优质RSS源",
    "region": "国外"
  },
  {
    "sourceName": "示例Feed源",
    "sourceUrl": "https://example.com/feed",
    "sourceType": "feed",
    "category": "科技",
    "description": "这是一个专注于...的Feed源",
    "region": "国外"
  },
  {
    "sourceName": "示例Atom源",
    "sourceUrl": "https://example.com/atom.xml",
    "sourceType": "atom",
    "category": "技术",
    "description": "这是一个专注于...的Atom Feed源",
    "region": "国外"
  },
  {
    "sourceName": "示例博客",
    "sourceUrl": "https://blog.example.com",
    "sourceType": "blog",
    "category": "技术",
    "description": "这是一个专注于...的知名技术博客",
    "region": "国外"
  },
  {
    "sourceName": "示例新闻网站",
    "sourceUrl": "https://news.example.com",
    "sourceType": "news",
    "category": "新闻",
    "description": "这是一个专注于...的权威新闻网站",
    "region": "国内"
  }
]

请推荐20-25个最优质的信息源，确保：
1. **类型多样化**：
   - RSS/Feed/XML/Atom源：推荐10-15个（优先推荐有Feed的源，包括RSS、Feed、XML、Atom等格式）
   - 博客：推荐5-8个（知名个人博客、技术博客等）
   - 新闻网站：推荐3-5个（权威新闻媒体）
   - 专业网站：推荐2-3个（专业机构、学术网站等）
2. **URL必须真实有效**，确保信息源确实存在且可访问
3. **包含一些知名大V、专家或权威机构的信息源**
4. **必须同时包含国内和国外的信息源**
   - 国内信息源：推荐8-12个中国（包括港澳台）的权威、高质量信息源
   - 国外信息源：推荐12-15个国际权威信息源
5. **优先推荐有Feed的信息源**（RSS、Feed、XML、Atom等），如果没有Feed，则推荐博客主页或新闻网站URL

只返回JSON数组，不要添加其他说明文字。`;

    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的信息源推荐助手。请根据用户提供的主题关键词，推荐最优质的信息源，包括RSS源、Feed源、XML源、Atom源、博客、新闻网站等多种类型。只返回有效的JSON数组，不要添加任何其他文字。确保所有URL都是真实有效的地址，sourceType字段必须是 "rss"、"feed"、"xml"、"atom"、"blog"、"news"、"website" 或 "social" 之一。'
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
              .map(source => {
                // 确定信息源类型
                let sourceType = (source.sourceType || '').toLowerCase();
                const sourceUrl = source.sourceUrl.trim().toLowerCase();
                
                // 如果未指定类型或类型无效，根据URL自动判断
                if (!['rss', 'feed', 'xml', 'atom', 'blog', 'news', 'website', 'social'].includes(sourceType)) {
                  const lowerUrl = sourceUrl.toLowerCase();
                  // 优先判断Feed类型
                  if (lowerUrl.includes('/atom') || lowerUrl.endsWith('.atom') || lowerUrl.includes('/atom.xml')) {
                    sourceType = 'atom';
                  } else if (lowerUrl.includes('/feed') || lowerUrl.includes('/feeds') || 
                             lowerUrl.endsWith('.feed') || lowerUrl.includes('feedburner')) {
                    sourceType = 'feed';
                  } else if (lowerUrl.includes('/rss') || lowerUrl.endsWith('.rss') || 
                             lowerUrl.includes('rss.xml')) {
                    sourceType = 'rss';
                  } else if (lowerUrl.endsWith('.xml') || lowerUrl.includes('/xml') ||
                             lowerUrl.includes('/sitemap')) {
                    sourceType = 'xml';
                  } else if (lowerUrl.includes('/blog') || lowerUrl.includes('blog.') ||
                             lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com') ||
                             lowerUrl.includes('wordpress.com') || lowerUrl.includes('blogger.com')) {
                    sourceType = 'blog';
                  } else if (lowerUrl.includes('/news') || lowerUrl.includes('news.') ||
                             lowerUrl.includes('cnn.com') || lowerUrl.includes('bbc.com') ||
                             lowerUrl.includes('reuters.com') || lowerUrl.includes('xinhua') ||
                             lowerUrl.includes('people.com') || lowerUrl.includes('theguardian.com')) {
                    sourceType = 'news';
                  } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('linkedin.com') ||
                             lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com')) {
                    sourceType = 'social';
                  } else {
                    sourceType = 'website'; // 默认为网站类型
                  }
                }
                
                return {
                  sourceName: source.sourceName.trim(),
                  sourceUrl: source.sourceUrl.trim(),
                  sourceType: sourceType,
                  category: source.category || '未分类',
                  description: source.description || '',
                  region: source.region || '国外' // 默认为国外，如果没有指定
                };
              });
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
   * 验证信息源URL是否有效（支持RSS、博客、新闻网站等多种类型）
   * @param {string} url - 信息源URL
   * @param {string} sourceType - 信息源类型（rss、blog、news、website）
   * @returns {Promise<{valid: boolean, error?: string}>} 验证结果
   */
  async validateSourceUrl(url, sourceType = 'rss') {
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
        
        // 检查Content-Type
        const contentType = headResponse.headers['content-type'] || '';
        console.log(`[验证信息源] HEAD请求成功，Content-Type: ${contentType}`);
        
        if (sourceType === 'rss') {
          // RSS源：检查是否包含xml、rss、atom等
          if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
            console.log(`[验证信息源] ✓ RSS源验证通过 (通过Content-Type判断)`);
            return { valid: true };
          }
        } else {
          // 博客、新闻网站、专业网站：检查是否是HTML页面
          if (contentType.includes('html') || contentType.includes('text/html')) {
            console.log(`[验证信息源] ✓ ${sourceType}类型信息源验证通过 (通过Content-Type判断)`);
            return { valid: true };
          }
          // 对于非RSS类型，也允许其他常见的Content-Type（如text/plain等）
          if (contentType.includes('text/') || contentType.includes('application/')) {
            console.log(`[验证信息源] ✓ ${sourceType}类型信息源验证通过 (通过Content-Type判断，允许继续验证)`);
            // 继续到GET请求进行内容检查
          }
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
      
      // 根据信息源类型进行不同的验证
      if (['rss', 'feed', 'xml', 'atom'].includes(sourceType)) {
        // RSS/Feed/XML/Atom源：检查是否包含RSS/XML/Atom标签
        if (contentType.includes('xml') || 
            contentType.includes('rss') || 
            contentType.includes('atom') ||
            contentStr.includes('<rss') ||
            contentStr.includes('<feed') ||
            contentStr.includes('<atom:feed') ||
            contentStr.includes('<?xml')) {
          console.log(`[验证信息源] ✓ ${sourceType}源验证通过 (通过内容检查)`);
          return { valid: true };
        }
        console.log(`[验证信息源] ✗ ${sourceType}源验证失败: 响应内容不是有效的Feed/XML格式`);
        return { valid: false, error: `响应内容不是有效的${sourceType}格式` };
      } else {
        // 博客、新闻网站、专业网站：检查是否是有效的HTML页面
        if (contentType.includes('html') || 
            contentStr.includes('<html') ||
            contentStr.includes('<!DOCTYPE') ||
            contentStr.includes('<body')) {
          console.log(`[验证信息源] ✓ ${sourceType}类型信息源验证通过 (通过内容检查)`);
          return { valid: true };
        }
        console.log(`[验证信息源] ✗ ${sourceType}类型信息源验证失败: 响应内容不是有效的HTML格式`);
        return { valid: false, error: `响应内容不是有效的${sourceType}格式` };
      }
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
      
      // 验证URL（传入信息源类型）
      const sourceType = source.sourceType || 'rss';
      const validationResult = await this.validateSourceUrl(sourceUrl, sourceType);
      
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
