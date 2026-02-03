const axios = require('axios');
const fs = require('fs');
const path = require('path');
const CrawlerFactory = require('./crawlers/CrawlerFactory');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 加载内置的高质量信息源
function loadCuratedSources() {
  try {
    const filePath = path.join(__dirname, '../data/curated-sources.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const sources = JSON.parse(content);
      console.log(`[内置信息源] 加载了 ${sources.length} 个内置信息源`);
      return sources;
    }
  } catch (error) {
    console.warn(`[内置信息源] 加载失败: ${error.message}`);
  }
  return [];
}

class TopicRecommender {
  /**
   * 根据用户输入的主题关键词，使用 DeepSeek API 推荐优质信息源
   * @param {string} keywords - 用户输入的主题关键词
   * @param {Function} onSourceReceived - 可选的流式回调函数，每收到一个源就回调
   * @returns {Promise<Array>} 推荐的信息源列表
   */
  async recommendSources(keywords, onSourceReceived = null) {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API Key 未配置');
    }

    // 加载内置的高质量信息源
    const curatedSources = loadCuratedSources();

    // 构建简洁的内置信息源描述
    let curatedSourcesText = '';
    if (curatedSources.length > 0) {
      // 只取与关键词相关的内置源，减少prompt长度
      const relevantCurated = curatedSources.filter(s => {
        const kw = keywords.toLowerCase();
        return (s.sourceName && s.sourceName.toLowerCase().includes(kw)) ||
               (s.category && s.category.toLowerCase().includes(kw)) ||
               (s.description && s.description.toLowerCase().includes(kw));
      }).slice(0, 10); // 最多取10个相关的

      if (relevantCurated.length > 0) {
        curatedSourcesText = `\n\n优先使用以下已验证的信息源：\n${JSON.stringify(relevantCurated.map(s => ({ name: s.sourceName, url: s.sourceUrl, type: s.sourceType })))}\n`;
      }
    }

    // 精简的prompt - 减少token消耗，加快响应
    const prompt = `推荐关于"${keywords}"的优质信息源。${curatedSourcesText}

要求：
1. 推荐12-15个信息源，包括RSS/Feed源(6-8个)、博客(3-4个)、新闻网站(2-3个)
2. 同时包含国内和国外信息源
3. URL必须真实有效

返回JSON数组格式：
[{"sourceName":"名称","sourceUrl":"URL","sourceType":"rss|feed|atom|xml|blog|news|website","category":"分类","description":"简短描述","region":"国内|国外"}]

只返回JSON，不要其他文字。`;

    try {
      // 使用流式API加快响应
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是信息源推荐助手。只返回有效的JSON数组，不要任何其他文字。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,  // 减少token数量
          temperature: 0.3,  // 降低温度，加快生成
          stream: false  // 暂时不使用流式，因为需要解析完整JSON
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000  // 30秒超时
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
                  sourceType = this._detectSourceType(sourceUrl);
                }

