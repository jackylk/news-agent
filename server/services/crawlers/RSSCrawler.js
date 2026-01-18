const BaseCrawler = require('./BaseCrawler');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const axios = require('axios');

/**
 * RSS/Feed/XML/Atom源爬虫
 */
class RSSCrawler extends BaseCrawler {
  constructor(options = {}) {
    super();
    this.parser = new RSSParser({
      timeout: 30000,
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
        rejectUnauthorized: false,
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['description', 'description'],
        ]
      }
    });
    this.options = options;
  }

  /**
   * 延迟加载爬虫实例（避免循环依赖）
   */
  _getBlogCrawler() {
    if (!this._blogCrawler) {
      const BlogCrawler = require('./BlogCrawler');
      this._blogCrawler = new BlogCrawler(this.options);
    }
    return this._blogCrawler;
  }

  _getJSCrawler() {
    if (!this._jsCrawler) {
      const JSRenderCrawler = require('./JSRenderCrawler');
      this._jsCrawler = new JSRenderCrawler(this.options);
    }
    return this._jsCrawler;
  }

  /**
   * 从RSS Feed URL提取内容
   * @param {string} feedUrl - RSS Feed URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Array>} 文章列表
   */
  async extractFromFeed(feedUrl, options = {}) {
    try {
      let feed;
      try {
        feed = await this.parser.parseURL(feedUrl);
      } catch (parseError) {
        // 如果解析失败，尝试直接获取XML
        if (parseError.message && (
          parseError.message.includes('Unable to parse XML') || 
          parseError.message.includes('parse') || 
          parseError.message.includes('XML')
        )) {
          console.log(`RSS解析失败，尝试直接获取XML内容: ${feedUrl}`);
          try {
            const xmlResponse = await axios.get(feedUrl, {
              headers: this.defaultHeaders,
              timeout: 30000,
              maxRedirects: 5,
              responseType: 'text',
            });
            
            let xmlContent = xmlResponse.data;
            // 移除BOM
            if (xmlContent.charCodeAt(0) === 0xFEFF) {
              xmlContent = xmlContent.slice(1);
            }
            // 确保XML声明正确
            if (!xmlContent.trim().startsWith('<?xml')) {
              xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlContent;
            }
            
            feed = await this.parser.parseString(xmlContent);
            console.log(`成功通过直接获取XML解析RSS源: ${feedUrl}`);
          } catch (xmlError) {
            console.error(`直接获取XML也失败: ${xmlError.message}`);
            throw parseError;
          }
        } else {
          throw parseError;
        }
      }

      // 计算半年前的日期
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const articles = [];
      for (const item of feed.items || []) {
        const url = item.link || item.guid || '';
        if (!url) continue;

        // 检查发布日期，只保留半年内的文章
        const publishDate = item.pubDate ? new Date(item.pubDate) : new Date();
        if (publishDate < sixMonthsAgo) {
          continue; // 跳过超过半年的文章
        }

        const content = await this.extractContentFromRSSItem(item, url);
        const summary = this.extractSummaryFromRSSItem(item, content);
        const imageUrl = this.extractImageFromRSSItem(item);

        articles.push({
          title: item.title || '无标题',
          content: content,
          summary: summary,
          url: url,
          image_url: imageUrl,
          publish_date: publishDate.toISOString(),
        });
      }

      return articles;
    } catch (error) {
      console.error(`从RSS Feed提取内容失败 ${feedUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * 从RSS item提取内容
   * @param {Object} item - RSS item
   * @param {string} articleUrl - 文章URL
   * @returns {Promise<string>} 文章内容
   */
  async extractContentFromRSSItem(item, articleUrl) {
    let content = '';
    let contentHtml = '';
    
    // 检查所有可能的字段名
    const possibleFields = [
      'content:encoded',
      'contentEncoded',
      'content_encoded',
      'content',
      'contentSnippet',
      'description'
    ];
    
    for (const fieldName of possibleFields) {
      if (item[fieldName] && item[fieldName].trim()) {
        const fieldValue = item[fieldName];
        if (fieldValue.includes('<') && fieldValue.includes('>')) {
          contentHtml = fieldValue;
          content = fieldValue;
        } else {
          content = fieldValue;
        }
        break;
      }
    }
    
    // 清理HTML内容
    if (contentHtml) {
      try {
        const $ = cheerio.load(contentHtml, {
          decodeEntities: false,
          xml: false
        });
        $('script, style, nav, header, footer, .ad, .advertisement, .sidebar, .comments, .social-share, iframe').remove();
        content = $.html();
        content = content.replace(/^<html[^>]*>|<\/html>$/gi, '')
                        .replace(/^<body[^>]*>|<\/body>$/gi, '')
                        .trim();
      } catch (error) {
        console.warn('使用cheerio解析HTML失败，使用简单方法:', error.message);
        content = contentHtml
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
      }
    } else if (content && content.includes('<') && content.includes('>')) {
      content = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
    }
    
    // 如果内容太短，尝试从文章URL获取完整内容
    if (articleUrl && (!content || content.length < 500)) {
      try {
        console.log(`RSS内容不足(${content.length}字符)，从文章URL获取完整内容: ${articleUrl}`);
        
        // 先尝试静态HTML
        const html = await this.fetchHTML(articleUrl);
        const $ = cheerio.load(html);
        
        // 检查是否需要JS渲染
        if (this.shouldUsePuppeteer(articleUrl, html)) {
          console.log(`检测到需要JS渲染，使用Puppeteer: ${articleUrl}`);
          const jsResult = await this._getJSCrawler().extractContent(articleUrl);
          if (jsResult && jsResult.content && jsResult.content.length > content.length) {
            content = jsResult.content;
          }
        } else {
          // 使用博客爬虫提取内容
          const blogResult = await this._getBlogCrawler().extractContent(articleUrl);
          if (blogResult && blogResult.content && blogResult.content.length > content.length) {
            content = blogResult.content;
          }
        }
        
        if (content && content.length > 500) {
          console.log(`成功从URL获取内容，长度: ${content.length}字符`);
        }
      } catch (error) {
        console.error(`获取文章完整内容失败 ${articleUrl}:`, error.message);
      }
    }
    
    return content ? content.substring(0, 50000) : '';
  }

  /**
   * 从RSS item提取摘要
   * @param {Object} item - RSS item
   * @param {string} content - 文章内容
   * @returns {string} 摘要
   */
  extractSummaryFromRSSItem(item, content) {
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

  /**
   * 从RSS item提取图片
   * @param {Object} item - RSS item
   * @returns {string} 图片URL
   */
  extractImageFromRSSItem(item) {
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

  /**
   * 提取文章内容（实现基类方法）
   * @param {string} url - RSS Feed URL或文章URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 包含title, content, summary等的对象
   */
  async extractContent(url, options = {}) {
    // 如果是RSS Feed URL，提取所有文章
    if (url.includes('/rss') || url.includes('/feed') || 
        url.includes('/atom') || url.endsWith('.xml') || 
        url.endsWith('.rss') || url.endsWith('.atom')) {
      const articles = await this.extractFromFeed(url, options);
      // 返回第一篇文章（或可以根据需要返回所有文章）
      return articles.length > 0 ? articles[0] : null;
    }

    // 如果是文章URL，使用博客爬虫
    return await this._getBlogCrawler().extractContent(url, options);
  }
}

module.exports = RSSCrawler;
