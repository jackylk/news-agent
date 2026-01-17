const BaseCrawler = require('./BaseCrawler');
const puppeteerHelper = require('./PuppeteerHelper');

/**
 * JavaScript渲染网站爬虫
 * 使用Puppeteer处理需要JavaScript渲染的网站
 */
class JSRenderCrawler extends BaseCrawler {
  constructor(options = {}) {
    super();
    this.options = options;
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

    try {
      // 使用Puppeteer提取内容
      const result = await puppeteerHelper.extractContent(url, {
        ...this.options,
        ...options,
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'networkidle2',
        waitTime: options.waitTime || 1000, // 等待1秒确保JS执行完成
        blockResources: options.blockResources !== false, // 默认拦截资源以提高性能
      });

      if (!result) {
        throw new Error('Puppeteer提取内容失败');
      }

      // 清理内容
      const content = this.cleanContent(result.content || '');

      // 生成摘要
      const summary = this.generateSummary(content);

      if (!result.title || !content || content.length < 100) {
        console.log(`文章内容不足，跳过: ${url}`);
        return null;
      }

      return {
        title: (result.title || '无标题').substring(0, 500),
        content: content.substring(0, 20000),
        summary: summary,
        url: url,
        image_url: result.imageUrl || '',
        publish_date: result.publishDate || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Puppeteer提取内容失败 ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取页面HTML（使用Puppeteer）
   * @param {string} url - 页面URL
   * @param {Object} options - 可选参数
   * @returns {Promise<string>} HTML内容
   */
  async fetchHTML(url, options = {}) {
    return await puppeteerHelper.fetchHTML(url, {
      ...this.options,
      ...options,
      timeout: options.timeout || 30000,
      waitUntil: options.waitUntil || 'networkidle2',
      waitTime: options.waitTime || 1000,
      blockResources: options.blockResources !== false,
    });
  }
}

module.exports = JSRenderCrawler;
