const axios = require('axios');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const News = require('../models/News');

const parser = new RSSParser();

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
      try {
        console.log(`正在处理: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        for (const item of feed.items) {
          // 检查是否已存在
          News.exists(item.link || item.guid, async (err, exists) => {
            if (err) {
              console.error('检查新闻是否存在时出错:', err);
              return;
            }

            if (!exists) {
              // 提取内容
              const content = this.extractContent(item);
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
              News.create(newsData, (err, result) => {
                if (err) {
                  console.error('保存新闻失败:', err);
                } else {
                  collectedCount++;
                  console.log(`已收集: ${newsData.title}`);
                }
              });
            }
          });
        }

        // 等待一下避免请求过快
        await this.sleep(1000);
      } catch (error) {
        console.error(`处理RSS源 ${feedUrl} 时出错:`, error.message);
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

  // 提取内容
  extractContent(item) {
    if (item.content) {
      // 移除HTML标签
      return item.content.replace(/<[^>]*>/g, '').substring(0, 5000);
    }
    if (item.contentSnippet) {
      return item.contentSnippet.substring(0, 5000);
    }
    if (item.description) {
      return item.description.replace(/<[^>]*>/g, '').substring(0, 5000);
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