                return {
                  sourceName: source.sourceName.trim(),
                  sourceUrl: source.sourceUrl.trim(),
                  sourceType: sourceType,
                  category: source.category || '未分类',
                  description: source.description || '',
                  region: source.region || '国外'
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
   * 根据URL自动判断信息源类型
   * @param {string} url - 信息源URL
   * @returns {string} 信息源类型
   */
  _detectSourceType(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/atom') || lowerUrl.endsWith('.atom') || lowerUrl.includes('/atom.xml')) {
      return 'atom';
    } else if (lowerUrl.includes('/feed') || lowerUrl.includes('/feeds') ||
               lowerUrl.endsWith('.feed') || lowerUrl.includes('feedburner')) {
      return 'feed';
    } else if (lowerUrl.includes('/rss') || lowerUrl.endsWith('.rss') ||
               lowerUrl.includes('rss.xml')) {
      return 'rss';
    } else if (lowerUrl.endsWith('.xml') || lowerUrl.includes('/xml') ||
               lowerUrl.includes('/sitemap')) {
      return 'xml';
    } else if (lowerUrl.includes('/blog') || lowerUrl.includes('blog.') ||
               lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com') ||
               lowerUrl.includes('wordpress.com') || lowerUrl.includes('blogger.com')) {
      return 'blog';
    } else if (lowerUrl.includes('/news') || lowerUrl.includes('news.') ||
               lowerUrl.includes('cnn.com') || lowerUrl.includes('bbc.com') ||
               lowerUrl.includes('reuters.com') || lowerUrl.includes('xinhua') ||
               lowerUrl.includes('people.com') || lowerUrl.includes('theguardian.com')) {
      return 'news';
    } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('linkedin.com') ||
               lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com')) {
      return 'social';
    }
    return 'website';
  }
  
  /**
   * 验证信息源URL是否有效（支持RSS、博客、新闻网站等多种类型）
   * 使用与实际收集相同的爬虫逻辑进行验证，确保验证通过的信息源能够成功爬取
   * @param {string} url - 信息源URL
   * @param {string} sourceType - 信息源类型（rss、feed、xml、atom、blog、news、website）
   * @returns {Promise<{valid: boolean, error?: string}>} 验证结果
   */
  async validateSourceUrl(url, sourceType = 'rss') {
    try {
      console.log(`[验证信息源] 开始验证: ${url} (类型: ${sourceType})`);

      // 使用与实际收集相同的爬虫逻辑进行验证
      const crawler = CrawlerFactory.createCrawler(sourceType, url, {
        timeout: 20000 // 验证时使用20秒超时，加快验证速度
      });

      // 根据信息源类型进行不同的验证
      const detectedType = CrawlerFactory.detectSourceType(sourceType, url);

      if (detectedType === 'twitter') {
        // Twitter/X源：使用extractContent验证
        try {
          const result = await crawler.extractContent(url, { timeout: 20000, maxRetries: 1 });
          if (result && result.title && result.title.trim().length > 0) {
            console.log(`[验证信息源] ✓ Twitter源验证通过`);
            return { valid: true };
          }
          return { valid: false, error: '未能提取到有效内容' };
        } catch (extractError) {
          return { valid: false, error: `提取失败: ${extractError.message}` };
        }
      } else if (['rss', 'feed', 'xml', 'atom'].includes(sourceType) || detectedType === 'rss') {
        // RSS/Feed/XML/Atom源：实际尝试解析feed
        try {
          const articles = await crawler.extractFromFeed(url, { maxRetries: 1 });
          if (articles && articles.length > 0) {
            console.log(`[验证信息源] ✓ ${sourceType}源验证通过: ${articles.length} 篇文章`);
            return { valid: true };
          }
          return { valid: false, error: '解析成功但未提取到文章' };
        } catch (parseError) {
          return { valid: false, error: `解析失败: ${parseError.message}` };
        }
      } else {
        // 博客、新闻网站、专业网站：实际尝试提取内容
        try {
          const result = await crawler.extractContent(url, { timeout: 20000 });
          if (result && result.title && result.title.trim().length > 0) {
            console.log(`[验证信息源] ✓ ${sourceType}类型验证通过`);
            return { valid: true };
          }
          return { valid: false, error: '未能提取到有效标题' };
        } catch (extractError) {
          return { valid: false, error: `提取失败: ${extractError.message}` };
        }
      }
    } catch (error) {
      const errorMsg = error.response?.status
        ? `HTTP ${error.response.status}`
        : error.message || '连接失败';
      return { valid: false, error: errorMsg };
    }
  }

  /**
   * 并行验证多个信息源URL（加快验证速度）
   * @param {Array} sources - 信息源列表
   * @param {Function} onProgress - 进度回调函数 (sourceName, url, result, sourceData) => void
   * @param {number} concurrency - 并行数量，默认3
   * @returns {Promise<Array>} 带验证结果的信息源列表
   */
  async validateSources(sources, onProgress = null, concurrency = 3) {
    const validatedSources = [];
    const queue = [...sources];
    let activeCount = 0;
    let completedCount = 0;

    return new Promise((resolve) => {
      const processNext = async () => {
        if (queue.length === 0 && activeCount === 0) {
          resolve(validatedSources);
          return;
        }

        while (activeCount < concurrency && queue.length > 0) {
          const source = queue.shift();
          activeCount++;

          // 调用进度回调（开始验证）
          if (onProgress) {
            onProgress(source.sourceName, source.sourceUrl, { validating: true }, source);
          }

          // 异步验证
          this.validateSourceUrl(source.sourceUrl, source.sourceType || 'rss')
            .then(validationResult => {
              const validatedSource = {
                ...source,
                isValid: validationResult.valid,
                validationError: validationResult.error || null
              };
              validatedSources.push(validatedSource);

              // 调用进度回调（验证完成）
              if (onProgress) {
                onProgress(source.sourceName, source.sourceUrl, validationResult, source);
              }
            })
            .catch(error => {
              const validatedSource = {
                ...source,
                isValid: false,
                validationError: error.message
              };
              validatedSources.push(validatedSource);

              if (onProgress) {
                onProgress(source.sourceName, source.sourceUrl, { valid: false, error: error.message }, source);
              }
            })
            .finally(() => {
              activeCount--;
              completedCount++;
              processNext();
            });
        }
      };

      processNext();
    });
  }
}

module.exports = TopicRecommender;
