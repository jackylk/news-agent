const axios = require('axios');
const cheerio = require('cheerio');

/**
 * 爬虫基类
 * 定义所有爬虫的通用接口和工具方法
 */
class BaseCrawler {
  constructor() {
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
    this.timeout = 30000;
  }

  /**
   * 提取文章内容（子类必须实现）
   * @param {string} url - 文章URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 包含title, content, summary等的对象
   */
  async extractContent(url, options = {}) {
    throw new Error('extractContent method must be implemented by subclass');
  }

  /**
   * 从HTML中提取标题
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @param {string} url - 文章URL（用于fallback）
   * @returns {string} 标题
   */
  extractTitle($, url = '') {
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
        const title = titleEl.text().trim();
        if (title && title.length > 5) {
          return title;
        }
      }
    }

    // Fallback: 从title标签提取
    const pageTitle = $('title').text().trim();
    if (pageTitle) {
      // 清理title（可能包含网站名称）
      return pageTitle.split('|')[0].split('-')[0].split('—')[0].trim();
    }

    return '无标题';
  }

  /**
   * 从HTML中提取文章内容
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @param {string} url - 文章URL
   * @returns {string} 文章内容（纯文本）
   */
  extractContentFromHTML($, url = '') {
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
        // 移除不需要的元素
        contentEl.find('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player').remove();
        
        // 提取文本内容
        const content = contentEl.text().trim();
        if (content && content.length > 500) {
          return content;
        }
      }
    }

    // Fallback: 从body提取
    $('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player').remove();
    const bodyText = $('body').text().trim();
    if (bodyText.length > 500) {
      return bodyText.substring(0, 20000);
    }

    return bodyText;
  }

  /**
   * 从HTML中提取发布日期
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @returns {Date} 发布日期
   */
  extractPublishDate($) {
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
      'meta[name="date"]',
    ];

    for (const selector of dateSelectors) {
      const dateEl = $(selector).first();
      if (dateEl.length > 0) {
        let dateStr = dateEl.attr('datetime') || 
                     dateEl.attr('pubdate') || 
                     dateEl.attr('pubDate') || 
                     dateEl.attr('content') || 
                     dateEl.text().trim();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      }
    }

    return new Date();
  }

  /**
   * 从HTML中提取图片URL
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @param {string} url - 文章URL（用于处理相对路径）
   * @returns {string} 图片URL
   */
  extractImage($, url = '') {
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
        let imageUrl = '';
        if (selector.includes('meta')) {
          imageUrl = imgEl.attr('content') || '';
        } else {
          imageUrl = imgEl.attr('src') || 
                    imgEl.attr('data-src') || 
                    imgEl.attr('data-lazy-src') || 
                    imgEl.attr('data-original') || '';
        }
        
        if (imageUrl) {
          // 处理相对URL
          if (imageUrl.startsWith('/')) {
            try {
              const urlObj = new URL(url);
              imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
            } catch (e) {
              return '';
            }
          } else if (!imageUrl.startsWith('http')) {
            imageUrl = `${url.replace(/\/[^/]*$/, '')}/${imageUrl}`;
          }
          return imageUrl;
        }
      }
    }

    return '';
  }

  /**
   * 判断是否需要使用Puppeteer进行JS渲染
   * @param {string} url - 文章URL
   * @param {string} html - HTML内容
   * @returns {boolean} 是否需要JS渲染
   */
  shouldUsePuppeteer(url, html) {
    if (!html || html.length < 100) {
      return true; // HTML太短，可能需要JS渲染
    }

    // 检查是否有明显的JS框架标记
    const jsFrameworks = [
      'react',
      'vue',
      'angular',
      'next.js',
      'nuxt',
      '__NEXT_DATA__',
      '__NUXT__',
      'vue',
      'ng-app',
      'data-reactroot',
      'data-react-helmet',
    ];

    const lowerHtml = html.toLowerCase();
    for (const framework of jsFrameworks) {
      if (lowerHtml.includes(framework)) {
        return true;
      }
    }

    // 检查是否有noscript标签提示需要JS
    if (html.includes('<noscript>') && html.includes('JavaScript')) {
      return true;
    }

    // 检查内容区域是否为空或太短
    const $ = cheerio.load(html);
    const content = this.extractContentFromHTML($, url);
    if (!content || content.length < 200) {
      return true; // 内容不足，可能需要JS渲染
    }

    // 检查URL特征（某些网站已知需要JS）
    const jsRequiredDomains = [
      'spa',
      'app',
      'single-page',
    ];
    const lowerUrl = url.toLowerCase();
    for (const domain of jsRequiredDomains) {
      if (lowerUrl.includes(domain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取HTML内容
   * @param {string} url - URL
   * @param {Object} options - 可选参数
   * @returns {Promise<string>} HTML内容
   */
  async fetchHTML(url, options = {}) {
    const headers = { ...this.defaultHeaders, ...options.headers };
    const timeout = options.timeout || this.timeout;

    try {
      const response = await axios.get(url, {
        headers,
        timeout,
        maxRedirects: 5,
      });
      return response.data;
    } catch (error) {
      console.error(`获取HTML失败 ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * 清理内容：移除多余的空白字符
   * @param {string} content - 原始内容
   * @returns {string} 清理后的内容
   */
  cleanContent(content) {
    if (!content) return '';
    return content.replace(/\s+/g, ' ').trim();
  }

  /**
   * 生成摘要
   * @param {string} content - 文章内容
   * @param {number} maxLength - 最大长度
   * @returns {string} 摘要
   */
  generateSummary(content, maxLength = 300) {
    if (!content) return '';
    return content.substring(0, maxLength).trim();
  }

  /**
   * 休眠
   * @param {number} ms - 毫秒数
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseCrawler;
