const axios = require('axios');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const News = require('../models/News');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 配置RSS解析器，添加超时和重试机制
// 注意：rss-parser 会自动解析 content:encoded，但可能以不同的字段名存在
const parser = new RSSParser({
  timeout: 30000, // 30秒超时
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  },
  maxRedirects: 5,
  requestOptions: {
    timeout: 30000,
    rejectUnauthorized: false, // 允许自签名证书
  },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'description'],
    ]
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

  // 提取内容（从RSS item或文章URL获取完整内容，保留HTML格式）
  async extractContent(item, articleUrl = null) {
    // 首先尝试从RSS item中获取内容
    // rss-parser 可能将 content:encoded 解析为不同的字段名，需要检查所有可能的变体
    let content = '';
    let contentHtml = ''; // 保留HTML格式的内容
    
    // 检查所有可能的字段名（rss-parser可能使用不同的命名）
    const possibleFields = [
      'content:encoded',      // 原始字段名
      'contentEncoded',       // 驼峰命名
      'content_encoded',      // 下划线命名
      'content',              // 标准content字段
      'contentSnippet',       // 内容摘要
      'description'           // 描述字段
    ];
    
    // 遍历所有可能的字段
    for (const fieldName of possibleFields) {
      if (item[fieldName] && item[fieldName].trim()) {
        const fieldValue = item[fieldName];
        // 如果字段值看起来像HTML（包含标签），保存为HTML内容
        if (fieldValue.includes('<') && fieldValue.includes('>')) {
          contentHtml = fieldValue;
          content = fieldValue; // 保留HTML格式
        } else {
          content = fieldValue;
        }
        break; // 找到第一个有效字段就停止
      }
    }
    
    // 如果有HTML内容，使用cheerio清理但保留格式
    if (contentHtml) {
      try {
        const $ = cheerio.load(contentHtml, {
          decodeEntities: false, // 保留HTML实体
          xml: false
        });
        // 移除脚本、样式、广告等不需要的元素，但保留其他HTML结构
        $('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, iframe').remove();
        // 保留HTML格式，只清理危险元素
        content = $.html();
        // 移除最外层的html和body标签（如果存在）
        content = content.replace(/^<html[^>]*>|<\/html>$/gi, '').replace(/^<body[^>]*>|<\/body>$/gi, '').trim();
      } catch (error) {
        // 如果cheerio解析失败，使用简单的清理方法，但保留基本HTML标签
        console.warn('使用cheerio解析HTML失败，使用简单方法:', error.message);
        // 只移除危险标签，保留其他HTML
        content = contentHtml
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
      }
    } else if (content) {
      // 对于非HTML内容，检查是否包含HTML标签
      if (content.includes('<') && content.includes('>')) {
        // 包含HTML标签，清理危险元素但保留格式
        content = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
      }
      // 如果不包含HTML，保持原样（纯文本）
    }
    
    // 如果内容太短（少于500字符），尝试从文章URL获取完整内容
    const url = articleUrl || item.link || item.guid || '';
    if (url && (!content || content.length < 500)) {
      try {
        console.log(`RSS内容不足(${content.length}字符)，从文章URL获取完整内容: ${url}`);
        const fullContent = await this.fetchArticleContent(url);
        if (fullContent && fullContent.length > content.length) {
          console.log(`成功从URL获取内容，长度: ${fullContent.length}字符`);
          content = fullContent;
        }
      } catch (error) {
        console.error(`获取文章完整内容失败 ${url}:`, error.message);
        // 如果获取失败，继续使用RSS中的内容
      }
    }
    
    // 限制长度，但保留更多内容（增加到50000字符以容纳HTML）
    return content ? content.substring(0, 50000) : '';
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
        
        // 针对不同网站的特殊处理
        let articleContent = '';
        
        // 1. Karpathy博客等GitHub Pages网站的特殊处理
        if (url.includes('karpathy.github.io') || url.includes('.github.io')) {
          const articleBody = $('article, .post, .post-content, .entry-content, main article, [role="article"]');
          if (articleBody.length > 0) {
            articleBody.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles, .post-header, .post-meta').remove();
            // 保留HTML格式
            articleContent = articleBody.html();
            if (articleContent && articleContent.length > 500) {
              return articleContent.trim();
            }
          }
        }
        
        // 2. InfoQ网站的特殊处理
        if (url.includes('infoq.cn') || url.includes('infoq.com')) {
          const articleBody = $('.article-content, .article-body, .article-text, article .content, .post-content');
          if (articleBody.length > 0) {
            articleBody.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles, .article-meta, .author-info').remove();
            // 保留HTML格式
            articleContent = articleBody.html();
            if (articleContent && articleContent.length > 500) {
              return articleContent.trim();
            }
          }
          // 如果还没找到，尝试更通用的选择器
          if (!articleContent || articleContent.length < 500) {
            const mainContent = $('main, .main-content, #main-content, .content-wrapper');
            if (mainContent.length > 0) {
              mainContent.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles, .article-meta, .author-info, .tags, .breadcrumb').remove();
              articleContent = mainContent.html();
              if (articleContent && articleContent.length > 500) {
                return articleContent.trim();
              }
            }
          }
        }
        
        // 3. 机器之心网站的特殊处理
        if (url.includes('jiqizhixin.com')) {
          const articleBody = $('.article-content, .article-body, article .content, .post-content, .article-text');
          if (articleBody.length > 0) {
            articleBody.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles').remove();
            // 保留HTML格式
            articleContent = articleBody.html();
            if (articleContent && articleContent.length > 500) {
              return articleContent.trim();
            }
          }
        }
        
        // 4. 通用选择器（如果还没有找到内容）- 保留HTML格式
        if (!articleContent || articleContent.length < 500) {
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
            '.article-text',
            '.article-main',
            '.post-text',
            '.post',
            'main',
          ];
          
          for (const selector of contentSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
              // 移除script、style、nav、header、footer等不需要的元素
              elements.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles').remove();
              // 保留HTML格式
              articleContent = elements.html();
              if (articleContent && articleContent.length > 500) {
                return articleContent.trim();
              }
            }
          }
        }
        
        // 5. 如果没找到，尝试从body中提取主要内容（保留HTML）
        if (!articleContent || articleContent.length < 500) {
          $('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles, .related-posts, .navigation, .menu').remove();
          // 保留HTML格式
          articleContent = $('body').html();
          if (articleContent) {
            // 如果内容太长，只取前一部分
            if (articleContent.length > 50000) {
              // 尝试找到主要内容区域
              const mainContent = $('main, article, .content, #content');
              if (mainContent.length > 0) {
                articleContent = mainContent.html();
              } else {
                articleContent = articleContent.substring(0, 50000);
              }
            }
            return articleContent.trim();
          }
        }
        
        return articleContent || '';
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
  async collectForUser(userId, subscriptions, onProgress = null, topicKeywords = null) {
    console.log(`\n========== 开始为用户 ${userId} 收集新闻 ==========`);
    console.log(`订阅源数量: ${subscriptions.length}`);
    if (topicKeywords && topicKeywords.trim()) {
      console.log(`✓ 主题关键词: "${topicKeywords}" - 将使用 DeepSeek AI 进行主题相关性过滤`);
    } else {
      console.log(`✗ 未提供主题关键词 - 不会进行主题相关性过滤，将保存所有文章`);
    }
    console.log(`================================================\n`);
    
    let totalCollected = 0;
    const totalSources = subscriptions.length;
    
    // 用于批量收集文章（所有信息源的文章）
    const allCollectedArticles = [];
    
    // 从订阅中获取主题关键词（所有订阅应该属于同一个主题）
    const subscriptionTopicKeywords = subscriptions.length > 0 && subscriptions[0].topic_keywords 
      ? subscriptions[0].topic_keywords 
      : null;

    for (let index = 0; index < subscriptions.length; index++) {
      const subscription = subscriptions[index];
      try {
        const { source_url, source_type, source_name, category, topic_keywords } = subscription;
        
        // 使用订阅中的 topic_keywords，如果没有则使用传入的参数
        const currentTopicKeywords = topic_keywords || topicKeywords || subscriptionTopicKeywords;
        
        // 报告进度：开始处理某个源
        if (onProgress) {
          onProgress({
            type: 'progress',
            current: index + 1,
            total: totalSources,
            sourceName: source_name,
            status: 'collecting',
            message: `正在收集: ${source_name} (${index + 1}/${totalSources})`
          });
        }
        
        let result = { count: 0, articles: [] };
        const normalizedSourceType = (source_type || '').toLowerCase();
        const lowerUrl = source_url.toLowerCase();
        
        // 判断信息源类型并调用相应的收集方法
        if (normalizedSourceType === 'rss' || normalizedSourceType === 'feed' || 
            normalizedSourceType === 'xml' || normalizedSourceType === 'atom' ||
            lowerUrl.includes('/rss') || lowerUrl.includes('/feed') || 
            lowerUrl.includes('/atom') || lowerUrl.endsWith('.xml') ||
            lowerUrl.endsWith('.rss') || lowerUrl.endsWith('.atom')) {
          // RSS/Feed/XML/Atom源
          console.log(`[收集源 ${index + 1}/${totalSources}] 处理Feed源 (${normalizedSourceType || 'auto'}): ${source_name}${currentTopicKeywords ? ` (主题: ${currentTopicKeywords})` : ''}`);
          result = await this.collectFromRSSFeedForUser(source_url, userId, source_name, category, 3, onProgress, currentTopicKeywords);
        } else if (normalizedSourceType === 'blog' || 
                   lowerUrl.includes('/blog') || lowerUrl.includes('blog.') ||
                   lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com')) {
          // 博客类型
          console.log(`[收集源 ${index + 1}/${totalSources}] 处理博客源: ${source_name}${currentTopicKeywords ? ` (主题: ${currentTopicKeywords})` : ''}`);
          result = await this.collectFromBlogForUser(source_url, userId, source_name, category, onProgress, currentTopicKeywords);
        } else if (normalizedSourceType === 'news' || 
                   lowerUrl.includes('/news') || lowerUrl.includes('news.')) {
          // 新闻网站类型
          console.log(`[收集源 ${index + 1}/${totalSources}] 处理新闻网站: ${source_name}${currentTopicKeywords ? ` (主题: ${currentTopicKeywords})` : ''}`);
          result = await this.collectFromNewsWebsiteForUser(source_url, userId, source_name, category, onProgress, currentTopicKeywords);
        } else {
          // 其他类型（website、social等），尝试作为博客或新闻网站处理
          console.log(`[收集源 ${index + 1}/${totalSources}] 处理网站源 (${normalizedSourceType || 'auto'}): ${source_name}${currentTopicKeywords ? ` (主题: ${currentTopicKeywords})` : ''}`);
          result = await this.collectFromBlogForUser(source_url, userId, source_name, category, onProgress, currentTopicKeywords);
        }
        
        // 收集文章到数组（如果有主题关键词，先不保存，等批量过滤）
        if (result.articles && result.articles.length > 0) {
          allCollectedArticles.push(...result.articles);
        }
        
        // 如果没有主题关键词，直接保存（旧逻辑）
        if (!currentTopicKeywords || !currentTopicKeywords.trim()) {
          totalCollected += result.count || 0;
        }
        
        // 报告进度：完成某个源
        if (onProgress) {
          onProgress({
            type: 'progress',
            current: index + 1,
            total: totalSources,
            sourceName: source_name,
            status: 'completed',
            collected: result.count || 0,
            message: `完成: ${source_name}，收集 ${result.count || 0} 条新闻 (${index + 1}/${totalSources})`
          });
        }
        
        // 避免请求过快
        await this.sleep(1000);
      } catch (error) {
        console.error(`为用户 ${userId} 收集订阅源 "${subscription.source_name}" 失败:`, error.message);
        
        // 报告进度：错误
        if (onProgress) {
          onProgress({
            type: 'progress',
            current: index + 1,
            total: totalSources,
            sourceName: subscription.source_name,
            status: 'error',
            error: error.message,
            message: `失败: ${subscription.source_name} - ${error.message} (${index + 1}/${totalSources})`
          });
        }
      }
    }

    // 如果有主题关键词且收集到了文章，进行批量过滤
    // 使用订阅中的主题关键词（所有订阅应该属于同一个主题）
    const finalTopicKeywords = subscriptionTopicKeywords || topicKeywords;
    if (finalTopicKeywords && finalTopicKeywords.trim() && allCollectedArticles.length > 0) {
      console.log(`\n[DeepSeek过滤] ============================================`);
      console.log(`[DeepSeek过滤] 主题关键词: "${finalTopicKeywords}"`);
      console.log(`[DeepSeek过滤] 收集到的文章总数: ${allCollectedArticles.length}`);
      console.log(`[DeepSeek过滤] 开始调用 DeepSeek API 进行批量相关性判断...`);
      
      const relevanceResults = await this.batchCheckArticleRelevance(allCollectedArticles, finalTopicKeywords);
      
      // 只保存相关的文章
      const relevantArticles = allCollectedArticles.filter((_, index) => relevanceResults[index]);
      const irrelevantCount = allCollectedArticles.length - relevantArticles.length;
      
      console.log(`[DeepSeek过滤] 判断完成！`);
      console.log(`[DeepSeek过滤] 相关文章: ${relevantArticles.length} 篇`);
      console.log(`[DeepSeek过滤] 不相关文章: ${irrelevantCount} 篇（已过滤）`);
      console.log(`[DeepSeek过滤] ============================================\n`);
      
      // 保存相关文章
      for (const articleData of relevantArticles) {
        // 确保文章数据包含用户ID和主题关键词
        articleData.user_id = userId;
        articleData.topic_keywords = finalTopicKeywords;
        articleData.is_relevant_to_topic = true;
        
        await new Promise((resolve, reject) => {
          News.create(articleData, (err, result) => {
            if (err) {
              console.error(`保存文章失败 ${articleData.url}:`, err.message);
              reject(err);
            } else {
              totalCollected++;
              console.log(`[用户${userId}] 已保存相关文章: ${articleData.title}`);
              
              // 实时发送收集到的文章
              if (onProgress && result) {
                onProgress({
                  type: 'articleCollected',
                  article: {
                    id: result.id,
                    ...articleData,
                    date: articleData.publish_date,
                    is_relevant_to_topic: true
                  }
                });
              }
              
              resolve(result);
            }
          });
        });
      }
      
      // 发送过滤统计信息
      if (onProgress) {
        onProgress({
          type: 'filterStats',
          total: allCollectedArticles.length,
          relevant: relevantArticles.length,
          irrelevant: irrelevantCount,
          topicKeywords: finalTopicKeywords
        });
      }
    }

    console.log(`为用户 ${userId} 收集完成，共收集 ${totalCollected} 条新新闻`);
    
    // 报告最终结果
    if (onProgress) {
      onProgress({
        type: 'complete',
        totalCollected: totalCollected,
        totalSources: totalSources,
        message: `收集完成！共从 ${totalSources} 个源收集 ${totalCollected} 条新闻`
      });
    }
    
    return totalCollected;
  }

  // 从单个RSS源收集（带用户ID，带重试机制）
  async collectFromRSSFeedForUser(feedUrl, userId, sourceName, category, maxRetries = 3, onProgress = null, topicKeywords = null) {
    let lastError = null;
    let collectedCount = 0;
    const collectedArticles = []; // 用于批量收集

    // 重试逻辑
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`第 ${attempt} 次尝试连接 ${feedUrl}...`);
          // 每次重试前等待递增的时间
          await this.sleep(attempt * 1000);
        }

        // 对于InfoQ等特殊RSS源，先尝试直接获取XML内容
        let feed;
        try {
          feed = await parser.parseURL(feedUrl);
        } catch (parseError) {
          // 如果解析失败，尝试先获取原始XML，然后手动解析
          if (parseError.message && (parseError.message.includes('Unable to parse XML') || parseError.message.includes('parse') || parseError.message.includes('XML'))) {
            console.log(`RSS解析失败，尝试直接获取XML内容: ${feedUrl}`);
            try {
              const xmlResponse = await axios.get(feedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
                },
                timeout: 30000,
                maxRedirects: 5,
                responseType: 'text',
              });
              
              // 清理XML内容，移除可能导致解析问题的字符
              let xmlContent = xmlResponse.data;
              // 移除BOM
              if (xmlContent.charCodeAt(0) === 0xFEFF) {
                xmlContent = xmlContent.slice(1);
              }
              // 确保XML声明正确
              if (!xmlContent.trim().startsWith('<?xml')) {
                xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlContent;
              }
              
              // 使用清理后的XML重新解析
              feed = await parser.parseString(xmlContent);
              console.log(`成功通过直接获取XML解析RSS源: ${feedUrl}`);
            } catch (xmlError) {
              console.error(`直接获取XML也失败: ${xmlError.message}`);
              throw parseError; // 抛出原始错误
            }
          } else {
            throw parseError;
          }
        }

        for (const item of feed.items) {
          const url = item.link || item.guid || '';
          if (!url) continue;

          // 检查文章是否已存在（需要检查 user_id 和 topic_keywords 的组合）
          const exists = await new Promise((resolve, reject) => {
            News.exists(url, userId, topicKeywords, (err, res) => {
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
              user_id: userId,
              topic_keywords: topicKeywords || null,
              is_relevant_to_topic: null // 稍后在批量过滤时设置
            };

            // 如果有主题关键词，先收集到数组，稍后批量过滤
            if (topicKeywords && topicKeywords.trim()) {
              collectedArticles.push(newsData);
            } else {
              // 没有主题关键词，直接保存（旧逻辑）
              await new Promise((resolve, reject) => {
                News.create(newsData, (err, result) => {
                  if (err) reject(err);
                  else {
                    collectedCount++;
                    console.log(`[用户${userId}] 已收集: ${newsData.title}`);
                    
                    // 实时发送收集到的文章
                    if (onProgress && result) {
                      onProgress({
                        type: 'articleCollected',
                        article: {
                          id: result.id,
                          ...newsData,
                          date: newsData.publish_date
                        }
                      });
                    }
                    
                    resolve(result);
                  }
                });
              });
            }
          }
        }

        console.log(`从RSS源 ${feedUrl} 收集完成，共收集 ${topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount} 条新新闻`);
        return {
          count: topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount,
          articles: collectedArticles
        };
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
  async collectFromBlogForUser(blogUrl, userId, sourceName, category, onProgress = null, topicKeywords = null) {
    console.log(`开始从博客 ${blogUrl} 收集文章（用户 ${userId}）...`);
    let collectedCount = 0;
    const collectedArticles = []; // 用于批量收集

    try {
      // 获取博客主页
      const response = await axios.get(blogUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const articleLinks = new Set();

      // 多种方式查找文章链接
      const linkSelectors = [
        'article a[href]',
        '.post a[href]',
        '.entry a[href]',
        '.blog-post a[href]',
        'h2 a[href]',
        'h3 a[href]',
        '.post-title a[href]',
        '.entry-title a[href]',
        'a[href*="/blog/"]',
        'a[href*="/post/"]',
        'a[href*="/article/"]',
        'a[href*="/entry/"]',
        'a[href*="/news/"]',
        'a[href*="/p/"]', // Medium等平台
      ];

      linkSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
          const href = $(elem).attr('href');
          if (!href) return;

          let articleUrl = href;
          if (href.startsWith('/')) {
            try {
              const urlObj = new URL(blogUrl);
              articleUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
            } catch (e) {
              return;
            }
          } else if (!href.startsWith('http')) {
            articleUrl = `${blogUrl.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
          }

          // 过滤掉非文章链接
          if (articleUrl && 
              !articleUrl.includes('#') && 
              !articleUrl.includes('mailto:') &&
              !articleUrl.includes('javascript:') &&
              (articleUrl.includes('/blog/') || 
               articleUrl.includes('/post/') || 
               articleUrl.includes('/article/') ||
               articleUrl.includes('/entry/') ||
               articleUrl.includes('/news/') ||
               articleUrl.includes('/p/') ||
               /\/\d{4}\/\d{2}\//.test(articleUrl))) { // 日期格式的URL
            articleLinks.add(articleUrl);
          }
        });
      });

      console.log(`找到 ${articleLinks.size} 个可能的文章链接`);

      // 处理每篇文章（限制最多20篇）
      const linksArray = Array.from(articleLinks).slice(0, 20);
      for (const articleUrl of linksArray) {
        try {
          // 检查是否已存在（需要检查 user_id 和 topic_keywords 的组合）
          const exists = await new Promise((resolve, reject) => {
            News.exists(articleUrl, userId, topicKeywords, (err, res) => {
              if (err) reject(err);
              else resolve(res);
            });
          });

          if (exists) {
            continue;
          }

          // 提取文章内容
          const articleData = await this.extractArticleFromBlogUrl(articleUrl, sourceName, category, userId);
          
          if (articleData && articleData.title && articleData.content) {
            // 设置用户ID和主题关键词
            articleData.user_id = userId;
            articleData.topic_keywords = topicKeywords || null;
            articleData.is_relevant_to_topic = null; // 稍后在批量过滤时设置
            
            // 如果有主题关键词，先收集到数组，稍后批量过滤
            if (topicKeywords && topicKeywords.trim()) {
              collectedArticles.push(articleData);
            } else {
              // 没有主题关键词，直接保存（旧逻辑）
              await new Promise((resolve, reject) => {
                News.create(articleData, (err, result) => {
                  if (err) {
                    console.error(`保存文章失败 ${articleUrl}:`, err.message);
                    reject(err);
                  } else {
                    collectedCount++;
                    console.log(`已收集: ${articleData.title}`);
                    
                    // 实时发送收集到的文章
                    if (onProgress && result) {
                      onProgress({
                        type: 'articleCollected',
                        article: {
                          id: result.id,
                          ...articleData,
                          date: articleData.publish_date
                        }
                      });
                    }
                    
                    resolve(result);
                  }
                });
              });
            }
          }

          // 避免请求过快
          await this.sleep(1500);
        } catch (error) {
          console.error(`处理文章 ${articleUrl} 失败:`, error.message);
        }
      }

      console.log(`从博客 ${blogUrl} 收集完成，共收集 ${topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount} 条新文章`);
      return {
        count: topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount,
        articles: collectedArticles
      };
    } catch (error) {
      console.error(`从博客 ${blogUrl} 收集失败:`, error.message);
      return { count: 0, articles: [] };
    }
  }

  // 从新闻网站收集（带用户ID）
  async collectFromNewsWebsiteForUser(newsUrl, userId, sourceName, category, onProgress = null, topicKeywords = null) {
    console.log(`开始从新闻网站 ${newsUrl} 收集文章（用户 ${userId}）...`);
    let collectedCount = 0;
    const collectedArticles = []; // 用于批量收集

    try {
      // 获取新闻网站主页或列表页
      const response = await axios.get(newsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      const articleLinks = new Set();

      // 多种方式查找新闻文章链接（针对新闻网站的特殊选择器）
      const linkSelectors = [
        'article a[href]',
        '.news-item a[href]',
        '.article-item a[href]',
        '.story a[href]',
        '.post a[href]',
        'h2 a[href]',
        'h3 a[href]',
        '.headline a[href]',
        '.title a[href]',
        'a[href*="/news/"]',
        'a[href*="/article/"]',
        'a[href*="/story/"]',
        'a[href*="/post/"]',
        'a[href*="/2024/"]', // 日期格式
        'a[href*="/2023/"]',
        '[data-article-url]',
        '[data-story-url]',
      ];

      linkSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
          const href = $(elem).attr('href') || $(elem).attr('data-article-url') || $(elem).attr('data-story-url');
          if (!href) return;

          let articleUrl = href;
          if (href.startsWith('/')) {
            try {
              const urlObj = new URL(newsUrl);
              articleUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
            } catch (e) {
              return;
            }
          } else if (!href.startsWith('http')) {
            articleUrl = `${newsUrl.replace(/\/$/, '')}/${href.replace(/^\//, '')}`;
          }

          // 过滤掉非文章链接
          if (articleUrl && 
              !articleUrl.includes('#') && 
              !articleUrl.includes('mailto:') &&
              !articleUrl.includes('javascript:') &&
              !articleUrl.includes('/tag/') &&
              !articleUrl.includes('/category/') &&
              !articleUrl.includes('/author/') &&
              (articleUrl.includes('/news/') || 
               articleUrl.includes('/article/') ||
               articleUrl.includes('/story/') ||
               articleUrl.includes('/post/') ||
               /\/\d{4}\/\d{2}\//.test(articleUrl))) { // 日期格式的URL
            articleLinks.add(articleUrl);
          }
        });
      });

      console.log(`找到 ${articleLinks.size} 个可能的新闻文章链接`);

      // 处理每篇文章（限制最多30篇）
      const linksArray = Array.from(articleLinks).slice(0, 30);
      for (const articleUrl of linksArray) {
        try {
          // 检查是否已存在（需要检查 user_id 和 topic_keywords 的组合）
          const exists = await new Promise((resolve, reject) => {
            News.exists(articleUrl, userId, topicKeywords, (err, res) => {
              if (err) reject(err);
              else resolve(res);
            });
          });

          if (exists) {
            continue;
          }

          // 提取文章内容
          const articleData = await this.extractArticleFromBlogUrl(articleUrl, sourceName, category, userId);
          
          if (articleData && articleData.title && articleData.content) {
            // 设置用户ID和主题关键词
            articleData.user_id = userId;
            articleData.topic_keywords = topicKeywords || null;
            articleData.is_relevant_to_topic = null; // 稍后在批量过滤时设置
            
            // 如果有主题关键词，先收集到数组，稍后批量过滤
            if (topicKeywords && topicKeywords.trim()) {
              collectedArticles.push(articleData);
            } else {
              // 没有主题关键词，直接保存（旧逻辑）
              await new Promise((resolve, reject) => {
                News.create(articleData, (err, result) => {
                  if (err) {
                    console.error(`保存文章失败 ${articleUrl}:`, err.message);
                    reject(err);
                  } else {
                    collectedCount++;
                    console.log(`已收集: ${articleData.title}`);
                    
                    // 实时发送收集到的文章
                    if (onProgress && result) {
                      onProgress({
                        type: 'articleCollected',
                        article: {
                          id: result.id,
                          ...articleData,
                          date: articleData.publish_date
                        }
                      });
                    }
                    
                    resolve(result);
                  }
                });
              });
            }
          }

          // 避免请求过快
          await this.sleep(1500);
        } catch (error) {
          console.error(`处理文章 ${articleUrl} 失败:`, error.message);
        }
      }

      console.log(`从新闻网站 ${newsUrl} 收集完成，共收集 ${topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount} 条新文章`);
      return {
        count: topicKeywords && topicKeywords.trim() ? collectedArticles.length : collectedCount,
        articles: collectedArticles
      };
    } catch (error) {
      console.error(`从新闻网站 ${newsUrl} 收集失败:`, error.message);
      return { count: 0, articles: [] };
    }
  }

  // 从博客URL提取文章标题和详细内容（增强版，支持博客、新闻网站等多种类型）
  async extractArticleFromBlogUrl(url, sourceName, category, userId, maxRetries = 2) {
    if (!url) return null;

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
          },
          timeout: 20000,
          maxRedirects: 5,
        });

        const $ = cheerio.load(response.data);

        // 提取标题 - 多种选择器（支持博客、新闻网站等多种布局）
        let title = '';
        const titleSelectors = [
          'article h1',
          'article header h1',
          '.post-title',
          '.entry-title',
          '.article-title',
          '.blog-post-title',
          '.news-title',
          '.story-title',
          '.headline',
          'h1.post-title',
          'h1.entry-title',
          'h1.article-title',
          'h1.news-title',
          '[role="article"] h1',
          'main h1',
          'main article h1',
          '.content h1',
          '#content h1',
          '.article-header h1',
          '.post-header h1',
          'header h1',
          'h1',
        ];

        for (const selector of titleSelectors) {
          const titleEl = $(selector).first();
          if (titleEl.length > 0) {
            title = titleEl.text().trim();
            if (title && title.length > 5) {
              break;
            }
          }
        }

        // 如果还没找到，尝试从title标签提取
        if (!title || title.length < 5) {
          title = $('title').text().trim();
          // 清理title（可能包含网站名称）
          title = title.split('|')[0].split('-')[0].split('—')[0].trim();
        }

        // 提取内容 - 多种选择器（支持博客、新闻网站等多种布局）
        let content = '';
        const contentSelectors = [
          'article',
          '[role="article"]',
          '.post-content',
          '.entry-content',
          '.article-content',
          '.blog-post-content',
          '.news-content',
          '.story-content',
          '.post-body',
          '.entry-body',
          '.article-body',
          '.news-body',
          '.story-body',
          'main article',
          'main .article',
          '.content',
          '#content',
          '#post-content',
          '#article-content',
          '.article-text',
          '.post-text',
          '.entry-text',
          '[class*="article"]',
          '[class*="post"]',
          '[class*="entry"]',
        ];

        for (const selector of contentSelectors) {
          const contentEl = $(selector).first();
          if (contentEl.length > 0) {
            // 移除不需要的元素（包括广告、导航、侧边栏、评论等）
            contentEl.find('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player').remove();
            
            // 提取文本内容
            content = contentEl.text().trim();
            if (content && content.length > 500) {
              break;
            }
          }
        }

        // 如果还没找到足够的内容，尝试从body提取
        if (!content || content.length < 500) {
          $('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player').remove();
          const bodyText = $('body').text().trim();
          if (bodyText.length > 500) {
            // 如果body文本太长，可能包含很多无关内容，只取前一部分
            content = bodyText.substring(0, 20000);
          } else {
            content = bodyText;
          }
        }

        // 清理内容：移除多余的空白字符
        content = content.replace(/\s+/g, ' ').trim();

        // 提取发布时间（支持多种日期格式）
        let publishDate = new Date();
        const dateSelectors = [
          'time[datetime]',
          'time[pubdate]',
          'time[pubDate]',
          '.published',
          '.post-date',
          '.entry-date',
          '.article-date',
          '.news-date',
          '.story-date',
          '.publish-date',
          '.date-published',
          '[class*="date"]',
          '[class*="time"]',
          'meta[property="article:published_time"]',
          'meta[name="publishdate"]',
          'meta[name="pubdate"]',
        ];

        for (const selector of dateSelectors) {
          const dateEl = $(selector).first();
          if (dateEl.length > 0) {
            let dateStr = dateEl.attr('datetime') || dateEl.attr('pubdate') || dateEl.attr('pubDate') || 
                         dateEl.attr('content') || dateEl.text().trim();
            if (dateStr) {
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                publishDate = parsedDate;
                break;
              }
            }
          }
        }

        // 提取图片（支持多种图片选择器）
        let imageUrl = '';
        const imageSelectors = [
          'article img',
          '.post-content img',
          '.entry-content img',
          '.article-content img',
          '.news-content img',
          '.story-content img',
          '.post-body img',
          '.article-body img',
          'main article img',
          'meta[property="og:image"]',
          'meta[name="twitter:image"]',
          'meta[property="article:image"]',
          'meta[name="image"]',
        ];

        for (const selector of imageSelectors) {
          const imgEl = $(selector).first();
          if (imgEl.length > 0) {
            if (selector.includes('meta')) {
              imageUrl = imgEl.attr('content') || '';
            } else {
              imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '';
            }
            if (imageUrl) {
              // 处理相对URL
              if (imageUrl.startsWith('/')) {
                try {
                  const urlObj = new URL(url);
                  imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                } catch (e) {
                  imageUrl = '';
                }
              } else if (!imageUrl.startsWith('http')) {
                imageUrl = `${url.replace(/\/[^/]*$/, '')}/${imageUrl}`;
              }
              if (imageUrl) break;
            }
          }
        }

        // 生成摘要
        const summary = content.substring(0, 300).trim();

        if (!title || !content || content.length < 100) {
          console.log(`文章内容不足，跳过: ${url}`);
          return null;
        }

        return {
          title: title.substring(0, 500),
          content: content.substring(0, 20000),
          summary: summary,
          source: sourceName || '未知来源',
          category: category || '未分类',
          url: url,
          image_url: imageUrl || '',
          publish_date: publishDate.toISOString(),
          user_id: userId
        };
      } catch (error) {
        const errorMsg = error.message || error.toString();
        console.error(`提取文章内容失败 (尝试 ${attempt}/${maxRetries}) ${url}:`, errorMsg);
        
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
        
        return null;
      }
    }

    return null;
  }

  // 批量检查文章与主题的相关性（使用 DeepSeek API）
  async batchCheckArticleRelevance(articles, topicKeywords) {
    if (!DEEPSEEK_API_KEY) {
      console.warn('[DeepSeek过滤] DeepSeek API Key 未配置，跳过相关性判断，将保存所有文章');
      // 如果没有配置 API Key，返回所有文章都相关
      return articles.map(() => true);
    }

    if (!articles || articles.length === 0) {
      return [];
    }

    if (!topicKeywords || !topicKeywords.trim()) {
      // 没有主题关键词，返回所有文章都相关
      return articles.map(() => true);
    }

    console.log(`[DeepSeek过滤] 开始批量判断 ${articles.length} 篇文章与主题 "${topicKeywords}" 的相关性...`);

    try {
      // 构建提示词，包含所有文章的标题和摘要
      const articlesInfo = articles.map((article, index) => {
        const title = article.title || '无标题';
        const summary = article.summary || article.content?.substring(0, 200) || '';
        return `${index + 1}. 标题: ${title}\n   摘要: ${summary}`;
      }).join('\n\n');

      const prompt = `请判断以下文章列表中的每篇文章是否与主题关键词 "${topicKeywords}" 相关。

文章列表：
${articlesInfo}

请为每篇文章判断是否与主题相关，只返回一个JSON数组，数组中的每个元素是一个布尔值（true表示相关，false表示不相关），数组的顺序与文章列表的顺序一致。

例如，如果有3篇文章，第1篇和第3篇相关，第2篇不相关，则返回：
[true, false, true]

只返回JSON数组，不要添加任何其他文字说明。`;

      const startTime = Date.now();
      
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容相关性判断助手。请根据用户提供的主题关键词，判断每篇文章是否与主题相关。只返回有效的JSON数组，数组中的每个元素是布尔值（true表示相关，false表示不相关），不要添加任何其他文字说明。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60秒超时
        }
      );

      const duration = Date.now() - startTime;
      console.log(`[DeepSeek过滤] API调用完成，耗时: ${duration}ms`);

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content.trim();
        console.log(`[DeepSeek过滤] API响应长度: ${content.length} 字符`);

        // 尝试解析JSON数组
        let results;
        try {
          // 移除可能的markdown代码块标记
          const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          results = JSON.parse(jsonContent);
        } catch (parseError) {
          console.error('[DeepSeek过滤] JSON解析失败:', parseError.message);
          console.error('[DeepSeek过滤] 响应内容:', content);
          // 如果解析失败，返回所有文章都相关（保守策略）
          return articles.map(() => true);
        }

        if (!Array.isArray(results)) {
          console.error('[DeepSeek过滤] 返回结果不是数组:', typeof results);
          return articles.map(() => true);
        }

        if (results.length !== articles.length) {
          console.warn(`[DeepSeek过滤] 返回结果数量(${results.length})与文章数量(${articles.length})不匹配，使用保守策略`);
          return articles.map(() => true);
        }

        // 确保所有结果都是布尔值
        const booleanResults = results.map(r => Boolean(r));
        const relevantCount = booleanResults.filter(r => r).length;
        const irrelevantCount = booleanResults.filter(r => !r).length;
        
        console.log(`[DeepSeek过滤] 判断结果: 相关 ${relevantCount} 篇，不相关 ${irrelevantCount} 篇`);
        
        return booleanResults;
      } else {
        console.error('[DeepSeek过滤] API响应格式异常');
        return articles.map(() => true);
      }
    } catch (error) {
      console.error('[DeepSeek过滤] API调用失败:', error.message);
      if (error.response) {
        console.error('[DeepSeek过滤] 响应状态:', error.response.status);
        console.error('[DeepSeek过滤] 响应数据:', error.response.data);
      }
      // 如果API调用失败，返回所有文章都相关（保守策略，避免丢失文章）
      return articles.map(() => true);
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
