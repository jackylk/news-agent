const BaseCrawler = require('./BaseCrawler');
const RSSCrawler = require('./RSSCrawler');
const NitterInstance = require('../../models/NitterInstance');

/**
 * Twitter/X推文爬虫
 * 通过Nitter实例将Twitter用户转换为RSS源，然后收集推文
 */
class TwitterCrawler extends BaseCrawler {
  constructor(options = {}) {
    super();
    this.rssCrawler = new RSSCrawler(options);
  }

  /**
   * 从Twitter/X URL或用户名提取用户名
   * @param {string} urlOrUsername - URL或用户名
   * @returns {string|null} 用户名
   */
  extractTwitterUsername(urlOrUsername) {
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
   * 获取Nitter实例列表
   * @returns {Promise<Array>} Nitter实例URL列表
   */
  async getNitterInstances() {
    return new Promise((resolve) => {
      // 首先尝试从数据库获取激活的实例
      NitterInstance.getActive((err, instances) => {
        if (!err && instances && instances.length > 0) {
          // 按优先级排序
          const sortedInstances = instances.sort((a, b) => (b.priority || 0) - (a.priority || 0));
          const urls = sortedInstances.map(inst => inst.url);
          resolve(urls);
          return;
        }
        
        // 如果数据库没有实例，使用环境变量或默认值
        if (process.env.NITTER_INSTANCES) {
          const urls = process.env.NITTER_INSTANCES.split(',').map(url => url.trim());
          resolve(urls);
          return;
        }
        
        // 使用默认值
        resolve([
          'https://nitter.net',
          'https://nitter.it',
          'https://nitter.pussthecat.org',
        ]);
      });
    });
  }

  /**
   * 将Twitter用户名转换为Nitter RSS URL
   * @param {string} username - Twitter用户名
   * @param {string} nitterInstance - Nitter实例URL
   * @returns {string|null} RSS URL
   */
  getTwitterRSSUrl(username, nitterInstance) {
    const cleanUsername = this.extractTwitterUsername(username);
    if (!cleanUsername) {
      return null;
    }
    
    if (nitterInstance) {
      return `${nitterInstance.replace(/\/$/, '')}/${cleanUsername}/rss`;
    }
    
    return null;
  }

  /**
   * 提取Twitter推文内容
   * @param {string} twitterUrlOrUsername - Twitter URL或用户名
   * @param {Object} options - 可选参数
   * @returns {Promise<Array>} 推文列表
   */
  async extractContent(twitterUrlOrUsername, options = {}) {
    const username = this.extractTwitterUsername(twitterUrlOrUsername);
    if (!username) {
      throw new Error(`无法从 "${twitterUrlOrUsername}" 提取Twitter用户名`);
    }

    // 获取Nitter实例列表
    const nitterInstances = await this.getNitterInstances();
    if (!nitterInstances || nitterInstances.length === 0) {
      throw new Error('没有可用的Nitter实例');
    }

    // 尝试使用不同的Nitter实例
    let lastError = null;
    for (const nitterInstance of nitterInstances) {
      try {
        const rssUrl = this.getTwitterRSSUrl(username, nitterInstance);
        if (!rssUrl) {
          continue;
        }

        console.log(`尝试使用Nitter实例: ${nitterInstance}`);
        
        // 使用RSS爬虫获取推文
        const articles = await this.rssCrawler.extractFromFeed(rssUrl, options);
        
        if (articles && articles.length > 0) {
          console.log(`成功从Nitter实例 ${nitterInstance} 收集到 ${articles.length} 条推文`);
          return articles;
        }
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || error.toString();
        console.warn(`Nitter实例 ${nitterInstance} 失败: ${errorMsg}`);
        continue;
      }
    }

    // 如果所有实例都失败
    throw lastError || new Error(`所有Nitter实例都失败，无法收集Twitter用户 @${username} 的推文`);
  }
}

module.exports = TwitterCrawler;
