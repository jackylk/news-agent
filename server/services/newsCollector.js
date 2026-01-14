const axios = require('axios');
const RSSParser = require('rss-parser');
const News = require('../models/News');

const parser = new RSSParser();

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
  'https://cloudblog.withgoogle.com/blog/rss/', // Google Cloud Blog
  'https://research.google/blog/rss/', // Google Research Blog
  'https://feeds.feedburner.com/AmazonWebServicesBlog', // AWS 官方博客
  'https://www.databricks.com/blog/feed', // Databricks 博客
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
              
              const newsData = {
                title: item.title || '无标题',
                content: content,
                summary: summary,
                source: feed.title || '未知来源',
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
