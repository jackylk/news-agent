require('dotenv').config();

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 20) {
  console.error(`❌ 错误: 需要 Node.js 20+，当前版本: ${nodeVersion}`);
  console.error('   请升级 Node.js 版本或使用 Node.js 20+ 的 Docker 镜像');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const newsRoutes = require('./routes/news');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
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

// 静态文件服务（提供 web 目录下的前端页面）
const path = require('path');
app.use(express.static(path.join(__dirname, '../web')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常' });
});

// 手动触发新闻收集（用于测试）
app.post('/api/collect', async (req, res) => {
  try {
    const collector = new NewsCollector();
    await collector.collectAll(); // 使用综合收集方法
    res.json({ success: true, message: '新闻收集完成（RSS + 博客）' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 定时任务：每10分钟收集一次新闻（按用户订阅）
cron.schedule('*/10 * * * *', async () => {
  console.log('开始定时收集新闻（按用户订阅）...');
  try {
    const User = require('./models/User');
    const db = require('./config/database');
    
    // 获取所有用户的订阅
    const usersResult = await db.query('SELECT DISTINCT user_id FROM user_subscriptions');
    const userIds = usersResult.rows.map(row => row.user_id);
    
    if (userIds.length === 0) {
      console.log('没有用户订阅，跳过收集');
      return;
    }
    
    // 为每个用户收集其订阅的信息源
    for (const userId of userIds) {
      const subscriptionsResult = await db.query(
        'SELECT * FROM user_subscriptions WHERE user_id = $1',
        [userId]
      );
      
      if (subscriptionsResult.rows.length === 0) continue;
      
      const collector = new NewsCollector();
      // 这里需要修改 NewsCollector 支持按订阅收集
      // 暂时使用 collectAll，后续会优化
      await collector.collectForUser(userId, subscriptionsResult.rows).catch(err => {
        console.error(`为用户 ${userId} 收集新闻失败:`, err);
      });
    }
    
    console.log(`已为 ${userIds.length} 个用户收集新闻`);
  } catch (error) {
    console.error('定时收集新闻失败:', error);
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API文档:`);
  console.log(`  GET  /api/news/list - 获取新闻列表`);
  console.log(`  GET  /api/news/:id - 获取新闻详情`);
  console.log(`  POST /api/collect - 手动触发新闻收集`);
  console.log(`管理接口:`);
  console.log(`  GET    /api/admin/sources - 获取所有来源列表（需要管理员令牌）`);
  console.log(`  DELETE /api/admin/source/:source - 删除某个来源的数据（需要管理员令牌）`);
  console.log(`  POST   /api/admin/source/:source/refresh - 刷新某个来源的数据（需要管理员令牌）`);
  console.log(`  GET    /api/admin/stats - 获取系统统计信息（需要管理员令牌）`);
  console.log(`数据库已持久化，启动时不再自动收集新闻`);
  console.log(`新闻收集方式：`);
  console.log(`  - 定时任务：每30分钟自动收集`);
  console.log(`  - 手动触发：POST /api/collect`);
});
