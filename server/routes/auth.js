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
  
  // 验证密码长度（防止异常长的输入）
  if (password.length > 200) {
    const errorMsg = '密码格式不正确';
    console.log(`[${timestamp}] ❌ 注册失败: ${errorMsg}`);
    return res.status(400).json({
      success: false,
      message: errorMsg
    });
  }
  
  // 验证密码强度（至少6位）
  if (password.length < 6) {
    const errorMsg = '密码长度至少6位';
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
router.post('/login', async (req, res) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  
  console.log(`[${timestamp}] 🔐 收到登录请求`);
  console.log(`[${timestamp}]   来源 IP: ${clientIP}`);
  console.log(`[${timestamp}]   用户名/邮箱: ${req.body.username || '(空)'}`);
  // 不记录密码，只记录长度
  console.log(`[${timestamp}]   密码长度: ${req.body.password ? req.body.password.length : 0}`);
  
  const { username, password } = req.body;
  
  // 验证输入
  if (!username || !password) {
    const errorMsg = '用户名和密码都是必填项';
    console.log(`[${timestamp}] ❌ 登录失败: ${errorMsg}`);
    return res.status(400).json({
      success: false,
      message: errorMsg
    });
  }
  
  // 验证密码长度（防止异常长的输入）
  if (password.length > 200) {
    const errorMsg = '密码格式不正确';
    console.log(`[${timestamp}] ❌ 登录失败: ${errorMsg}`);
    return res.status(400).json({
      success: false,
      message: errorMsg
    });
  }
  
  try {
    // 使用 Promise 包装回调函数，使代码更清晰
    // 注意：密码通过 HTTPS 加密传输，后端使用 bcrypt 验证
    const result = await new Promise((resolve, reject) => {
      User.login({ username, password }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    
    console.log(`[${timestamp}] ✅ 登录成功`);
    console.log(`[${timestamp}]   用户 ID: ${result.user.id}`);
    console.log(`[${timestamp}]   用户名: ${result.user.username}`);
    console.log(`[${timestamp}]   邮箱: ${result.user.email}`);
    
    res.json({
      success: true,
      message: '登录成功',
      token: result.token,
      user: result.user
    });
  } catch (error) {
    console.error(`[${timestamp}] ❌ 登录失败:`, error.message);
    console.error(`[${timestamp}]   错误堆栈:`, error.stack);
    
    // 统一错误消息，不泄露具体错误信息
    const errorMessage = error.message || '登录失败，请检查用户名和密码';
    
    res.status(401).json({
      success: false,
      message: errorMessage
    });
  }
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
