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
const rateLimit = require('express-rate-limit');
const newsRoutes = require('./routes/news');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const NewsCollector = require('./services/newsCollector');

const app = express();
const PORT = process.env.PORT || 3000;

// 速率限制配置
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 15分钟内最多5次请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 在生产环境跳过本地IP的限制（用于开发测试）
    if (process.env.NODE_ENV !== 'production' && req.ip === '::1') {
      return false;
    }
    return false;
  }
});

// 注册和登录的速率限制
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 1小时内最多3次注册
  message: {
    success: false,
    message: '注册请求过于频繁，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${clientIP}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    // 记录请求体（但不记录密码等敏感信息）
    const bodyCopy = { ...req.body };
    if (bodyCopy.password) {
      bodyCopy.password = '***';
    }
    console.log(`[${timestamp}]   请求体:`, JSON.stringify(bodyCopy));
  }
  next();
});

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（提供 web 目录下的前端页面）
const path = require('path');
app.use(express.static(path.join(__dirname, '../web')));

// 路由（应用速率限制）
// 注意：速率限制必须在路由之前应用
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
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
    
    // 设置流式响应头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 发送初始消息
    const sendProgress = (data) => {
      res.write(JSON.stringify(data) + '\n');
    };
    
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
          sendProgress({ 
            type: 'error',
            success: false, 
            message: `主题 "${topicKeywords}" 没有推荐历史，请先在订阅管理页面为该主题获取推荐信息源` 
          });
          return res.end();
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
          sendProgress({ 
            type: 'error',
            success: false, 
            message: `主题 "${topicKeywords}" 没有推荐信息源` 
          });
          return res.end();
        }
        
        // 4. 从用户订阅中筛选出属于该主题的订阅（必须匹配主题关键词）
        const subscriptionsResult = await db.query(
          'SELECT * FROM user_subscriptions WHERE user_id = $1 AND topic_keywords = $2',
          [userId, topicKeywords]
        );
        
        subscriptionsToCollect = subscriptionsResult.rows.filter(sub => 
          recommendedSourceNames.includes(sub.source_name)
        );
        
        if (subscriptionsToCollect.length === 0) {
          sendProgress({ 
            type: 'error',
            success: false, 
            message: `主题 "${topicKeywords}" 的推荐信息源尚未订阅，请先在订阅管理页面订阅这些信息源` 
          });
          return res.end();
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
        sendProgress({ 
          type: 'error',
          success: false, 
          message: '您还没有订阅任何信息源，请先在订阅管理页面添加主题并订阅信息源' 
        });
        return res.end();
      }
      
      // 发送开始消息
      sendProgress({
        type: 'start',
        message: `开始收集新闻，共 ${subscriptionsToCollect.length} 个订阅源${topicKeywords ? `（主题：${topicKeywords}）` : ''}`,
        total: subscriptionsToCollect.length
      });
      
      // 收集新闻，传入进度回调和主题关键词
      console.log(`[新闻收集] 调用 collectForUser，参数:`);
      console.log(`[新闻收集]   - userId: ${userId}`);
      console.log(`[新闻收集]   - subscriptions数量: ${subscriptionsToCollect.length}`);
      console.log(`[新闻收集]   - topicKeywords: ${topicKeywords || '无（不过滤）'}`);
      await collector.collectForUser(userId, subscriptionsToCollect, (progress) => {
        sendProgress(progress);
      }, topicKeywords);
      
      // 发送完成消息
      sendProgress({ 
        type: 'final',
        success: true, 
        message: `新闻收集完成，已从 ${subscriptionsToCollect.length} 个订阅源收集新闻${topicKeywords ? `（主题：${topicKeywords}）` : ''}` 
      });
      
      res.end();
    } else {
      // 为所有用户收集其订阅的信息源（不支持进度显示，因为涉及多个用户）
      const usersResult = await db.query('SELECT DISTINCT user_id FROM user_subscriptions');
      const userIds = usersResult.rows.map(row => row.user_id);
      
      if (userIds.length === 0) {
        sendProgress({ 
          type: 'error',
          success: false, 
          message: '没有用户订阅，跳过收集' 
        });
        return res.end();
      }
      
      sendProgress({
        type: 'start',
        message: `开始为 ${userIds.length} 个用户收集新闻`,
        total: userIds.length
      });
      
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
      
      sendProgress({ 
        type: 'final',
        success: true, 
        message: `新闻收集完成，已为 ${userIds.length} 个用户收集新闻` 
      });
      
      res.end();
    }
  } catch (error) {
    console.error('收集新闻失败:', error);
    res.write(JSON.stringify({ 
      type: 'error',
      success: false, 
      message: error.message 
    }) + '\n');
    res.end();
  }
});


// 启动服务器
// Railway 要求监听 0.0.0.0 而不是 localhost
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  // 获取实际的服务地址（用于日志显示）
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || 
                        process.env.RAILWAY_STATIC_URL ||
                        process.env.RAILWAY_ENVIRONMENT_NAME;
  const vercelUrl = process.env.VERCEL_URL;
  
  console.log(`✅ 服务器已启动`);
  console.log(`   监听地址: ${HOST}:${PORT}`);
  
  if (railwayDomain) {
    console.log(`   Railway 部署地址: https://${railwayDomain}`);
  } else if (vercelUrl) {
    console.log(`   Vercel 部署地址: https://${vercelUrl}`);
  } else if (HOST === '0.0.0.0') {
    console.log(`   本地访问: http://localhost:${PORT}`);
    console.log(`   网络访问: http://0.0.0.0:${PORT}`);
  } else {
    console.log(`   访问地址: http://${HOST}:${PORT}`);
  }
  
  console.log(`\n📚 API文档:`);
  console.log(`  GET  /api/news/list - 获取新闻列表`);
  console.log(`  GET  /api/news/:id - 获取新闻详情`);
  console.log(`  POST /api/collect - 手动触发新闻收集`);
  console.log(`\n🔐 管理接口:`);
  console.log(`  GET    /api/admin/sources - 获取所有来源列表（需要管理员令牌）`);
  console.log(`  DELETE /api/admin/source/:source - 删除某个来源的数据（需要管理员令牌）`);
  console.log(`  POST   /api/admin/source/:source/refresh - 刷新某个来源的数据（需要管理员令牌）`);
  console.log(`  GET    /api/admin/stats - 获取系统统计信息（需要管理员令牌）`);
  console.log(`\n💾 数据库: 已持久化，启动时不再自动收集新闻`);
  console.log(`\n📰 新闻收集方式：`);
  console.log(`  - 手动触发：POST /api/collect`);
});
