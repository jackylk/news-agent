# 爬虫测试框架

## 概述

这个测试框架用于测试不同类型信息源的爬取能力，验证各种爬虫的实现是否正确。

## 测试的信息源

1. **动手学深度学习 (RSS)** - `https://zh.d2l.ai/feed.xml`
2. **MIT Technology Review AI (RSS)** - `https://www.technologyreview.com/topic/artificial-intelligence/feed/`
3. **DeepMind Blog (RSS)** - `https://deepmind.com/blog/feed/basic/`
4. **Karpathy Blog (RSS)** - `https://karpathy.ai/feed.xml`
5. **机器之心 (RSS)** - `https://www.jiqizhixin.com/rss`
6. **CSDN AI博客** - `https://blog.csdn.net/nav/ai`
7. **Elon Musk Twitter (RSS)** - `https://rss.xcancel.com/elonmusk/rss`

## 运行测试

### 方法1: 使用npm脚本

```bash
cd server
npm run test:crawlers
```

### 方法2: 直接运行

```bash
cd server
node tests/test-crawlers.js
```

## 测试输出

测试结果会同时输出到：
1. **控制台** - 实时显示测试进度和结果
2. **文件** - `server/tests/test-results.txt` - 保存完整的测试日志

## 测试内容

每个信息源会测试：
- ✅ 类型检测是否正确
- ✅ 能否成功连接和解析
- ✅ 能否提取文章列表
- ✅ 能否提取文章内容
- ✅ 内容质量（长度、完整性）

## 测试报告

测试完成后会生成汇总报告，包括：
- 总测试数
- 成功/失败数量
- 提取的文章总数
- 平均耗时
- 每个信息源的详细信息
- 失败测试的错误信息

## 注意事项

1. 测试会在信息源之间等待2秒，避免请求过快
2. 某些信息源可能需要较长时间（特别是需要JS渲染的网站）
3. 如果某个信息源失败，不会影响其他测试继续执行
4. 测试结果文件会覆盖之前的测试结果
