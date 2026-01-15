const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TopicRecommender = require('../services/topicRecommender');

// 认证中间件
function authenticateUser(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    });
  }
  
  User.verifyToken(token, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: '无效的token'
      });
    }
    
    req.user = decoded;
    next();
  });
}

// 所有路由都需要认证
router.use(authenticateUser);

// 添加用户主题
router.post('/topics', (req, res) => {
  const { keywords } = req.body;
  
  if (!keywords || keywords.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '主题关键词不能为空'
    });
  }
  
  User.addTopic(req.user.id, keywords.trim(), (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '添加主题失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      message: '主题添加成功',
      topic: result
    });
  });
});

// 获取用户主题列表
router.get('/topics', (req, res) => {
  User.getTopics(req.user.id, (err, topics) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取主题列表失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      data: topics
    });
  });
});

// 删除用户主题
router.delete('/topics/:keywords', (req, res) => {
  const keywords = decodeURIComponent(req.params.keywords);
  
  User.removeTopic(req.user.id, keywords, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '删除主题失败',
        error: err.message
      });
    }
    
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: '主题不存在'
      });
    }
    
    let message = '主题删除成功';
    if (result.deletedSubscriptionCount > 0) {
      message += `，已删除 ${result.deletedSubscriptionCount} 个相关订阅信息源`;
    }
    
    res.json({
      success: true,
      message: message,
      deletedSubscriptionCount: result.deletedSubscriptionCount || 0
    });
  });
});

// 根据主题推荐信息源
router.post('/topics/recommend', async (req, res) => {
  const { keywords } = req.body;
  
  if (!keywords || keywords.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '主题关键词不能为空'
    });
  }
  
  const trimmedKeywords = keywords.trim();
  const processLogs = [];
  const startTime = Date.now();
  
  // 后台日志：开始推荐
  console.log(`\n[推荐信息源] 用户 ${req.user.id} (${req.user.username}) 开始为关键词 "${trimmedKeywords}" 获取推荐信息源...`);
  
  try {
    // 记录开始
    const startLog = {
      message: `开始为关键词 "${trimmedKeywords}" 获取推荐信息源...`,
      type: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(startLog);
    console.log(`[推荐信息源] ${startLog.message}`);
    
    const apiCallLog = {
      message: '正在调用 DeepSeek API...',
      type: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(apiCallLog);
    console.log(`[推荐信息源] ${apiCallLog.message}`);
    
    const paramsLog = {
      message: `请求参数: { keywords: "${trimmedKeywords}" }`,
      type: 'info',
      timestamp: new Date().toISOString()
    };
    processLogs.push(paramsLog);
    console.log(`[推荐信息源] ${paramsLog.message}`);
    
    const recommender = new TopicRecommender();
    console.log(`[推荐信息源] 调用 DeepSeek API 获取推荐...`);
    const sources = await recommender.recommendSources(trimmedKeywords);
    console.log(`[推荐信息源] DeepSeek API 返回 ${sources.length} 个推荐信息源`);
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const apiCompleteLog = {
      message: `API 调用完成，耗时 ${elapsedTime} 秒`,
      type: 'success',
      timestamp: new Date().toISOString()
    };
    processLogs.push(apiCompleteLog);
    console.log(`[推荐信息源] ${apiCompleteLog.message}`);
    
    const successLog = {
      message: `成功获取 ${sources.length} 个推荐信息源`,
      type: 'success',
      timestamp: new Date().toISOString()
    };
    processLogs.push(successLog);
    console.log(`[推荐信息源] ${successLog.message}`);
    
    // 开始验证信息源
    const validateStartLog = {
      message: `开始验证 ${sources.length} 个信息源的有效性...`,
      type: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(validateStartLog);
    console.log(`[推荐信息源] ${validateStartLog.message}`);
    
    // 验证信息源，带进度回调
    const validatedSources = await recommender.validateSources(sources, (sourceName, sourceUrl, result) => {
      if (result.validating) {
        const validatingLog = {
          message: `正在验证: ${sourceName} (${sourceUrl})...`,
          type: 'loading',
          timestamp: new Date().toISOString()
        };
        processLogs.push(validatingLog);
        console.log(`[推荐信息源] ${validatingLog.message}`);
      } else if (result.valid) {
        const validLog = {
          message: `✓ ${sourceName} 验证通过`,
          type: 'success',
          timestamp: new Date().toISOString()
        };
        processLogs.push(validLog);
        console.log(`[推荐信息源] ${validLog.message}`);
      } else {
        const invalidLog = {
          message: `✗ ${sourceName} 验证失败: ${result.error || '无效的RSS源'}`,
          type: 'error',
          timestamp: new Date().toISOString()
        };
        processLogs.push(invalidLog);
        console.log(`[推荐信息源] ${invalidLog.message}`);
      }
    });
    
    // 统计验证结果
    const validCount = validatedSources.filter(s => s.isValid).length;
    const invalidCount = validatedSources.filter(s => !s.isValid).length;
    
    const validateCompleteLog = {
      message: `验证完成: ${validCount} 个有效，${invalidCount} 个无效`,
      type: validCount > 0 ? 'success' : 'warning',
      timestamp: new Date().toISOString()
    };
    processLogs.push(validateCompleteLog);
    console.log(`[推荐信息源] ${validateCompleteLog.message}`);
    console.log(`[推荐信息源] 推荐完成，共 ${validatedSources.length} 个信息源，其中 ${validCount} 个有效，${invalidCount} 个无效\n`);
    
    // 保存推荐历史到数据库（包含验证结果）
    console.log(`[推荐信息源] 正在保存推荐历史到数据库...`);
    User.saveRecommendationHistory(
      req.user.id,
      trimmedKeywords,
      processLogs,
      validatedSources,
      (err, result) => {
        if (err) {
          console.error('[推荐信息源] 保存推荐历史失败:', err);
          // 即使保存失败，也返回推荐结果
        } else {
          console.log(`[推荐信息源] 推荐历史已保存到数据库`);
        }
      }
    );
    
    res.json({
      success: true,
      data: validatedSources,
      processLogs: processLogs,
      message: `已找到 ${sources.length} 个推荐信息源，其中 ${validCount} 个有效，${invalidCount} 个无效`
    });
  } catch (error) {
    const errorLog = {
      message: `API 调用异常: ${error.message}`,
      type: 'error',
      timestamp: new Date().toISOString()
    };
    processLogs.push(errorLog);
    console.error(`[推荐信息源] ${errorLog.message}`);
    console.error(`[推荐信息源] 错误详情:`, error);
    
    // 即使失败也保存错误日志
    console.log(`[推荐信息源] 正在保存错误日志到数据库...`);
    User.saveRecommendationHistory(
      req.user.id,
      trimmedKeywords,
      processLogs,
      [],
      (err, result) => {
        if (err) {
          console.error('[推荐信息源] 保存推荐历史失败:', err);
        } else {
          console.log(`[推荐信息源] 错误日志已保存到数据库`);
        }
      }
    );
    
    res.status(500).json({
      success: false,
      message: error.message,
      processLogs: processLogs
    });
  }
});

// 获取用户最新的推荐历史（保留向后兼容）
router.get('/topics/recommend/history', (req, res) => {
  User.getLatestRecommendationHistory(req.user.id, (err, history) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取推荐历史失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      data: history
    });
  });
});

