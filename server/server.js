require('dotenv').config();
const express = require('express');
const cors = require('cors');
const newsRoutes = require('./routes/news');
const NewsCollector = require('./services/newsCollector');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/news', newsRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常' });
});

// 手动触发新闻收集（用于测试）
app.post('/api/collect', async (req, res) => {
  try {
    const collector = new NewsCollector();
    await collector.collectFromRSS();
    res.json({ success: true, message: '新闻收集完成' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 定时任务：每30分钟收集一次新闻
cron.schedule('*/30 * * * *', () => {
  console.log('开始定时收集新闻...');
  const collector = new NewsCollector();
  collector.collectFromRSS().catch(err => {
    console.error('定时收集新闻失败:', err);
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API文档:`);
  console.log(`  GET  /api/news/list - 获取新闻列表`);
  console.log(`  GET  /api/news/:id - 获取新闻详情`);
  console.log(`  POST /api/collect - 手动触发新闻收集`);
  console.log(`数据库已持久化，启动时不再自动收集新闻`);
  console.log(`新闻收集方式：`);
  console.log(`  - 定时任务：每30分钟自动收集`);
  console.log(`  - 手动触发：POST /api/collect`);
});
