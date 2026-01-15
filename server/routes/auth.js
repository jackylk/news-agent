const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 用户注册
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  
  User.create({ username, email, password }, (err, user) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  });
});

// 用户登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  User.login({ username, password }, (err, result) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: err.message
      });
    }
    
    res.json({
      success: true,
      message: '登录成功',
      token: result.token,
      user: result.user
    });
  });
});

// 验证token（获取当前用户信息）
router.get('/me', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供token'
    });
  }
  
  User.verifyToken(token, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: '无效的token'
      });
    }
    
    User.getById(decoded.id, (err, user) => {
      if (err) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.is_admin
        }
      });
    });
  });
});

module.exports = router;
