const axios = require('axios');
const RSSParser = require('rss-parser');
const News = require('../models/News');

const parser = new RSSParser();

// 新闻源名称映射（将RSS源的标题映射为更友好的名称）
const SOURCE_NAME_MAP = {
  'Databricks Release Notes': 'Databricks',
  'Databricks Documentation': 'Databricks',
  // 可以继续添加其他映射
};

// 新闻源分类映射（根据来源自动分类）
const SOURCE_CATEGORY_MAP = {
  // 科技新闻
  '36氪': '科技',
  'TechCrunch': '科技',
  'The Verge': '科技',
  'O\'Reilly Radar': '科技',
  // 云技术
  'Google Cloud': '云技术',
  'AWS': '云技术',
  'Databricks': '云技术',
  // 综合资讯
  '虎嗅': '综合',
  'CNN': '综合',
  // 默认分类
  'default': '科技'
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

// 科技新闻RSS源列表
const RSS_FEEDS = [
  // 36氪RSS源（综合资讯）
  'https://36kr.com/feed', // 36氪 - 综合资讯
  // 虎嗅网RSS源
  'https://rss.huxiu.com/', // 虎嗅网 - 资讯栏目
  // 国际科技新闻RSS源
  'https://rss.cnn.com/rss/edition.rss', // CNN科技新闻
  'https://feeds.feedburner.com/oreilly/radar', // O'Reilly Radar
  'https://techcrunch.com/feed/', // TechCrunch
  'https://www.theverge.com/rss/index.xml', // The Verge
  // 云厂商与大数据博客RSS源
  'https://cloudblog.withgoogle.com/blog/rss/', // Google Cloud Blog（旧入口，部分文章）
  'https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/rss/', // Google Cloud 官方博客（新入口）
  'https://feeds.feedburner.com/AmazonWebServicesBlog', // AWS 官方博客
  'https://docs.databricks.com/aws/en/feed.xml', // Databricks 文档博客
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
