const CrawlerFactory = require('../services/crawlers/CrawlerFactory');
const RSSCrawler = require('../services/crawlers/RSSCrawler');
const BlogCrawler = require('../services/crawlers/BlogCrawler');
const NewsWebsiteCrawler = require('../services/crawlers/NewsWebsiteCrawler');
const fs = require('fs');
const path = require('path');

/**
 * 爬虫测试框架
 * 测试不同类型信息源的爬取能力
 */
class CrawlerTester {
  constructor() {
    this.results = [];
    this.outputFile = path.join(__dirname, 'test-results.txt');
  }

  /**
   * 记录测试结果
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.results.push(logMessage);
  }

  /**
   * 测试单个信息源
   */
  async testSource(name, url, sourceType = null) {
    this.log(`\n${'='.repeat(80)}`);
    this.log(`开始测试信息源: ${name}`);
    this.log(`URL: ${url}`);
    this.log(`类型: ${sourceType || '自动检测'}`);
    this.log(`${'='.repeat(80)}`);

    const startTime = Date.now();
    let success = false;
    let error = null;
    let articleCount = 0;
    let articles = [];

    try {
      // 使用CrawlerFactory创建合适的爬虫
      const detectedType = CrawlerFactory.detectSourceType(sourceType, url);
      this.log(`检测到的类型: ${detectedType}`);

      let crawler;
      if (detectedType === 'rss') {
        crawler = new RSSCrawler();
        this.log('使用RSSCrawler');
        
        // RSS源返回文章列表
        articles = await crawler.extractFromFeed(url);
        articleCount = articles.length;
        this.log(`成功提取 ${articleCount} 篇文章`);
        
        // 显示前3篇文章的标题
        if (articles.length > 0) {
          this.log('\n前3篇文章标题:');
          articles.slice(0, 3).forEach((article, index) => {
            this.log(`  ${index + 1}. ${article.title || '无标题'}`);
            this.log(`     URL: ${article.url || '无URL'}`);
            this.log(`     内容长度: ${(article.content || '').length} 字符`);
          });
        }
      } else if (detectedType === 'blog') {
        crawler = new BlogCrawler();
        this.log('使用BlogCrawler');
        
        // 博客源先获取文章链接
        const articleLinks = await crawler.extractArticleLinks(url, { maxLinks: 5 });
        this.log(`找到 ${articleLinks.length} 个文章链接`);
        
        if (articleLinks.length > 0) {
          // 测试提取第一篇文章
          this.log(`测试提取第一篇文章: ${articleLinks[0]}`);
          const article = await crawler.extractContent(articleLinks[0]);
          
          if (article) {
            articles = [article];
            articleCount = 1;
            this.log(`成功提取文章: ${article.title || '无标题'}`);
            this.log(`内容长度: ${(article.content || '').length} 字符`);
          }
        }
      } else if (detectedType === 'news') {
        crawler = new NewsWebsiteCrawler();
        this.log('使用NewsWebsiteCrawler');
        
        // 新闻网站先获取文章链接
        const articleLinks = await crawler.extractArticleLinks(url, { maxLinks: 5 });
        this.log(`找到 ${articleLinks.length} 个文章链接`);
        
        if (articleLinks.length > 0) {
          // 测试提取第一篇文章
          this.log(`测试提取第一篇文章: ${articleLinks[0]}`);
          const article = await crawler.extractContent(articleLinks[0]);
          
          if (article) {
            articles = [article];
            articleCount = 1;
            this.log(`成功提取文章: ${article.title || '无标题'}`);
            this.log(`内容长度: ${(article.content || '').length} 字符`);
          }
        }
      } else {
        // 默认使用博客爬虫
        crawler = new BlogCrawler();
        this.log('使用BlogCrawler (默认)');
        
        const article = await crawler.extractContent(url);
        if (article) {
          articles = [article];
          articleCount = 1;
          this.log(`成功提取文章: ${article.title || '无标题'}`);
          this.log(`内容长度: ${(article.content || '').length} 字符`);
        }
      }

      success = articleCount > 0;
      const duration = Date.now() - startTime;
      
      this.log(`\n测试结果: ${success ? '✓ 成功' : '✗ 失败'}`);
      this.log(`耗时: ${duration}ms`);
      this.log(`提取文章数: ${articleCount}`);

      // 分析文章质量
      if (articles.length > 0) {
        const avgContentLength = articles.reduce((sum, a) => sum + (a.content || '').length, 0) / articles.length;
        this.log(`平均内容长度: ${Math.round(avgContentLength)} 字符`);
        
        const articlesWithContent = articles.filter(a => a.content && a.content.length > 500);
        this.log(`内容充足的文章数 (>500字符): ${articlesWithContent.length}/${articles.length}`);
      }

    } catch (err) {
      error = err;
      success = false;
      const duration = Date.now() - startTime;
      this.log(`\n测试结果: ✗ 失败`, 'error');
      this.log(`错误信息: ${err.message}`, 'error');
      this.log(`错误堆栈: ${err.stack}`, 'error');
      this.log(`耗时: ${duration}ms`);
    }

    return {
      name,
      url,
      sourceType: sourceType || 'auto',
      success,
      error: error ? error.message : null,
      articleCount,
      duration: Date.now() - startTime
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    this.log('='.repeat(80));
    this.log('开始爬虫测试');
    this.log(`测试时间: ${new Date().toISOString()}`);
    this.log('='.repeat(80));

    // 定义测试信息源
    const testSources = [
      {
        name: '动手学深度学习 (RSS)',
        url: 'https://zh.d2l.ai/feed.xml',
        type: 'rss'
      },
      {
        name: 'MIT Technology Review AI (RSS)',
        url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
        type: 'rss'
      },
      {
        name: 'DeepMind Blog (RSS)',
        url: 'https://deepmind.com/blog/feed/basic/',
        type: 'rss'
      },
      {
        name: 'Karpathy Blog (RSS)',
        url: 'https://karpathy.ai/feed.xml',
        type: 'rss'
      },
      {
        name: '机器之心 (RSS)',
        url: 'https://www.jiqizhixin.com/rss',
        type: 'rss'
      },
      {
        name: 'CSDN AI博客',
        url: 'https://blog.csdn.net/nav/ai',
        type: 'blog'
      },
      {
        name: 'Elon Musk Twitter (RSS)',
        url: 'https://rss.xcancel.com/elonmusk/rss',
        type: 'rss'
      }
    ];

    const testResults = [];

    // 逐个测试
    for (let i = 0; i < testSources.length; i++) {
      const source = testSources[i];
      this.log(`\n进度: ${i + 1}/${testSources.length}`);
      
      const result = await this.testSource(source.name, source.url, source.type);
      testResults.push(result);

      // 测试之间等待，避免请求过快
      if (i < testSources.length - 1) {
        this.log('等待2秒后继续下一个测试...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 生成测试报告
    this.generateReport(testResults);

    // 保存结果到文件
    this.saveResults();
  }

  /**
   * 生成测试报告
   */
  generateReport(testResults) {
    this.log('\n' + '='.repeat(80));
    this.log('测试报告汇总');
    this.log('='.repeat(80));

    const total = testResults.length;
    const successful = testResults.filter(r => r.success).length;
    const failed = total - successful;
    const totalArticles = testResults.reduce((sum, r) => sum + r.articleCount, 0);
    const avgDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / total;

    this.log(`\n总计: ${total} 个信息源`);
    this.log(`成功: ${successful} (${(successful / total * 100).toFixed(1)}%)`);
    this.log(`失败: ${failed} (${(failed / total * 100).toFixed(1)}%)`);
    this.log(`总提取文章数: ${totalArticles}`);
    this.log(`平均耗时: ${Math.round(avgDuration)}ms`);

    this.log('\n详细信息:');
    testResults.forEach((result, index) => {
      this.log(`\n${index + 1}. ${result.name}`);
      this.log(`   URL: ${result.url}`);
      this.log(`   类型: ${result.sourceType}`);
      this.log(`   状态: ${result.success ? '✓ 成功' : '✗ 失败'}`);
      this.log(`   文章数: ${result.articleCount}`);
      this.log(`   耗时: ${result.duration}ms`);
      if (result.error) {
        this.log(`   错误: ${result.error}`, 'error');
      }
    });

    // 失败的测试
    const failedTests = testResults.filter(r => !r.success);
    if (failedTests.length > 0) {
      this.log('\n失败的测试:');
      failedTests.forEach((result, index) => {
        this.log(`  ${index + 1}. ${result.name} - ${result.error || '未知错误'}`, 'error');
      });
    }
  }

  /**
   * 保存结果到文件
   */
  saveResults() {
    try {
      const content = this.results.join('\n');
      fs.writeFileSync(this.outputFile, content, 'utf8');
      console.log(`\n测试结果已保存到: ${this.outputFile}`);
    } catch (error) {
      console.error(`保存测试结果失败: ${error.message}`);
    }
  }
}

// 运行测试
if (require.main === module) {
  const tester = new CrawlerTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n所有测试完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n测试过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = CrawlerTester;
