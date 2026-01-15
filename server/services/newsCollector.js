const axios = require('axios');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const News = require('../models/News');

// 配置RSS解析器，添加超时和重试机制
const parser = new RSSParser({
  timeout: 30000, // 30秒超时
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  },
  maxRedirects: 5,
  requestOptions: {
    timeout: 30000,
    rejectUnauthorized: true,
  }
});

// 新闻源名称映射（将RSS源的标题映射为更友好的名称）
const SOURCE_NAME_MAP = {
  'Databricks Release Notes': 'Databricks',
  'Databricks Documentation': 'Databricks',
  // 可以继续添加其他映射
};

// 新闻源分类映射（根据来源自动分类 - Agent智能体开发者相关）
const SOURCE_CATEGORY_MAP = {
  // Agent框架
  'LangChain': 'Agent框架',
  'CrewAI': 'Agent框架',
  'AutoGPT': 'Agent框架',
  'AutoGen': 'Agent框架',
  // AI研究
  'OpenAI': 'AI研究',
  'Anthropic': 'AI研究',
  'Google AI': 'AI研究',
  'DeepMind': 'AI研究',
  'Hugging Face': 'AI研究',
  // 开发工具
  'VentureBeat': '行业新闻',
  'MIT Technology Review': '行业新闻',
  '机器之心': '行业新闻',
  // 默认分类
  'default': 'AI研究'
};

// 根据来源获取分类
function getCategoryBySource(sourceName) {
  for (const [key, category] of Object.entries(SOURCE_CATEGORY_MAP)) {
    if (sourceName.includes(key)) {
      return category;
    }
  }
  return SOURCE_CATEGORY_MAP.default;
}

// RSS源列表（Agent智能体开发者相关）
const RSS_FEEDS = [
  // 已验证的RSS源
  'https://openai.com/news/rss.xml', // OpenAI 官方博客
  'https://venturebeat.com/ai/feed', // VentureBeat AI News
  'https://www.technologyreview.com/feed/', // MIT Technology Review
  'https://www.jiqizhixin.com/rss', // 机器之心
];

// 备用：使用新闻API（如果需要）
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_API_URL = 'https://newsapi.org/v2/top-headlines';

class NewsCollector {
  // 从RSS源收集新闻
  async collectFromRSS() {
    console.log('开始从RSS源收集新闻...');
    let collectedCount = 0;

    for (const feedUrl of RSS_FEEDS) {
      let lastError = null;
      let success = false;
      
      // 重试逻辑
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`第 ${attempt} 次尝试连接 ${feedUrl}...`);
            await this.sleep(attempt * 1000);
          }
          
          console.log(`正在处理: ${feedUrl}`);
          const feed = await parser.parseURL(feedUrl);
          success = true;
          
          // 使用Promise处理所有items，但限制并发数
          const items = feed.items || [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // 检查是否已存在
            const exists = await new Promise((resolve, reject) => {
              News.exists(item.link || item.guid, (err, exists) => {
                if (err) reject(err);
                else resolve(exists);
              });
            });

            if (!exists) {
              // 提取内容（异步获取完整内容）
              const content = await this.extractContent(item, item.link || item.guid);
              const summary = this.extractSummary(item, content);
              
              // 处理来源名称，使用映射表或原始名称
              const sourceName = SOURCE_NAME_MAP[feed.title] || feed.title || '未知来源';
              
              // 根据来源自动分类
              const category = getCategoryBySource(sourceName);
              
              const newsData = {
                title: item.title || '无标题',
                content: content,
                summary: summary,
                source: sourceName,
                category: category,
                url: item.link || item.guid || '',
                image_url: this.extractImage(item),
                publish_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
              };

              // 保存到数据库
              await new Promise((resolve, reject) => {
                News.create(newsData, (err, result) => {
                  if (err) {
                    console.error('保存新闻失败:', err);
                    reject(err);
                  } else {
                    collectedCount++;
                    console.log(`已收集: ${newsData.title}`);
                    resolve(result);
                  }
                });
              });
              
              // 避免请求过快，每处理3篇文章等待一下
              if ((i + 1) % 3 === 0) {
                await this.sleep(1000);
              }
            }
          }

