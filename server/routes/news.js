const express = require('express');
const router = express.Router();
const News = require('../models/News');

// 获取新闻列表（按日期分组）
router.get('/list', (req, res) => {
  News.getListByDate((err, data) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新闻列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: data
    });
  });
});

// 搜索新闻
router.get('/search', (req, res) => {
  const keyword = req.query.q || req.query.keyword || '';
  
  if (!keyword || keyword.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '请输入搜索关键词'
    });
  }

  News.search(keyword.trim(), (err, data) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '搜索失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: data,
      keyword: keyword.trim()
    });
  });
});


// 获取所有新闻源列表（必须在/:id之前）
router.get('/sources', (req, res) => {
  News.getSources((err, sources) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新闻源列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: sources
    });
  });
});

// 按新闻源获取新闻列表（必须在/:id之前）
router.get('/source/:source', (req, res) => {
  const source = decodeURIComponent(req.params.source);
  
  News.getListBySource(source, (err, data) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新闻列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: data,
      source: source
    });
  });
});

// 获取新闻详情（必须在最后）
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: '无效的新闻ID'
    });
  }

  News.getById(id, (err, news) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新闻详情失败',
        error: err.message
      });
    }
    
    if (!news) {
      return res.status(404).json({
        success: false,
        message: '新闻不存在'
      });
    }

    res.json({
      success: true,
      data: news
    });
  });
});

module.exports = router;
