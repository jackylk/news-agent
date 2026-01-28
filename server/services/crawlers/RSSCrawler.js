const BaseCrawler = require('./BaseCrawler');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const axios = require('axios');
const XMLPreprocessor = require('./XMLPreprocessor');

/**
 * RSS/Feed/XML/Atom源爬虫
 */
class RSSCrawler extends BaseCrawler {
  constructor(options = {}) {
    super();
    // 增加超时时间到60秒（对于慢速源）
    const timeout = options.timeout || 60000;
    this.parser = new RSSParser({
      timeout: timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      maxRedirects: 5,
      requestOptions: {
        timeout: timeout,
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
    this.timeout = timeout;
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
   * 判断是否为网络错误（需要重试）
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为网络错误
   */
  _isNetworkError(error) {
    if (!error) return false;
    const errorMsg = error.message || error.toString();
    const code = error.code || '';
    const networkCodes = [
      'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED',
      'EHOSTUNREACH', 'ENETUNREACH', 'EPROTO', 'EPIPE', 'EAI_AGAIN'
    ];
    return (
      errorMsg.includes('socket') ||
      errorMsg.includes('TLS') ||
      errorMsg.includes('ECONNRESET') ||
      errorMsg.includes('ETIMEDOUT') ||
      errorMsg.includes('ENOTFOUND') ||
      errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('EHOSTUNREACH') ||
      errorMsg.includes('ENETUNREACH') ||
      errorMsg.includes('EPROTO') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('disconnected') ||
      errorMsg.includes('network') ||
      errorMsg.includes('CERT_') ||
      errorMsg.includes('certificate') ||
      networkCodes.includes(code)
    );
  }

  /**
   * 判断是否为解析错误（可以尝试预处理）
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为解析错误
   */
  _isParseError(error) {
    if (!error) return false;
    const errorMsg = error.message || error.toString();
    return (
      errorMsg.includes('parse') ||
      errorMsg.includes('XML') ||
      errorMsg.includes('Unexpected') ||
      errorMsg.includes('Non-whitespace') ||
      errorMsg.includes('close tag') ||
      errorMsg.includes('Invalid') ||
      errorMsg.includes('not recognized') ||
      errorMsg.includes('Feed not recognized')
    );
  }

  /**
   * 从RSS Feed URL提取内容（带重试机制）
   * @param {string} feedUrl - RSS Feed URL
   * @param {Object} options - 可选参数
   * @returns {Promise<Array>} 文章列表
   */
  async extractFromFeed(feedUrl, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let lastError = null;

    // 重试循环
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          // 指数退避：1秒、2秒、4秒
          const delay = Math.pow(2, attempt - 2) * 1000;
          console.log(`第 ${attempt} 次尝试获取RSS Feed (等待 ${delay}ms): ${feedUrl}`);
          await this.sleep(delay);
        }

        let feed;
        let xmlResponse = null;
        let contentType = null;

        // 尝试1: 直接使用rss-parser解析（支持RSS和Atom）
        try {
          feed = await this.parser.parseURL(feedUrl);
          // 如果feed.items为空，可能是Atom格式，尝试强制解析
          if (!feed.items || feed.items.length === 0) {
            console.log(`Feed items为空，可能是Atom格式，尝试强制解析: ${feedUrl}`);
          }
        } catch (parseError) {
          // 如果错误是"Feed not recognized"，可能是Atom格式或格式不标准，尝试手动获取和解析
          const errorMsg = parseError.message || parseError.toString();
          if (errorMsg.includes('not recognized') || errorMsg.includes('Feed not recognized')) {
            console.log(`Feed格式不被识别，尝试手动获取和解析: ${feedUrl}`);
            // 继续到下面的手动获取逻辑
          } else {
            // 其他错误，继续到手动获取逻辑
          }
          // 如果解析失败，尝试直接获取XML并预处理
          console.log(`RSS解析失败，尝试直接获取XML内容: ${feedUrl}`);
          
          try {
            xmlResponse = await axios.get(feedUrl, {
              headers: this.defaultHeaders,
              timeout: this.timeout,
              maxRedirects: 5,
              responseType: 'arraybuffer',
              validateStatus: (status) => status < 500, // 允许4xx状态码
            });

            contentType = xmlResponse.headers['content-type'] || '';

            // 使用XMLPreprocessor预处理XML
            const preprocessedXML = XMLPreprocessor.preprocess(xmlResponse.data, {
              contentType: contentType
            });

            // 验证预处理后的XML（如果验证失败，仍然尝试解析）
            if (!XMLPreprocessor.isValidXML(preprocessedXML)) {
              console.warn(`XML格式验证失败，但仍尝试解析: ${feedUrl}`);
            }

            // 尝试解析预处理后的XML（支持RSS和Atom）
            try {
              feed = await this.parser.parseString(preprocessedXML);
              // 检查是否成功解析
              if (feed && (feed.items || feed.entries)) {
                // 如果是Atom格式，items可能在entries中
                if (!feed.items && feed.entries) {
                  feed.items = feed.entries;
                }
                console.log(`成功通过预处理XML解析RSS源: ${feedUrl}`);
              } else {
                // 如果feed为空，尝试检查是否是Atom格式但解析失败
                // 检查XML内容是否包含feed或entry标签（Atom格式）
                if (/<feed/i.test(preprocessedXML) || /<entry/i.test(preprocessedXML)) {
                  console.log(`检测到Atom格式，但rss-parser解析失败，尝试手动解析: ${feedUrl}`);
                  // 尝试使用cheerio手动解析Atom格式
                  const $ = cheerio.load(preprocessedXML, { xmlMode: true });
                  const entries = [];
                  $('entry').each((i, elem) => {
                    const entry = {
                      title: $(elem).find('title').text() || $(elem).find('title').first().text(),
                      link: $(elem).find('link').attr('href') || $(elem).find('link').text(),
                      guid: $(elem).find('id').text(),
                      pubDate: $(elem).find('published').text() || $(elem).find('updated').text(),
                      description: $(elem).find('summary').text() || $(elem).find('content').text(),
                      content: $(elem).find('content').html() || $(elem).find('content').text(),
                    };
                    if (entry.title || entry.link) {
                      entries.push(entry);
                    }
                  });
                  if (entries.length > 0) {
                    feed = {
                      title: $('feed > title').text() || 'Atom Feed',
                      items: entries,
                      entries: entries
                    };
                    console.log(`成功通过手动解析Atom格式: ${feedUrl}，找到 ${entries.length} 个条目`);
                  } else {
                    throw new Error('解析后feed为空');
                  }
                } else {
                  throw new Error('解析后feed为空');
                }
              }
            } catch (parseError) {
              // 如果预处理后仍然解析失败，尝试深度清理
              throw parseError;
            }
          } catch (xmlError) {
            // 如果是网络错误且还有重试机会，继续重试
            if (this._isNetworkError(xmlError) && attempt < maxRetries) {
              lastError = xmlError;
              continue;
            }
            
            // 如果是解析错误，尝试深度清理
            if (this._isParseError(xmlError) && xmlResponse) {
              console.log(`尝试深度清理XML: ${feedUrl}`);
              try {
                // 更激进的清理
                let deepCleaned = Buffer.from(xmlResponse.data).toString('utf8');
                deepCleaned = XMLPreprocessor.removeBOM(deepCleaned);
                deepCleaned = deepCleaned.replace(/^[\s\u0000-\u001F\u007F-\u009F]*/, '');
                // 移除控制字符，但保留换行符和制表符
                deepCleaned = deepCleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
                deepCleaned = XMLPreprocessor.normalizeXMLDeclaration(deepCleaned);
                
                // 即使验证失败也尝试解析
                try {
                  feed = await this.parser.parseString(deepCleaned);
                  // 检查是否成功解析（支持RSS和Atom）
                  if (feed && (feed.items || feed.entries)) {
                    if (!feed.items && feed.entries) {
                      feed.items = feed.entries;
                    }
                    console.log(`成功通过深度清理XML解析RSS源: ${feedUrl}`);
                  } else {
                    // 尝试手动解析Atom格式
                    if (/<feed/i.test(deepCleaned) || /<entry/i.test(deepCleaned)) {
                      console.log(`深度清理后检测到Atom格式，尝试手动解析: ${feedUrl}`);
                      const $ = cheerio.load(deepCleaned, { xmlMode: true });
                      const entries = [];
                      $('entry').each((i, elem) => {
                        const entry = {
                          title: $(elem).find('title').text(),
                          link: $(elem).find('link').attr('href') || $(elem).find('link').text(),
                          guid: $(elem).find('id').text(),
                          pubDate: $(elem).find('published').text() || $(elem).find('updated').text(),
                          description: $(elem).find('summary').text() || $(elem).find('content').text(),
                          content: $(elem).find('content').html() || $(elem).find('content').text(),
                        };
                        if (entry.title || entry.link) {
                          entries.push(entry);
                        }
                      });
                      if (entries.length > 0) {
                        feed = {
                          title: $('feed > title').text() || 'Atom Feed',
                          items: entries,
                          entries: entries
                        };
                        console.log(`成功通过手动解析Atom格式: ${feedUrl}，找到 ${entries.length} 个条目`);
                      } else {
                        throw new Error('深度清理后解析结果为空');
                      }
                    } else {
                      throw new Error('深度清理后解析结果为空');
                    }
                  }
                } catch (deepParseError) {
                  // 如果深度清理后仍然失败，尝试更宽松的处理
                  console.log(`深度清理后解析仍失败，尝试更宽松的处理: ${feedUrl}`);
                  
                  // 尝试移除所有非ASCII字符（除了已转义的）
                  let ultraCleaned = deepCleaned;
                  // 只保留基本的XML结构
                  ultraCleaned = ultraCleaned.replace(/[^\x20-\x7E\u00A0-\uFFFF\s]/g, '');
                  
                  try {
                    feed = await this.parser.parseString(ultraCleaned);
                    // 检查是否成功解析
                    if (feed && (feed.items || feed.entries)) {
                      if (!feed.items && feed.entries) {
                        feed.items = feed.entries;
                      }
                      console.log(`成功通过超宽松清理XML解析RSS源: ${feedUrl}`);
                    } else {
                      // 最后尝试手动解析Atom
                      if (/<feed/i.test(ultraCleaned) || /<entry/i.test(ultraCleaned)) {
                        console.log(`超宽松清理后检测到Atom格式，尝试手动解析: ${feedUrl}`);
                        const $ = cheerio.load(ultraCleaned, { xmlMode: true });
                        const entries = [];
                        $('entry').each((i, elem) => {
                          const entry = {
                            title: $(elem).find('title').text(),
                            link: $(elem).find('link').attr('href') || $(elem).find('link').text(),
                            guid: $(elem).find('id').text(),
                            pubDate: $(elem).find('published').text() || $(elem).find('updated').text(),
                            description: $(elem).find('summary').text() || $(elem).find('content').text(),
                            content: $(elem).find('content').html() || $(elem).find('content').text(),
                          };
                          if (entry.title || entry.link) {
                            entries.push(entry);
                          }
                        });
                        if (entries.length > 0) {
                          feed = {
                            title: $('feed > title').text() || 'Atom Feed',
                            items: entries,
                            entries: entries
                          };
                          console.log(`成功通过手动解析Atom格式: ${feedUrl}，找到 ${entries.length} 个条目`);
                        } else {
                          throw deepParseError;
                        }
                      } else {
                        throw deepParseError;
                      }
                    }
                  } catch (ultraError) {
                    throw deepParseError;
                  }
                }
              } catch (deepError) {
                // 深度清理也失败
                if (attempt < maxRetries && this._isNetworkError(xmlError)) {
                  lastError = xmlError;
                  continue;
                }
                throw xmlError;
              }
            } else {
              // 其他错误，如果是网络错误且还有重试机会，继续重试
              if (this._isNetworkError(xmlError) && attempt < maxRetries) {
                lastError = xmlError;
                continue;
              }
              throw xmlError;
            }
          }
        }

        // 确保feed.items存在（Atom格式可能在entries中）
        if (!feed.items && feed.entries) {
          feed.items = feed.entries;
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
        lastError = error;
        const errorMsg = error.message || error.toString();
        
        // 如果是网络错误且还有重试机会，继续重试
        if (this._isNetworkError(error) && attempt < maxRetries) {
          console.warn(`网络错误 (尝试 ${attempt}/${maxRetries}): ${errorMsg}`);
          continue;
        }
        
        // 如果是解析错误且还有重试机会，继续重试
        if (this._isParseError(error) && attempt < maxRetries) {
          console.warn(`解析错误 (尝试 ${attempt}/${maxRetries}): ${errorMsg}`);
          continue;
        }
        
        // 最后一次尝试或非网络/解析错误，抛出异常
        if (attempt === maxRetries) {
          console.error(`从RSS Feed提取内容失败 (已重试 ${maxRetries} 次) ${feedUrl}:`, errorMsg);
          throw lastError || error;
        }
      }
    }

    // 所有重试都失败
    throw lastError || new Error(`从RSS Feed提取内容失败: ${feedUrl}`);
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
        
        // 处理所有图片标签，将相对路径转换为绝对路径
        if (articleUrl) {
          $('img').each((i, img) => {
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
                  const urlObj = new URL(articleUrl);
                  imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                } catch (e) {
                  return;
                }
              } else if (!imageUrl.startsWith('http')) {
                try {
                  const baseUrl = new URL(articleUrl);
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
        }
        
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
    let summary = '';
    
    // 优先使用已清理的contentSnippet
    if (item.contentSnippet && item.contentSnippet.trim()) {
      summary = item.contentSnippet;
    } else if (item.description) {
      summary = this.cleanHTMLToText(item.description);
    } else if (content) {
      summary = this.cleanHTMLToText(content);
    }
    
    // 最终清理和截断
    summary = summary
      .replace(/\s+/g, ' ')  // 合并多余空白
      .trim();
    
    // 如果摘要太短，尝试从content中提取更多
    if (summary.length < 50 && content) {
      const cleanContent = this.cleanHTMLToText(content);
      if (cleanContent.length > summary.length) {
        summary = cleanContent;
      }
    }
    
    return summary.substring(0, 300);
  }

  /**
   * 将HTML内容清理为纯文本
   * @param {string} html - HTML内容
   * @returns {string} 纯文本
   */
  cleanHTMLToText(html) {
    if (!html) return '';
    
    let text = html;
    
    // 1. 移除HTML注释
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    
    // 2. 移除script和style标签及其内容
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // 3. 移除iframe标签
    text = text.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
    
    // 4. 将块级元素转换为换行
    text = text.replace(/<\/(p|div|h[1-6]|li|br|hr)[^>]*>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // 5. 移除所有剩余的HTML标签
    text = text.replace(/<[^>]+>/g, '');
    
    // 6. 解码HTML实体
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // 7. 清理多余的空白字符
    text = text
      .replace(/\n\s*\n/g, '\n')  // 多个换行合并为一个
      .replace(/[ \t]+/g, ' ')     // 多个空格/制表符合并为一个
      .replace(/^\s+|\s+$/gm, '')  // 移除每行首尾空白
      .trim();
    
    return text;
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
