const puppeteer = require('puppeteer');

/**
 * Puppeteer工具类
 * 封装浏览器操作和资源管理
 */
class PuppeteerHelper {
  constructor() {
    this.browser = null;
    this.browserPromise = null;
  }

  /**
   * 获取或创建浏览器实例（单例模式）
   * @returns {Promise<puppeteer.Browser>}
   */
  async getBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.browserPromise) {
      return this.browserPromise;
    }

    this.browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      timeout: 30000,
    });

    try {
      this.browser = await this.browserPromise;
      // 监听浏览器断开事件
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.browserPromise = null;
      });
      return this.browser;
    } catch (error) {
      this.browserPromise = null;
      throw error;
    }
  }

  /**
   * 使用Puppeteer获取页面HTML
   * @param {string} url - 页面URL
   * @param {Object} options - 可选参数
   * @returns {Promise<string>} HTML内容
   */
  async fetchHTML(url, options = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // 设置视口
      await page.setViewport({
        width: 1920,
        height: 1080,
      });

      // 设置User-Agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 拦截资源请求，只加载必要资源以提高性能
      if (options.blockResources !== false) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          // 只加载文档、样式表、脚本和字体，阻止图片、媒体等
          if (['document', 'stylesheet', 'script', 'font'].includes(resourceType)) {
            request.continue();
          } else {
            request.abort();
          }
        });
      }

      // 设置超时
      const timeout = options.timeout || 30000;

      // 导航到页面
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2', // 等待网络空闲
        timeout,
      });

      // 等待内容加载（可选）
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
      }

      // 等待额外时间以确保JS执行完成
      if (options.waitTime) {
        await page.waitForTimeout(options.waitTime);
      }

      // 获取HTML内容
      const html = await page.content();

      return html;
    } catch (error) {
      console.error(`Puppeteer获取页面失败 ${url}:`, error.message);
      throw error;
    } finally {
      await page.close().catch(e => console.warn('page.close() 失败:', e.message));
    }
  }

  /**
   * 使用Puppeteer提取页面内容
   * @param {string} url - 页面URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} 包含title, content等的对象
   */
  async extractContent(url, options = {}) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // 设置视口和User-Agent
      await page.setViewport({
        width: 1920,
        height: 1080,
      });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 拦截资源请求
      if (options.blockResources !== false) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          const resourceType = request.resourceType();
          if (['document', 'stylesheet', 'script', 'font'].includes(resourceType)) {
            request.continue();
          } else {
            request.abort();
          }
        });
      }

      const timeout = options.timeout || 30000;

      // 导航到页面
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout,
      });

      // 等待内容加载
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
      }

      if (options.waitTime) {
        await page.waitForTimeout(options.waitTime);
      }

      // 提取内容
      const result = await page.evaluate(() => {
        // 提取标题
        const titleSelectors = [
          'article h1',
          'h1.post-title',
          'h1.entry-title',
          'h1.article-title',
          'h1.news-title',
          '.post-title',
          '.entry-title',
          '.article-title',
          '.news-title',
          '.headline',
          'h1',
        ];

        let title = '';
        for (const selector of titleSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length > 5) {
            title = el.textContent.trim();
            break;
          }
        }

        if (!title) {
          title = document.title || '';
          title = title.split('|')[0].split('-')[0].split('—')[0].trim();
        }

        // 提取内容
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
          '.article-body',
          'main article',
          '.content',
          '#content',
        ];

        let content = '';
        for (const selector of contentSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            // 克隆元素以避免修改原DOM
            const clone = el.cloneNode(true);
            
            // 移除不需要的元素
            const unwanted = clone.querySelectorAll(
              'script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player'
            );
            unwanted.forEach(node => node.remove());

            // 移除危险属性但保留格式
            const allElements = clone.querySelectorAll('*');
            allElements.forEach(node => {
              // 移除事件处理器
              Array.from(node.attributes || []).forEach(attr => {
                if (attr.name.startsWith('on')) {
                  node.removeAttribute(attr.name);
                } else if (attr.name === 'href' && attr.value && attr.value.startsWith('javascript:')) {
                  node.removeAttribute('href');
                } else if (attr.name === 'src' && attr.value && attr.value.startsWith('javascript:')) {
                  node.removeAttribute('src');
                }
              });
            });

            // 处理图片标签，将相对路径转换为绝对路径，处理懒加载
            const images = clone.querySelectorAll('img');
            images.forEach(img => {
              const srcAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-url'];
              let imageUrl = '';
              
              for (const attr of srcAttrs) {
                imageUrl = img.getAttribute(attr) || '';
                if (imageUrl) break;
              }
              
              if (imageUrl) {
                try {
                  if (imageUrl.startsWith('/')) {
                    const urlObj = new URL(window.location.href);
                    imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                  } else if (!imageUrl.startsWith('http')) {
                    imageUrl = new URL(imageUrl, window.location.href).href;
                  }
                  
                  img.setAttribute('src', imageUrl);
                  img.removeAttribute('data-src');
                  img.removeAttribute('data-lazy-src');
                  img.removeAttribute('data-original');
                  img.removeAttribute('data-url');
                  img.removeAttribute('loading');
                } catch (e) {
                  // URL处理失败，跳过
                }
              }
            });

            // 保留HTML格式
            const htmlContent = clone.innerHTML.trim();
            const textLength = clone.textContent.trim().length;
            if (textLength > 500) {
              content = htmlContent;
              break;
            }
          }
        }

        if (!content || content.length < 500) {
          const body = document.body.cloneNode(true);
          const unwanted = body.querySelectorAll(
            'script, style, nav, header, footer, .ad, .advertisement, .ads, .adsense, .sidebar, .comments, .comment, .social-share, .share-buttons, .author-box, .related-posts, .related-articles, .newsletter, .subscribe, .tags, .categories, .breadcrumb, .navigation, .menu, iframe, .embed, .video-player'
          );
          unwanted.forEach(node => node.remove());
          
          // 移除危险属性
          const allElements = body.querySelectorAll('*');
          allElements.forEach(node => {
            Array.from(node.attributes || []).forEach(attr => {
              if (attr.name.startsWith('on')) {
                node.removeAttribute(attr.name);
              } else if (attr.name === 'href' && attr.value && attr.value.startsWith('javascript:')) {
                node.removeAttribute('href');
              } else if (attr.name === 'src' && attr.value && attr.value.startsWith('javascript:')) {
                node.removeAttribute('src');
              }
            });
          });
          
          // 处理图片标签，将相对路径转换为绝对路径，处理懒加载
          const images = body.querySelectorAll('img');
          images.forEach(img => {
            const srcAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-url'];
            let imageUrl = '';
            
            for (const attr of srcAttrs) {
              imageUrl = img.getAttribute(attr) || '';
              if (imageUrl) break;
            }
            
            if (imageUrl) {
              try {
                if (imageUrl.startsWith('/')) {
                  const urlObj = new URL(window.location.href);
                  imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                } else if (!imageUrl.startsWith('http')) {
                  imageUrl = new URL(imageUrl, window.location.href).href;
                }
                
                img.setAttribute('src', imageUrl);
                img.removeAttribute('data-src');
                img.removeAttribute('data-lazy-src');
                img.removeAttribute('data-original');
                img.removeAttribute('data-url');
                img.removeAttribute('loading');
              } catch (e) {
                // URL处理失败，跳过
              }
            }
          });
          
          const bodyHtml = body.innerHTML.trim();
          const bodyTextLength = body.textContent.trim().length;
          if (bodyTextLength > 500) {
            content = bodyHtml.substring(0, 50000); // 限制长度
          } else {
            content = bodyHtml;
          }
        }

        // 提取图片
        const imageSelectors = [
          'article img',
          '.post-content img',
          '.article-content img',
          'meta[property="og:image"]',
        ];

        let imageUrl = '';
        for (const selector of imageSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            if (selector.includes('meta')) {
              imageUrl = el.getAttribute('content') || '';
            } else {
              imageUrl = el.getAttribute('src') || 
                        el.getAttribute('data-src') || 
                        el.getAttribute('data-lazy-src') || '';
            }
            if (imageUrl) break;
          }
        }

        // 提取发布日期
        const dateSelectors = [
          'time[datetime]',
          'meta[property="article:published_time"]',
          'meta[name="publishdate"]',
          '.published',
          '.post-date',
          '.article-date',
        ];

        let publishDate = null;
        for (const selector of dateSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            const dateStr = el.getAttribute('datetime') || 
                           el.getAttribute('content') || 
                           el.textContent.trim();
            if (dateStr) {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                publishDate = date.toISOString();
                break;
              }
            }
          }
        }

        return {
          title: title || '无标题',
          content: content || '',
          imageUrl: imageUrl || '',
          publishDate: publishDate || new Date().toISOString(),
        };
      });

      return result;
    } catch (error) {
      console.error(`Puppeteer提取内容失败 ${url}:`, error.message);
      throw error;
    } finally {
      await page.close().catch(e => console.warn('page.close() 失败:', e.message));
    }
  }

  /**
   * 关闭浏览器
   * @returns {Promise}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }
  }

  /**
   * 清理资源（在应用关闭时调用）
   */
  async cleanup() {
    await this.close();
  }
}

// 导出单例实例
const puppeteerHelper = new PuppeteerHelper();

// 在进程退出时清理资源
process.on('SIGINT', async () => {
  await puppeteerHelper.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await puppeteerHelper.cleanup();
  process.exit(0);
});

module.exports = puppeteerHelper;
