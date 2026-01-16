const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 用户注册
router.post('/register', (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  
  console.log(`[${timestamp}] 📝 收到注册请求`);
  console.log(`[${timestamp}]   来源 IP: ${clientIP}`);
  console.log(`[${timestamp}]   User-Agent: ${userAgent}`);
  console.log(`[${timestamp}]   请求头:`, JSON.stringify(req.headers, null, 2));
  
  const { username, email, password } = req.body;
  
  // 记录请求数据（不记录密码）
  console.log(`[${timestamp}]   用户名: ${username || '(空)'}`);
  console.log(`[${timestamp}]   邮箱: ${email || '(空)'}`);
  console.log(`[${timestamp}]   密码长度: ${password ? password.length : 0}`);
  
  // 验证请求数据
  if (!username || !email || !password) {
    const errorMsg = '用户名、邮箱和密码都是必填项';
    console.log(`[${timestamp}] ❌ 注册失败: ${errorMsg}`);
    return res.status(400).json({
      success: false,
      message: errorMsg
    });
  }
  
  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const errorMsg = '邮箱格式不正确';
    console.log(`[${timestamp}] ❌ 注册失败: ${errorMsg}`);
    return res.status(400).json({
      success: false,
      message: errorMsg
    });
  }
  
  console.log(`[${timestamp}] 🔍 开始创建用户...`);
  
  User.create({ username, email, password }, (err, user) => {
    if (err) {
      console.error(`[${timestamp}] ❌ 注册失败:`, err.message);
      console.error(`[${timestamp}]   错误堆栈:`, err.stack);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    console.log(`[${timestamp}] ✅ 注册成功`);
    console.log(`[${timestamp}]   用户 ID: ${user.id}`);
    console.log(`[${timestamp}]   用户名: ${user.username}`);
    console.log(`[${timestamp}]   邮箱: ${user.email}`);
    
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
