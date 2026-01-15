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

// 手动触发新闻收集（按用户订阅，支持按主题过滤）
app.post('/api/collect', async (req, res) => {
  try {
    const User = require('./models/User');
    const db = require('./config/database');
    const collector = new NewsCollector();
    
    // 尝试从请求头获取用户token
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    let userId = null;
    
    if (token) {
      // 验证token并获取用户ID
      try {
        const decoded = await new Promise((resolve, reject) => {
          User.verifyToken(token, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
          });
        });
        userId = decoded.id;
      } catch (err) {
        // token无效，忽略，继续为所有用户收集
        console.log('Token验证失败，将为所有用户收集新闻');
      }
    }
    
    // 获取请求体中的主题关键词（可选）
    const { topicKeywords } = req.body || {};
    
    if (userId) {
      let subscriptionsToCollect = [];
      
      if (topicKeywords) {
        // 如果指定了主题关键词，只收集该主题对应的订阅信息源
        // 1. 获取该主题的推荐历史
        const historyResult = await db.query(
          'SELECT recommended_sources FROM recommendation_history WHERE user_id = $1 AND topic_keywords = $2',
          [userId, topicKeywords]
        );
        
        if (historyResult.rows.length === 0) {
          return res.json({ 
            success: true, 
            message: `主题 "${topicKeywords}" 没有推荐历史，请先在订阅管理页面为该主题获取推荐信息源` 
          });
        }
        
        // 2. 解析推荐信息源
        const history = historyResult.rows[0];
        let recommendedSources = [];
        if (history.recommended_sources) {
          if (typeof history.recommended_sources === 'string') {
            recommendedSources = JSON.parse(history.recommended_sources);
          } else {
            recommendedSources = history.recommended_sources;
          }
        }
        
        // 3. 获取推荐信息源的名称列表
        const recommendedSourceNames = recommendedSources.map(s => s.sourceName || s.name).filter(Boolean);
        
        if (recommendedSourceNames.length === 0) {
          return res.json({ 
            success: true, 
            message: `主题 "${topicKeywords}" 没有推荐信息源` 
          });
        }
        
        // 4. 从用户订阅中筛选出属于该主题的订阅
        const allSubscriptionsResult = await db.query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1',
          [userId]
        );
        
        subscriptionsToCollect = allSubscriptionsResult.rows.filter(sub => 
          recommendedSourceNames.includes(sub.source_name)
        );
        
        if (subscriptionsToCollect.length === 0) {
          return res.json({ 
            success: true, 
            message: `主题 "${topicKeywords}" 的推荐信息源尚未订阅，请先在订阅管理页面订阅这些信息源` 
          });
        }
      } else {
        // 没有指定主题，收集该用户的所有订阅
        const subscriptionsResult = await db.query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1',
          [userId]
        );
        
        subscriptionsToCollect = subscriptionsResult.rows;
      }
      
      if (subscriptionsToCollect.length === 0) {
        return res.json({ 
          success: true, 
          message: '您还没有订阅任何信息源，请先在订阅管理页面添加主题并订阅信息源' 
        });
      }
      
      await collector.collectForUser(userId, subscriptionsToCollect);
      res.json({ 
        success: true, 
        message: `新闻收集完成，已从 ${subscriptionsToCollect.length} 个订阅源收集新闻${topicKeywords ? `（主题：${topicKeywords}）` : ''}` 
      });
    } else {
      // 为所有用户收集其订阅的信息源
      const usersResult = await db.query('SELECT DISTINCT user_id FROM user_subscriptions');
      const userIds = usersResult.rows.map(row => row.user_id);
      
      if (userIds.length === 0) {
        return res.json({ 
          success: true, 
          message: '没有用户订阅，跳过收集' 
        });
      }
      
      let totalCollected = 0;
      for (const uid of userIds) {
        const subscriptionsResult = await db.query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1',
          [uid]
        );
        
        if (subscriptionsResult.rows.length === 0) continue;
        
        const count = await collector.collectForUser(uid, subscriptionsResult.rows).catch(err => {
          console.error(`为用户 ${uid} 收集新闻失败:`, err);
          return 0;
        });
        totalCollected += count;
      }
      
      res.json({ 
        success: true, 
        message: `新闻收集完成，已为 ${userIds.length} 个用户收集新闻` 
      });
    }
  } catch (error) {
    console.error('收集新闻失败:', error);
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