          // 等待一下避免请求过快
          await this.sleep(1000);
          break; // 成功，跳出重试循环
        } catch (error) {
          lastError = error;
          const errorMsg = error.message || error.toString();
          console.error(`处理RSS源 ${feedUrl} 时出错 (尝试 ${attempt}/3):`, errorMsg);
          
          // 如果是网络相关错误且还有重试机会，继续重试
          if (attempt < 3 && (
            errorMsg.includes('socket') ||
            errorMsg.includes('TLS') ||
            errorMsg.includes('ECONNRESET') ||
            errorMsg.includes('ETIMEDOUT') ||
            errorMsg.includes('ENOTFOUND') ||
            errorMsg.includes('timeout') ||
            errorMsg.includes('disconnected')
          )) {
            continue;
          }
          
          // 如果不是网络错误或已达到最大重试次数，跳过该源
          if (attempt === 3) {
            console.error(`处理RSS源 ${feedUrl} 失败，已重试 3 次，跳过该源`);
          }
        }
      }
      
      if (!success) {
        console.error(`跳过RSS源 ${feedUrl}，继续处理下一个源`);
      }
    }

    console.log(`新闻收集完成，共收集 ${collectedCount} 条新新闻`);
    
    // 收集完成后，检查并清理旧新闻（最多保留3000条）
    if (collectedCount > 0) {
      console.log('开始检查是否需要清理旧新闻...');
      News.autoCleanup(3000, (err, deletedCount) => {
        if (err) {
          console.error('自动清理旧新闻失败:', err);
        } else if (deletedCount > 0) {
          console.log(`自动清理完成，删除了 ${deletedCount} 条旧新闻`);
        }
      });
    }
  }

  // 从新闻API收集（备用方案）
  async collectFromAPI() {
    if (!NEWS_API_KEY) {
      console.log('未配置NEWS_API_KEY，跳过API收集');
      return;
    }

    try {
      const response = await axios.get(NEWS_API_URL, {
        params: {
          category: 'technology',
          language: 'zh',
          apiKey: NEWS_API_KEY
        }
      });

      const articles = response.data.articles || [];
      let collectedCount = 0;

      for (const article of articles) {
        News.exists(article.url, (err, exists) => {
          if (err || exists) return;

          const newsData = {
            title: article.title || '无标题',
            content: article.content || article.description || '',
            summary: article.description || '',
            source: article.source?.name || '未知来源',
            url: article.url || '',
            image_url: article.urlToImage || '',
            publish_date: article.publishedAt || new Date().toISOString()
          };

          News.create(newsData, (err) => {
            if (!err) collectedCount++;
          });
        });
      }

      console.log(`从API收集了 ${collectedCount} 条新闻`);
      
      // 收集完成后，检查并清理旧新闻（最多保留3000条）
      if (collectedCount > 0) {
        console.log('开始检查是否需要清理旧新闻...');
        News.autoCleanup(3000, (err, deletedCount) => {
          if (err) {
            console.error('自动清理旧新闻失败:', err);
          } else if (deletedCount > 0) {
            console.log(`自动清理完成，删除了 ${deletedCount} 条旧新闻`);
          }
        });
      }
    } catch (error) {
      console.error('从API收集新闻失败:', error.message);
    }
  }

  // 提取内容（从RSS item或文章URL获取完整内容）
  async extractContent(item, articleUrl = null) {
    // 首先尝试从RSS item中获取内容
    let content = '';
    if (item.content) {
      content = item.content;
    } else if (item['content:encoded']) {
      content = item['content:encoded'];
    } else if (item.contentSnippet) {
      content = item.contentSnippet;
    } else if (item.description) {
      content = item.description;
    }
    
    // 移除HTML标签，获取纯文本
    if (content) {
      content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // 如果内容太短（少于500字符），尝试从文章URL获取完整内容
    const url = articleUrl || item.link || item.guid || '';
    if (url && (!content || content.length < 500)) {
      try {
        console.log(`从文章URL获取完整内容: ${url}`);
        const fullContent = await this.fetchArticleContent(url);
        if (fullContent && fullContent.length > content.length) {
          content = fullContent;
        }
      } catch (error) {
        console.error(`获取文章完整内容失败 ${url}:`, error.message);
        // 如果获取失败，继续使用RSS中的内容
      }
    }
    
    // 限制长度，但保留更多内容（增加到20000字符）
    return content ? content.substring(0, 20000) : '';
  }

  // 从文章URL获取完整内容
  async fetchArticleContent(url, maxRetries = 2) {
    if (!url) return '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await this.sleep(1000 * attempt);
        }
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 20000,
          maxRedirects: 5,
        });

        const $ = cheerio.load(response.data);
        
        // 尝试多种常见的内容选择器
        const contentSelectors = [
          'article',
          '[role="article"]',
          '.article-content',
          '.post-content',
          '.entry-content',
          '.content',
          'main article',
          '.article-body',
          '.post-body',
          '#article-content',
          '#content',
        ];
        
        let articleContent = '';
        for (const selector of contentSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            // 移除script、style、nav、header、footer等不需要的元素
            elements.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share').remove();
            articleContent = elements.text().trim();
            if (articleContent.length > 500) {
              break;
            }
          }
        }
        
        // 如果没找到，尝试从body中提取主要内容
        if (!articleContent || articleContent.length < 500) {
          $('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share').remove();
          const bodyText = $('body').text().trim();
          // 如果body文本太长，可能包含很多无关内容，只取前一部分
          if (bodyText.length > 1000) {
            articleContent = bodyText.substring(0, 15000);
          } else {
            articleContent = bodyText;
          }
        }
        
        // 清理文本：移除多余的空白字符
        articleContent = articleContent.replace(/\s+/g, ' ').trim();
        
        return articleContent;
      } catch (error) {
        const errorMsg = error.message || error.toString();
        console.error(`获取文章内容失败 (尝试 ${attempt}/${maxRetries}) ${url}:`, errorMsg);
        
        // 如果是网络错误且还有重试机会，继续重试
        if (attempt < maxRetries && (
          errorMsg.includes('socket') ||
          errorMsg.includes('TLS') ||
          errorMsg.includes('ECONNRESET') ||
          errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('timeout')
        )) {
          continue;
        }
        
        // 如果失败，返回空字符串
        return '';
      }
    }
    
    return '';
  }

  // 提取摘要
  extractSummary(item, content) {
    if (item.contentSnippet) {
      return item.contentSnippet.substring(0, 200);
    }
    if (item.description) {
      const desc = item.description.replace(/<[^>]*>/g, '');
      return desc.substring(0, 200);
    }
    if (content) {
      return content.substring(0, 200);
    }
    return '';
  }

  // 提取图片URL
  extractImage(item) {
    if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
      return item.enclosure.url;
    }
    if (item['media:content'] && item['media:content'].$.url) {
      return item['media:content'].$.url;
    }
    // 尝试从内容中提取图片
    const content = item.content || item.description || '';
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
    if (imgMatch) {
      return imgMatch[1];
    }
    return '';
  }

  // 从博客网站收集新闻（直接爬取）
  async collectFromBlogs() {
    console.log('开始从博客网站收集新闻...');
    let collectedCount = 0;

    for (const blogConfig of BLOG_SOURCES) {
      try {
        console.log(`正在处理博客: ${blogConfig.name} (${blogConfig.listUrl})`);
        
        // 获取文章列表页
        const listResponse = await axios.get(blogConfig.listUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout: 30000,
        });

        const $ = cheerio.load(listResponse.data);
        const articleLinks = [];

        // 提取文章链接
        $(blogConfig.listSelector).each((i, elem) => {
          if (i >= blogConfig.maxArticles) return false;
          
          const href = $(elem).attr('href');
          if (href) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = blogConfig.baseUrl + href;
            } else if (!href.startsWith('http')) {
              fullUrl = blogConfig.listUrl + '/' + href;
            }
            
            // 确保是文章链接，不是其他链接
            if (fullUrl.includes('/blog/') || fullUrl.includes('/post/') || fullUrl.includes('/news/') || fullUrl.includes('/article/')) {
              articleLinks.push(fullUrl);
            }
          }
        });

        // 去重
        const uniqueLinks = [...new Set(articleLinks)];

        console.log(`找到 ${uniqueLinks.length} 篇文章链接`);

        // 处理每篇文章
        for (const articleUrl of uniqueLinks.slice(0, blogConfig.maxArticles)) {
          try {
            // 检查是否已存在（使用Promise包装）
            const exists = await new Promise((resolve, reject) => {
              News.exists(articleUrl, (err, exists) => {
                if (err) reject(err);
                else resolve(exists);
              });
            });

            if (exists) {
              continue; // 已存在，跳过
            }

            // 获取文章内容（使用Promise包装）
            const articleData = await new Promise((resolve, reject) => {
              this.extractArticleFromUrl(articleUrl, blogConfig, (err, data) => {
                if (err) reject(err);
                else resolve(data);
              });
            });

            if (articleData) {
              // 保存文章（使用Promise包装）
              await new Promise((resolve, reject) => {
                News.create(articleData, (err, result) => {
                  if (err) {
                    console.error('保存新闻失败:', err);
                    reject(err);
                  } else {
                    collectedCount++;
                    console.log(`已收集: ${articleData.title}`);
                    resolve(result);
                  }
                });
              });
            }

            // 避免请求过快
            await this.sleep(2000);
          } catch (error) {
            console.error(`处理文章 ${articleUrl} 时出错:`, error.message);
          }
        }

        // 博客之间等待更长时间
        await this.sleep(3000);
      } catch (error) {
        console.error(`处理博客 ${blogConfig.name} 时出错:`, error.message);
      }
    }

    console.log(`博客收集完成，共收集 ${collectedCount} 条新新闻`);

    // 收集完成后，检查并清理旧新闻
    if (collectedCount > 0) {
      console.log('开始检查是否需要清理旧新闻...');
      News.autoCleanup(3000, (err, deletedCount) => {
        if (err) {
          console.error('自动清理旧新闻失败:', err);
        } else if (deletedCount > 0) {
          console.log(`自动清理完成，删除了 ${deletedCount} 条旧新闻`);
        }
      });
    }
  }

  // 从URL提取文章内容
  async extractArticleFromUrl(url, blogConfig, callback) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);

      // 提取标题
      let title = '';
      $(blogConfig.titleSelector).each((i, elem) => {
        if (!title) {
          title = $(elem).text().trim();
        }
      });
      if (!title) {
        title = $('title').text().trim() || $('h1').first().text().trim();
      }

      // 提取内容
      let content = '';
      $(blogConfig.contentSelector).each((i, elem) => {
        if (!content) {
          const html = $(elem).html() || '';
          // 移除script和style标签
          content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        }
      });
      
      // 如果没找到内容，尝试提取body
      if (!content) {
        content = $('body').html() || '';
        content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      }

      // 清理HTML标签，保留文本
      const textContent = cheerio.load(content).text().trim();
      content = textContent.substring(0, 10000); // 限制长度

      // 提取发布时间
      let publishDate = new Date();
      $(blogConfig.dateSelector).each((i, elem) => {
        const dateStr = $(elem).attr('datetime') || $(elem).attr('date') || $(elem).text().trim();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            publishDate = parsedDate;
            return false; // 找到第一个有效日期就停止
          }
        }
      });

      // 提取图片
      let imageUrl = '';
      $(blogConfig.imageSelector).each((i, elem) => {
        if (!imageUrl) {
          imageUrl = $(elem).attr('src') || $(elem).attr('data-src') || '';
          if (imageUrl && !imageUrl.startsWith('http')) {
            if (imageUrl.startsWith('/')) {
              imageUrl = blogConfig.baseUrl + imageUrl;
            } else {
              imageUrl = url + '/' + imageUrl;
            }
          }
        }
      });

      // 生成摘要
      const summary = textContent.substring(0, 200).trim();

      const articleData = {
        title: title || '无标题',
        content: content,
        summary: summary,
        source: blogConfig.name,
        category: blogConfig.category || 'AI研究',
        url: url,
        image_url: imageUrl,
        publish_date: publishDate.toISOString(),
      };

      callback(null, articleData);
    } catch (error) {
      callback(error, null);
    }
  }

  // 从指定来源收集新闻
  async collectFromSource(sourceName) {
    console.log(`开始从来源 "${sourceName}" 收集新闻...`);
    
    // 检查是否是RSS源
    for (const feedUrl of RSS_FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const sourceNameFromFeed = SOURCE_NAME_MAP[feed.title] || feed.title || '未知来源';
        
        if (sourceNameFromFeed === sourceName || feed.title === sourceName) {
          // 找到匹配的RSS源，收集该源
          return await this.collectFromRSSFeed(feedUrl);
        }
      } catch (error) {
        // 继续检查下一个
      }
    }
    
    // 检查是否是博客源
    for (const blogConfig of BLOG_SOURCES) {
      if (blogConfig.name === sourceName) {
        // 找到匹配的博客源，收集该博客
        return await this.collectFromBlog(blogConfig);
      }
    }
    
    throw new Error(`未找到来源 "${sourceName}"`);
  }

  // 从单个RSS源收集（带重试机制）
  async collectFromRSSFeed(feedUrl, maxRetries = 3) {
    console.log(`正在处理RSS源: ${feedUrl}`);
    let collectedCount = 0;
    let lastError = null;

    // 重试逻辑
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`第 ${attempt} 次尝试连接 ${feedUrl}...`);
          // 每次重试前等待递增的时间（1秒、2秒、3秒）
          await this.sleep(attempt * 1000);
        }

        const feed = await parser.parseURL(feedUrl);
        const sourceName = SOURCE_NAME_MAP[feed.title] || feed.title || '未知来源';
        const category = getCategoryBySource(sourceName);
        
        for (const item of feed.items) {
          const exists = await new Promise((resolve, reject) => {
            News.exists(item.link || item.guid, (err, exists) => {
              if (err) reject(err);
              else resolve(exists);
            });
          });

          if (!exists) {
            const content = await this.extractContent(item, item.link || item.guid);
            const summary = this.extractSummary(item, content);
            
            const newsData = {
              title: item.title || '无标题',
              content: content,
              summary: summary,
              source: sourceName,
              category: category,
              url: item.link || item.guid || '',
              image_url: this.extractImage(item),
              publish_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
            };

            await new Promise((resolve, reject) => {
              News.create(newsData, (err, result) => {
                if (err) reject(err);
                else {
                  collectedCount++;
                  console.log(`已收集: ${newsData.title}`);
                  resolve(result);
                }
              });
            });
          }
        }

        console.log(`从RSS源 "${sourceName}" 收集完成，共收集 ${collectedCount} 条新新闻`);
        return collectedCount;
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || error.toString();
        console.error(`处理RSS源 ${feedUrl} 时出错 (尝试 ${attempt}/${maxRetries}):`, errorMsg);
        
        // 如果是网络相关错误且还有重试机会，继续重试
        if (attempt < maxRetries && (
          errorMsg.includes('socket') ||
          errorMsg.includes('TLS') ||
          errorMsg.includes('ECONNRESET') ||
          errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('disconnected')
        )) {
          continue;
        }
        
        // 如果不是网络错误或已达到最大重试次数，抛出错误
        if (attempt === maxRetries) {
          console.error(`从RSS源 ${feedUrl} 收集失败，已重试 ${maxRetries} 次`);
          throw lastError;
        }
      }
    }
    
    // 如果所有重试都失败
    throw lastError || new Error(`从RSS源 ${feedUrl} 收集失败`);
  }

  // 从单个博客收集
  async collectFromBlog(blogConfig) {
    console.log(`正在处理博客: ${blogConfig.name}`);
    let collectedCount = 0;

    try {
      const listResponse = await axios.get(blogConfig.listUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(listResponse.data);
      const articleLinks = [];

      $(blogConfig.listSelector).each((i, elem) => {
        if (i >= blogConfig.maxArticles) return false;
        const href = $(elem).attr('href');
        if (href) {
          let fullUrl = href;
          if (href.startsWith('/')) {
            fullUrl = blogConfig.baseUrl + href;
          } else if (!href.startsWith('http')) {
            fullUrl = blogConfig.listUrl + '/' + href;
          }
          if (fullUrl.includes('/blog/') || fullUrl.includes('/post/') || fullUrl.includes('/news/')) {
            articleLinks.push(fullUrl);
          }
        }
      });

      const uniqueLinks = [...new Set(articleLinks)];

      for (const articleUrl of uniqueLinks.slice(0, blogConfig.maxArticles)) {
        try {
          const exists = await new Promise((resolve, reject) => {
            News.exists(articleUrl, (err, exists) => {
              if (err) reject(err);
              else resolve(exists);
            });
          });

          if (exists) continue;

          const articleData = await new Promise((resolve, reject) => {
            this.extractArticleFromUrl(articleUrl, blogConfig, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });

          if (articleData) {
            await new Promise((resolve, reject) => {
              News.create(articleData, (err, result) => {
                if (err) reject(err);
                else {
                  collectedCount++;
                  console.log(`已收集: ${articleData.title}`);
                  resolve(result);
                }
              });
            });
          }

          await this.sleep(2000);
        } catch (error) {
          console.error(`处理文章 ${articleUrl} 时出错:`, error.message);
        }
      }

      console.log(`从博客 "${blogConfig.name}" 收集完成，共收集 ${collectedCount} 条新新闻`);
      return collectedCount;
    } catch (error) {
      console.error(`处理博客 ${blogConfig.name} 时出错:`, error.message);
      throw error;
    }
  }

  // 综合收集：同时从RSS和博客收集
  async collectAll() {
    console.log('开始综合收集新闻（RSS + 博客）...');
    
    // 并行收集RSS和博客
    await Promise.all([
      this.collectFromRSS().catch(err => {
        console.error('RSS收集失败:', err);
      }),
      this.collectFromBlogs().catch(err => {
        console.error('博客收集失败:', err);
      }),
    ]);
    
    console.log('综合收集完成');
  }

  // 按用户订阅收集新闻
  async collectForUser(userId, subscriptions) {
    console.log(`开始为用户 ${userId} 收集新闻，共 ${subscriptions.length} 个订阅源...`);
    let totalCollected = 0;

    for (const subscription of subscriptions) {
      try {
        const { source_url, source_type, source_name, category } = subscription;
        
        if (source_type === 'rss' || source_url.includes('/rss') || source_url.includes('/feed')) {
          // RSS源
          const count = await this.collectFromRSSFeedForUser(source_url, userId, source_name, category);
          totalCollected += count;
        } else {
          // 博客或其他类型，尝试作为博客处理
          const count = await this.collectFromBlogForUser(source_url, userId, source_name, category);
          totalCollected += count;
        }
        
        // 避免请求过快
        await this.sleep(1000);
      } catch (error) {
        console.error(`为用户 ${userId} 收集订阅源 "${subscription.source_name}" 失败:`, error.message);
      }
    }

    console.log(`为用户 ${userId} 收集完成，共收集 ${totalCollected} 条新新闻`);
    return totalCollected;
  }

  // 从单个RSS源收集（带用户ID，带重试机制）
  async collectFromRSSFeedForUser(feedUrl, userId, sourceName, category, maxRetries = 3) {
    let lastError = null;
    let collectedCount = 0;

    // 重试逻辑
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`第 ${attempt} 次尝试连接 ${feedUrl}...`);
          // 每次重试前等待递增的时间
          await this.sleep(attempt * 1000);
        }

        const feed = await parser.parseURL(feedUrl);

        for (const item of feed.items) {
          const url = item.link || item.guid || '';
          if (!url) continue;

          const exists = await new Promise((resolve, reject) => {
            News.exists(url, (err, res) => {
              if (err) reject(err);
              else resolve(res);
            });
          });

          if (!exists) {
            const content = await this.extractContent(item, url);
            const summary = this.extractSummary(item, content);

            const newsData = {
              title: item.title || '无标题',
              content: content,
              summary: summary,
              source: sourceName || feed.title || '未知来源',
              category: category || '未分类',
              url: url,
              image_url: this.extractImage(item),
              publish_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
              user_id: userId
            };

            await new Promise((resolve, reject) => {
              News.create(newsData, (err, result) => {
                if (err) reject(err);
                else {
                  collectedCount++;
                  console.log(`[用户${userId}] 已收集: ${newsData.title}`);
                  resolve(result);
                }
              });
            });
          }
        }

        console.log(`从RSS源 ${feedUrl} 收集完成，共收集 ${collectedCount} 条新新闻`);
        return collectedCount;
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || error.toString();
        console.error(`从RSS源 ${feedUrl} 收集失败 (尝试 ${attempt}/${maxRetries}):`, errorMsg);
        
        // 如果是网络相关错误且还有重试机会，继续重试
        if (attempt < maxRetries && (
          errorMsg.includes('socket') ||
          errorMsg.includes('TLS') ||
          errorMsg.includes('ECONNRESET') ||
          errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('disconnected')
        )) {
          continue;
        }
        
        // 如果不是网络错误或已达到最大重试次数，返回0
        if (attempt === maxRetries) {
          console.error(`从RSS源 ${feedUrl} 收集失败，已重试 ${maxRetries} 次，跳过该源`);
          return 0;
        }
      }
    }
    
    // 如果所有重试都失败
    console.error(`从RSS源 ${feedUrl} 收集失败，已重试 ${maxRetries} 次`);
    return 0;
  }

  // 从博客收集（带用户ID）
  async collectFromBlogForUser(blogUrl, userId, sourceName, category) {
    // 简化版：尝试从URL获取文章
    // 实际实现可能需要根据不同的博客结构定制
    try {
      const response = await axios.get(blogUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      let collectedCount = 0;

      // 尝试找到文章链接（通用选择器）
      $('a[href*="/blog/"], a[href*="/post/"], a[href*="/article/"]').each(async (i, elem) => {
        if (i >= 10) return false; // 限制数量

        const href = $(elem).attr('href');
        if (!href) return;

        let articleUrl = href;
        if (href.startsWith('/')) {
          const urlObj = new URL(blogUrl);
          articleUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
        } else if (!href.startsWith('http')) {
          articleUrl = `${blogUrl}/${href}`;
        }

        try {
          const exists = await new Promise((resolve, reject) => {
            News.exists(articleUrl, (err, res) => {
              if (err) reject(err);
              else resolve(res);
            });
          });

          if (!exists) {
            const articleContent = await this.extractArticleFromUrl(articleUrl);
            if (articleContent) {
              const newsData = {
                title: articleContent.title || '无标题',
                content: articleContent.content || '',
                summary: (articleContent.content || '').substring(0, 200),
                source: sourceName || '未知来源',
                category: category || '未分类',
                url: articleUrl,
                image_url: articleContent.image || '',
                publish_date: new Date().toISOString(),
                user_id: userId
              };

              await new Promise((resolve, reject) => {
                News.create(newsData, (err, result) => {
                  if (err) reject(err);
                  else {
                    collectedCount++;
                    resolve(result);
                  }
                });
              });
            }
          }
        } catch (error) {
          console.error(`处理文章 ${articleUrl} 失败:`, error.message);
        }
      });

      return collectedCount;
    } catch (error) {
      console.error(`从博客 ${blogUrl} 收集失败:`, error.message);
      return 0;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 如果直接运行此文件，执行收集
if (require.main === module) {
  const collector = new NewsCollector();
  collector.collectFromRSS()
    .then(() => {
      console.log('收集完成');
      process.exit(0);
    })
    .catch(err => {
      console.error('收集失败:', err);
      process.exit(1);
    });
}

module.exports = NewsCollector;
