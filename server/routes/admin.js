const express = require('express');
const router = express.Router();
const News = require('../models/News');
const NewsCollector = require('../services/newsCollector');

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

module.exports = router;
