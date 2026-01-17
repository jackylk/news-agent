const BaseCrawler = require('./BaseCrawler');
const cheerio = require('cheerio');

/**
 * 新闻网站爬虫
 * 针对新闻网站优化内容提取
 */
class NewsWebsiteCrawler extends BaseCrawler {
  constructor(options = {}) {
    super();
    this.options = options;
  }

  /**
   * 延迟加载JS爬虫实例（避免循环依赖）
   */
  _getJSCrawler() {
    if (!this._jsCrawler) {
      const JSRenderCrawler = require('./JSRenderCrawler');
      this._jsCrawler = new JSRenderCrawler(this.options);
    }
    return this._jsCrawler;
  }

  /**
   * 提取文章内容
   * @param {string} url - 文章URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 包含title, content, summary等的对象
   */
  async extractContent(url, options = {}) {
    if (!url) {
      throw new Error('URL不能为空');
    }

    // 先尝试静态HTML
    let html;
    try {
      html = await this.fetchHTML(url, options);
    } catch (error) {
      console.error(`获取HTML失败 ${url}:`, error.message);
      throw error;
    }

    // 检查是否需要JS渲染
    if (this.shouldUsePuppeteer(url, html)) {
      console.log(`检测到需要JS渲染，使用Puppeteer: ${url}`);
      try {
        return await this._getJSCrawler().extractContent(url, options);
      } catch (error) {
        console.warn(`Puppeteer提取失败，回退到静态HTML: ${error.message}`);
        // 继续使用静态HTML
      }
    }

    // 使用静态HTML提取内容
    const $ = cheerio.load(html);

    // 提取标题（新闻网站特定的选择器）
    const title = this.extractNewsTitle($, url);

    // 提取内容（新闻网站特定的选择器）
    let content = this.extractNewsContent($, url);
    content = this.cleanContent(content);

    // 如果内容不足，尝试更宽松的选择器
    if (!content || content.length < 500) {
      // 尝试从body提取，但移除更多无关元素
      $('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player, .widget, .sidebar-widget, .footer-widget, .newsletter-signup, .trending, .popular').remove();
      const bodyText = $('body').text().trim();
      if (bodyText.length > content.length) {
        content = bodyText.substring(0, 20000);
        content = this.cleanContent(content);
      }
    }

    // 提取发布日期
    const publishDate = this.extractPublishDate($);

    // 提取图片
    const imageUrl = this.extractImage($, url);

    // 生成摘要
    const summary = this.generateSummary(content);

    if (!title || !content || content.length < 100) {
      console.log(`文章内容不足，跳过: ${url}`);
      return null;
    }

    return {
      title: title.substring(0, 500),
      content: content.substring(0, 20000),
      summary: summary,
      url: url,
      image_url: imageUrl,
      publish_date: publishDate.toISOString(),
    };
  }

  /**
   * 提取新闻标题（针对新闻网站优化）
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @param {string} url - 文章URL
   * @returns {string} 标题
   */
  extractNewsTitle($, url = '') {
    // 新闻网站特定的标题选择器
    const newsTitleSelectors = [
      '.headline',
      '.news-title',
      '.story-title',
      '.article-headline',
      'h1.headline',
      'h1.news-title',
      'h1.story-title',
      '.article-header h1',
      '.story-header h1',
      '.news-header h1',
      'article h1',
      'article header h1',
      '[role="article"] h1',
      'main h1',
      'main article h1',
      '.content h1',
      '#content h1',
      'h1',
    ];

    for (const selector of newsTitleSelectors) {
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
      return pageTitle.split('|')[0].split('-')[0].split('—')[0].trim();
    }

    return '无标题';
  }

  /**
   * 提取新闻内容（针对新闻网站优化）
   * @param {cheerio.CheerioAPI} $ - cheerio实例
   * @param {string} url - 文章URL
   * @returns {string} 文章内容
   */
  extractNewsContent($, url = '') {
    // 新闻网站特定的内容选择器
    const newsContentSelectors = [
      '.article-content',
      '.news-content',
      '.story-content',
      '.article-body',
      '.news-body',
      '.story-body',
      '.article-text',
      '.news-text',
      '.story-text',
      'article',
      '[role="article"]',
      '.post-content',
      '.entry-content',
      'main article',
      'main .article',
      '.content',
      '#content',
      '#article-content',
      '#news-content',
      '#story-content',
    ];

    for (const selector of newsContentSelectors) {
      const contentEl = $(selector).first();
      if (contentEl.length > 0) {
        // 移除不需要的元素
        contentEl.find('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player, .newsletter-signup, .trending, .popular').remove();
        
        // 提取文本内容
        const content = contentEl.text().trim();
        if (content && content.length > 500) {
          return content;
        }
      }
    }

    // Fallback: 使用基类方法
    return this.extractContentFromHTML($, url);
  }

  /**
   * 从新闻网站主页提取文章链接列表
   * @param {string} newsUrl - 新闻网站主页URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Array>} 文章URL列表
   */
  async extractArticleLinks(newsUrl, options = {}) {
    const maxLinks = options.maxLinks || 30;
    
    let html;
    try {
      html = await this.fetchHTML(newsUrl, options);
    } catch (error) {
      console.error(`获取新闻网站主页失败 ${newsUrl}:`, error.message);
      throw error;
    }

    const $ = cheerio.load(html);
    const articleLinks = new Set();

    // 新闻网站特定的链接选择器
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
      'a[href*="/2024/"]',
      'a[href*="/2023/"]',
      '[data-article-url]',
      '[data-story-url]',
    ];

    linkSelectors.forEach(selector => {
      $(selector).each((i, elem) => {
        if (articleLinks.size >= maxLinks) return false;
        
        const href = $(elem).attr('href') || 
                     $(elem).attr('data-article-url') || 
                     $(elem).attr('data-story-url');
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
             /\/\d{4}\/\d{2}\//.test(articleUrl))) {
          articleLinks.add(articleUrl);
        }
      });
    });

    return Array.from(articleLinks).slice(0, maxLinks);
  }
}

module.exports = NewsWebsiteCrawler;
