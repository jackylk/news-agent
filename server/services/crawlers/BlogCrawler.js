const BaseCrawler = require('./BaseCrawler');
const cheerio = require('cheerio');
const puppeteerHelper = require('./PuppeteerHelper');

/**
 * 博客网站爬虫
 * 使用智能选择器提取博客文章内容
 */
class BlogCrawler extends BaseCrawler {
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

    // 提取标题
    const title = this.extractTitle($, url);

    // 提取内容（保留HTML格式）
    let content = this.extractContentFromHTML($, url, true);
    content = this.cleanContent(content);

    // 如果内容不足，尝试更宽松的选择器
    if (!content || (typeof content === 'string' && content.replace(/<[^>]*>/g, '').trim().length < 500)) {
      // 尝试从body提取，但移除更多无关元素
      const bodyClone = $('body').clone();
      bodyClone.find('script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player, .widget, .sidebar-widget, .footer-widget').remove();
      
      // 移除危险属性
      bodyClone.find('*').each((i, el) => {
        const $el = $(el);
        Object.keys(el.attribs || {}).forEach(attr => {
          if (attr.startsWith('on') || 
              (attr === 'href' && $el.attr('href') && $el.attr('href').startsWith('javascript:')) ||
              (attr === 'src' && $el.attr('src') && $el.attr('src').startsWith('javascript:'))) {
            $el.removeAttr(attr);
          }
        });
      });
      
      // 处理所有图片标签，将相对路径转换为绝对路径
      bodyClone.find('img').each((i, img) => {
        const $img = $(img);
        const srcAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-url'];
        let imageUrl = '';
        
        for (const attr of srcAttrs) {
          imageUrl = $img.attr(attr) || '';
          if (imageUrl) break;
        }
        
        if (imageUrl) {
          // 处理相对URL
          if (imageUrl.startsWith('/')) {
            try {
              const urlObj = new URL(url);
              imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
            } catch (e) {
              return;
            }
          } else if (!imageUrl.startsWith('http')) {
            try {
              const baseUrl = new URL(url);
              imageUrl = new URL(imageUrl, baseUrl).href;
            } catch (e) {
              return;
            }
          }
          
          // 统一设置到src属性
          $img.attr('src', imageUrl);
          // 移除懒加载属性
          $img.removeAttr('data-src data-lazy-src data-original data-url loading');
        }
      });
      
      const bodyHtml = bodyClone.html() || '';
      const bodyTextLength = bodyClone.text().trim().length;
      const currentTextLength = typeof content === 'string' ? content.replace(/<[^>]*>/g, '').trim().length : 0;
      
      if (bodyTextLength > currentTextLength) {
        content = bodyHtml.substring(0, 50000); // 限制HTML长度
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
   * 从博客主页提取文章链接列表
   * @param {string} blogUrl - 博客主页URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Array>} 文章URL列表
   */
  async extractArticleLinks(blogUrl, options = {}) {
    const maxLinks = options.maxLinks || 20;
    
    let html;
    try {
      html = await this.fetchHTML(blogUrl, options);
    } catch (error) {
      console.error(`获取博客主页失败 ${blogUrl}:`, error.message);
      throw error;
    }

    const $ = cheerio.load(html);
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
        if (articleLinks.size >= maxLinks) return false;
        
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
             /\/\d{4}\/\d{2}\//.test(articleUrl))) {
          articleLinks.add(articleUrl);
        }
      });
    });

    return Array.from(articleLinks).slice(0, maxLinks);
  }
}

module.exports = BlogCrawler;