// 获取用户所有主题的推荐历史
router.get('/topics/recommend/history/all', (req, res) => {
  User.getAllRecommendationHistory(req.user.id, (err, histories) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取推荐历史失败',
        error: err.message
      });
    }
    
    res.json({ success: true, data: histories || [] });
  });
});

// 根据主题关键词获取推荐历史
router.get('/topics/recommend/history/:keywords', (req, res) => {
  const keywords = decodeURIComponent(req.params.keywords);
  User.getRecommendationHistoryByTopic(req.user.id, keywords, (err, history) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取推荐历史失败',
        error: err.message
      });
    }
    
    res.json({ success: true, data: history });
  });
});

// 添加用户订阅
router.post('/subscriptions', (req, res) => {
  const { subscriptions } = req.body;
  
  if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
    return res.status(400).json({
      success: false,
      message: '订阅列表不能为空'
    });
  }
  
  User.addSubscriptions(req.user.id, subscriptions, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '添加订阅失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      message: '订阅添加成功',
      data: result
    });
  });
});

// 获取用户订阅列表
router.get('/subscriptions', (req, res) => {
  User.getSubscriptions(req.user.id, (err, subscriptions) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取订阅列表失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      data: subscriptions
    });
  });
});

// 删除用户订阅
router.delete('/subscriptions/:sourceName', (req, res) => {
  const sourceName = decodeURIComponent(req.params.sourceName);
  
  User.removeSubscription(req.user.id, sourceName, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '删除订阅失败',
        error: err.message
      });
    }
    
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: '订阅不存在'
      });
    }
    
    res.json({
      success: true,
      message: '订阅删除成功'
    });
  });
});

module.exports = router;
