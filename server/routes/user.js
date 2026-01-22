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
    if (result.deletedArticleCount > 0) {
      message += `，已删除 ${result.deletedArticleCount} 篇相关文章`;
    }
    
    res.json({
      success: true,
      message: message,
      deletedSubscriptionCount: result.deletedSubscriptionCount || 0,
      deletedArticleCount: result.deletedArticleCount || 0
    });
  });
});

// 根据主题推荐信息源
router.post('/topics/recommend', async (req, res) => {
  const { keywords, limit = 10, excludeSources = [] } = req.body;
  
  if (!keywords || keywords.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '主题关键词不能为空'
    });
  }
  
  const trimmedKeywords = keywords.trim();
  const processLogs = [];
  const startTime = Date.now();
  
  // 设置流式响应头
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 发送进度消息的函数
  const sendProgress = (data) => {
    res.write(JSON.stringify(data) + '\n');
  };
  
  // 后台日志：开始推荐
  console.log(`\n[推荐信息源] 用户 ${req.user.id} (${req.user.username}) 开始为关键词 "${trimmedKeywords}" 获取推荐信息源...`);
  
  try {
    // 记录开始
    const startLog = {
      type: 'progress',
      message: `开始为关键词 "${trimmedKeywords}" 获取推荐信息源...`,
      logType: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(startLog);
    sendProgress(startLog);
    console.log(`[推荐信息源] ${startLog.message}`);
    
    // 立即保存推荐历史（状态为进行中）
    User.saveRecommendationHistory(
      req.user.id,
      trimmedKeywords,
      processLogs,
      [],
      'in_progress',
      (err, result) => {
        if (err) {
          console.error('[推荐信息源] 保存初始推荐历史失败:', err);
        } else {
          console.log(`[推荐信息源] 初始推荐历史已保存（状态：进行中）`);
        }
      }
    );
    
    const apiCallLog = {
      type: 'progress',
      message: `正在调用 DeepSeek API 为"${trimmedKeywords}"做信息源推荐...`,
      logType: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(apiCallLog);
    sendProgress(apiCallLog);
    console.log(`[推荐信息源] ${apiCallLog.message}`);
    
    const recommender = new TopicRecommender();
    const recommendLimit = parseInt(limit) || 10;
    console.log(`[推荐信息源] 调用 DeepSeek API 获取推荐（限制${recommendLimit}个，排除${excludeSources.length}个已推荐）...`);
    const sources = await recommender.recommendSources(trimmedKeywords, recommendLimit, excludeSources);
    console.log(`[推荐信息源] DeepSeek API 返回 ${sources.length} 个推荐信息源`);
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const apiCompleteLog = {
      type: 'progress',
      message: `API 调用完成，耗时 ${elapsedTime} 秒`,
      logType: 'success',
      timestamp: new Date().toISOString()
    };
    processLogs.push(apiCompleteLog);
    sendProgress(apiCompleteLog);
    console.log(`[推荐信息源] ${apiCompleteLog.message}`);
    
    const successLog = {
      type: 'progress',
      message: `成功获取 ${sources.length} 个推荐信息源`,
      logType: 'success',
      timestamp: new Date().toISOString()
    };
    processLogs.push(successLog);
    sendProgress(successLog);
    console.log(`[推荐信息源] ${successLog.message}`);
    
    // 先发送所有推荐的信息源（未验证状态），让前端先显示表格
    sendProgress({
      type: 'sourcesReceived',
      sources: sources.map(s => ({
        ...s,
        isValid: undefined, // 未验证状态
        validationError: null
      }))
    });
    
    // 开始验证信息源
    const validateStartLog = {
      type: 'progress',
      message: `开始验证 ${sources.length} 个信息源的有效性...`,
      logType: 'loading',
      timestamp: new Date().toISOString()
    };
    processLogs.push(validateStartLog);
    sendProgress(validateStartLog);
    console.log(`[推荐信息源] ${validateStartLog.message}`);
    
    // 验证信息源，带进度回调（实时推送）
    const validatedSources = [];
    await recommender.validateSources(sources, (sourceName, sourceUrl, result, sourceData) => {
      if (result.validating) {
        const validatingLog = {
          type: 'progress',
          message: `正在验证: ${sourceName}`,
          logType: 'loading',
          timestamp: new Date().toISOString()
        };
        processLogs.push(validatingLog);
        sendProgress(validatingLog);
        console.log(`[推荐信息源] ${validatingLog.message}`);
      } else {
        // 验证完成，构建验证后的信息源对象
        const validatedSource = {
          ...sourceData,
          isValid: result.valid,
          validationError: result.error || null
        };
        validatedSources.push(validatedSource);
        
        if (result.valid) {
          const validLog = {
            type: 'progress',
            message: `✓ ${sourceName} 验证通过`,
            logType: 'success',
            timestamp: new Date().toISOString()
          };
          processLogs.push(validLog);
          sendProgress(validLog);
          console.log(`[推荐信息源] ${validLog.message}`);
        } else {
          const invalidLog = {
            type: 'progress',
            message: `✗ ${sourceName} 验证失败: ${result.error || '无效的RSS源'}`,
            logType: 'error',
            timestamp: new Date().toISOString()
          };
          processLogs.push(invalidLog);
          sendProgress(invalidLog);
          console.log(`[推荐信息源] ${invalidLog.message}`);
        }
        
        // 实时发送验证结果（无论有效还是无效）
        sendProgress({
          type: 'sourceValidated',
          source: validatedSource
        });
        
        // 定期更新推荐历史（每验证5个信息源更新一次，或验证完成时更新）
        if (validatedSources.length % 5 === 0 || validatedSources.length === sources.length) {
          User.saveRecommendationHistory(
            req.user.id,
            trimmedKeywords,
            processLogs,
            validatedSources,
            'in_progress',
            (err, result) => {
              if (err) {
                console.error('[推荐信息源] 更新推荐历史失败:', err);
              } else {
                console.log(`[推荐信息源] 推荐历史已更新（已验证 ${validatedSources.length}/${sources.length} 个信息源）`);
              }
            }
          );
        }
      }
    });
    
    // 统计验证结果
    const validCount = validatedSources.filter(s => s.isValid).length;
    const invalidCount = validatedSources.filter(s => !s.isValid).length;
    
    const validateCompleteLog = {
      type: 'progress',
      message: `验证完成: ${validCount} 个有效，${invalidCount} 个无效`,
      logType: validCount > 0 ? 'success' : 'warning',
      timestamp: new Date().toISOString()
    };
    processLogs.push(validateCompleteLog);
    sendProgress(validateCompleteLog);
    console.log(`[推荐信息源] ${validateCompleteLog.message}`);
    console.log(`[推荐信息源] 推荐完成，共 ${validatedSources.length} 个信息源，其中 ${validCount} 个有效，${invalidCount} 个无效\n`);
    
    // 保存推荐历史到数据库（包含验证结果，状态为已完成）
    console.log(`[推荐信息源] 正在保存推荐历史到数据库（状态：已完成）...`);
    User.saveRecommendationHistory(
      req.user.id,
      trimmedKeywords,
      processLogs,
      validatedSources,
      'completed',
      (err, result) => {
        if (err) {
          console.error('[推荐信息源] 保存推荐历史失败:', err);
          // 即使保存失败，也返回推荐结果
        } else {
          console.log(`[推荐信息源] 推荐历史已保存到数据库（状态：已完成）`);
        }
      }
    );
    
    // 发送最终结果
    sendProgress({
      type: 'final',
      success: true,
      data: validatedSources,
      processLogs: processLogs,
      message: `已找到 ${sources.length} 个推荐信息源，其中 ${validCount} 个有效，${invalidCount} 个无效`
    });
    
    res.end();
  } catch (error) {
    const errorLog = {
      type: 'progress',
      message: `API 调用异常: ${error.message}`,
      logType: 'error',
      timestamp: new Date().toISOString()
    };
    processLogs.push(errorLog);
    sendProgress(errorLog);
    console.error(`[推荐信息源] ${errorLog.message}`);
    console.error(`[推荐信息源] 错误详情:`, error);
    
    // 即使失败也保存错误日志（状态为失败）
    console.log(`[推荐信息源] 正在保存错误日志到数据库（状态：失败）...`);
    User.saveRecommendationHistory(
      req.user.id,
      trimmedKeywords,
      processLogs,
      [],
      'failed',
      (err, result) => {
        if (err) {
          console.error('[推荐信息源] 保存推荐历史失败:', err);
        } else {
          console.log(`[推荐信息源] 错误日志已保存到数据库（状态：失败）`);
        }
      }
    );
    
    // 发送错误结果
    sendProgress({
      type: 'final',
      success: false,
      message: error.message,
      processLogs: processLogs
    });
    
    res.end();
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

// 获取用户订阅列表（可选：按主题过滤）
router.get('/subscriptions', (req, res) => {
  const topicKeywords = req.query.topicKeywords || null;
  User.getSubscriptions(req.user.id, topicKeywords, (err, subscriptions) => {
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

// 删除用户订阅（需要指定主题关键词）
router.delete('/subscriptions/:sourceName', (req, res) => {
  const sourceName = decodeURIComponent(req.params.sourceName);
  const topicKeywords = req.query.topicKeywords ? decodeURIComponent(req.query.topicKeywords) : null;
  
  // 先删除该信息源和主题对应的文章
  const News = require('../models/News');
  News.deleteByUserSourceAndTopic(req.user.id, sourceName, topicKeywords, (err, deletedArticleCount) => {
    if (err) {
      console.error('[删除订阅] 删除文章失败:', err);
      // 即使删除文章失败，也继续删除订阅
    } else {
      console.log(`[删除订阅] 已删除 ${deletedArticleCount || 0} 篇相关文章`);
    }
    
    // 删除订阅
    User.removeSubscription(req.user.id, sourceName, topicKeywords, (err, result) => {
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
      
      let message = '订阅删除成功';
      if (deletedArticleCount > 0) {
        message += `，已删除 ${deletedArticleCount} 篇相关文章`;
      }
      
      res.json({
        success: true,
        message: message,
        deletedArticleCount: deletedArticleCount || 0
      });
    });
  });
});

// 获取内置信息源列表
router.get('/curated-sources', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../data/curated-sources.json');
    
    if (!fs.existsSync(filePath)) {
      return res.json({
        success: true,
        sources: [],
        total: 0,
        stats: {
          byType: {},
          byRegion: {},
          byCategory: {}
        }
      });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const sources = JSON.parse(content);
    
    // 计算统计信息
    const stats = {
      byType: {},
      byRegion: {},
      byCategory: {}
    };
    
    sources.forEach(source => {
      // 按类型统计
      const type = source.sourceType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // 按地区统计
      const region = source.region || 'unknown';
      stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;
      
      // 按分类统计
      const category = source.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });
    
    res.json({
      success: true,
      sources: sources,
      total: sources.length,
      stats: stats
    });
  } catch (error) {
    console.error('[获取内置信息源] 错误:', error);
    res.status(500).json({
      success: false,
      message: '获取内置信息源失败',
      error: error.message
    });
  }
});

module.exports = router;
