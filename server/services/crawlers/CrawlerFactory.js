const RSSCrawler = require('./RSSCrawler');
const TwitterCrawler = require('./TwitterCrawler');
const BlogCrawler = require('./BlogCrawler');
const NewsWebsiteCrawler = require('./NewsWebsiteCrawler');
const JSRenderCrawler = require('./JSRenderCrawler');

/**
 * 爬虫工厂类
 * 根据信息源类型自动选择合适的爬虫
 */
class CrawlerFactory {
  /**
   * 从Twitter/X URL或用户名提取用户名
   * @param {string} urlOrUsername - URL或用户名
   * @returns {string|null} 用户名
   */
  static extractTwitterUsername(urlOrUsername) {
    if (!urlOrUsername) return null;
    
    let username = urlOrUsername.replace(/^@/, '').trim();
    
    const urlPatterns = [
      /twitter\.com\/([a-zA-Z0-9_]+)/i,
      /x\.com\/([a-zA-Z0-9_]+)/i,
      /nitter\.(?:net|it|unixfox\.dev|privacyredirect\.com)\/([a-zA-Z0-9_]+)/i,
    ];
    
    for (const pattern of urlPatterns) {
      const match = urlOrUsername.match(pattern);
      if (match && match[1]) {
        username = match[1];
        break;
      }
    }
    
    if (/^[a-zA-Z0-9_]+$/.test(username)) {
      return username;
    }
    
    return null;
  }

  /**
   * 判断信息源类型
   * @param {string} sourceType - 源类型
   * @param {string} sourceUrl - 源URL
   * @returns {string} 信息源类型
   */
  static detectSourceType(sourceType, sourceUrl) {
    const normalizedType = (sourceType || '').toLowerCase();
    const lowerUrl = (sourceUrl || '').toLowerCase();

    // Twitter/X源
    if (normalizedType === 'twitter' || normalizedType === 'x' || 
        lowerUrl.includes('twitter.com/') || lowerUrl.includes('x.com/') ||
        lowerUrl.includes('nitter.') || this.extractTwitterUsername(sourceUrl)) {
      return 'twitter';
    }

    // RSS/Feed/XML/Atom源
    if (normalizedType === 'rss' || normalizedType === 'feed' || 
        normalizedType === 'xml' || normalizedType === 'atom' ||
        lowerUrl.includes('/rss') || lowerUrl.includes('/feed') || 
        lowerUrl.includes('/atom') || lowerUrl.endsWith('.xml') ||
        lowerUrl.endsWith('.rss') || lowerUrl.endsWith('.atom')) {
      return 'rss';
    }

    // 博客类型
    if (normalizedType === 'blog' || 
        lowerUrl.includes('/blog') || lowerUrl.includes('blog.') ||
        lowerUrl.includes('medium.com') || lowerUrl.includes('substack.com') ||
        lowerUrl.includes('wordpress.com') || lowerUrl.includes('blogger.com')) {
      return 'blog';
    }

    // 新闻网站类型
    if (normalizedType === 'news' || 
        lowerUrl.includes('/news') || lowerUrl.includes('news.')) {
      return 'news';
    }

    // 默认返回website类型（将使用通用爬虫）
    return 'website';
  }

  /**
   * 创建爬虫实例
   * @param {string} sourceType - 源类型
   * @param {string} sourceUrl - 源URL
   * @param {Object} options - 可选参数
   * @returns {BaseCrawler} 爬虫实例
   */
  static createCrawler(sourceType, sourceUrl, options = {}) {
    const detectedType = this.detectSourceType(sourceType, sourceUrl);

    switch (detectedType) {
      case 'twitter':
        return new TwitterCrawler(options);
      
      case 'rss':
        return new RSSCrawler(options);
      
      case 'blog':
        return new BlogCrawler(options);
      
      case 'news':
        return new NewsWebsiteCrawler(options);
      
      case 'website':
      default:
        // 对于website类型，先尝试使用BlogCrawler（通用爬虫）
        // 如果需要JS渲染，会自动切换到JSRenderCrawler
        return new BlogCrawler(options);
    }
  }

  /**
   * 创建JS渲染爬虫（用于需要JavaScript渲染的网站）
   * @param {Object} options - 可选参数
   * @returns {JSRenderCrawler} JS渲染爬虫实例
   */
  static createJSCrawler(options = {}) {
    return new JSRenderCrawler(options);
  }
}

module.exports = CrawlerFactory;
