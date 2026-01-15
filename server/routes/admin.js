const express = require('express');
const router = express.Router();
const News = require('../models/News');
const NewsCollector = require('../services/newsCollector');
const User = require('../models/User');

// 简单的身份验证中间件（可以通过环境变量配置）
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123'; // 默认token，生产环境应该使用强密码

function authenticateAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      message: '未授权：需要有效的管理员令牌'
    });
  }
  
  next();
}

// 获取所有来源列表（带详细信息）
router.get('/sources', authenticateAdmin, (req, res) => {
  News.getSourceDetails((err, sources) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取来源列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: sources
    });
  });
});

// 删除某个来源的所有数据
router.delete('/source/:source', authenticateAdmin, (req, res) => {
  const source = decodeURIComponent(req.params.source);
  
  if (!source || source.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '来源名称不能为空'
    });
  }
  
  News.deleteBySource(source, (err, deletedCount) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '删除来源数据失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      message: `已删除来源 "${source}" 的 ${deletedCount} 条数据`,
      deletedCount: deletedCount
    });
  });
});

// 刷新某个来源的数据（重新收集）
router.post('/source/:source/refresh', authenticateAdmin, async (req, res) => {
  const source = decodeURIComponent(req.params.source);
  
  if (!source || source.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '来源名称不能为空'
    });
  }
  
  try {
    const collector = new NewsCollector();
    
    // 异步执行收集，立即返回响应
    collector.collectFromSource(source).catch(err => {
      console.error(`刷新来源 "${source}" 失败:`, err);
    });
    
    res.json({
      success: true,
      message: `已开始刷新来源 "${source}" 的数据，请稍后查看结果`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '刷新来源数据失败',
      error: error.message
    });
  }
});

// 获取所有用户列表
router.get('/users', authenticateAdmin, (req, res) => {
  User.getAll((err, users) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取用户列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: users
    });
  });
});

// 获取系统统计信息
router.get('/stats', authenticateAdmin, (req, res) => {
  News.getLastUpdateInfo((err, info) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: err.message
      });
    }
    
    News.getTotalCount((err, totalCount) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '获取总数失败',
          error: err.message
        });
      }
      
      res.json({
        success: true,
        data: {
          totalCount: totalCount,
          lastUpdated: info.lastUpdateTime,
          totalCountFromInfo: info.totalCount
        }
      });
    });
  });
});

// 获取所有用户的主题词列表（管理员用）
router.get('/topics', authenticateAdmin, (req, res) => {
  User.getAllTopics((err, topics) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取主题词列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: topics || []
    });
  });
});

// 删除用户主题词（管理员用）
router.delete('/topics/:userId/:keywords', authenticateAdmin, (req, res) => {
  const userId = parseInt(req.params.userId);
  const keywords = decodeURIComponent(req.params.keywords);
  const deleteArticles = req.query.deleteArticles === 'true';
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户ID'
    });
  }
  
  if (!keywords || keywords.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '主题词不能为空'
    });
  }
  
    User.removeTopicByAdmin(userId, keywords, deleteArticles, (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: '删除主题词失败',
          error: err.message
        });
      }
      
      if (!result.deleted) {
        return res.status(404).json({
          success: false,
          message: '主题词不存在'
        });
      }
      
      let message = '主题词删除成功';
      if (deleteArticles && result.deletedArticleCount > 0) {
        message += `，已删除 ${result.deletedArticleCount} 篇相关文章`;
      }
      if (result.deletedSubscriptionCount > 0) {
        message += `，已删除 ${result.deletedSubscriptionCount} 个相关订阅信息源`;
      }
      
      res.json({
        success: true,
        message: message,
        deletedArticleCount: result.deletedArticleCount || 0,
        deletedSubscriptionCount: result.deletedSubscriptionCount || 0
      });
    });
});

// 获取所有用户的订阅信息源列表（管理员用）
router.get('/subscriptions', authenticateAdmin, (req, res) => {
  User.getAllSubscriptions((err, subscriptions) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取订阅列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: subscriptions || []
    });
  });
});

// 删除用户订阅信息源（管理员用）
router.delete('/subscriptions/:userId/:sourceName', authenticateAdmin, (req, res) => {
  const userId = parseInt(req.params.userId);
  const sourceName = decodeURIComponent(req.params.sourceName);
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: '无效的用户ID'
    });
  }
  
  if (!sourceName || sourceName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '信息源名称不能为空'
    });
  }
  
  User.removeSubscriptionByAdmin(userId, sourceName, (err, result) => {
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
      message: `已删除用户订阅信息源 "${sourceName}"`
    });
  });
});

// 获取新闻列表（管理员用，支持分页和搜索）
router.get('/news', authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const search = req.query.search || '';
  const source = req.query.source || '';

  News.getListForAdmin(page, pageSize, search, source, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新闻列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: result
    });
  });
});

// 删除单条新闻
router.delete('/news/:id', authenticateAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: '无效的新闻ID'
    });
  }
  
  News.deleteById(id, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '删除新闻失败',
        error: err.message
      });
    }
    
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: '新闻不存在'
      });
    }
    
    res.json({
      success: true,
      message: '新闻删除成功'
    });
  });
});

// 批量删除新闻
router.delete('/news', authenticateAdmin, (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供要删除的新闻ID列表'
    });
  }
  
  const validIds = ids.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));
  
  if (validIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: '无效的新闻ID列表'
    });
  }
  
  News.deleteByIds(validIds, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '批量删除新闻失败',
        error: err.message
      });
    }
    
    res.json({
      success: true,
      message: `已删除 ${result.deletedCount} 条新闻`,
      deletedCount: result.deletedCount
    });
  });
});

module.exports = router;
