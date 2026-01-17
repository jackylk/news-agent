const express = require('express');
const router = express.Router();
const News = require('../models/News');
const User = require('../models/User');

// 认证中间件（可选）
function optionalAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  
  if (token) {
    User.verifyToken(token, (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
}

// 获取新闻列表（按日期分组，支持按用户和主题过滤）
router.get('/list', optionalAuth, (req, res) => {
  const userId = req.user ? req.user.id : null;
  const topicKeywords = req.query.topicKeywords || null;
  
  News.getListByDate(userId, topicKeywords, (err, data) => {
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

// 获取所有分类列表（必须在/:id之前）
router.get('/categories', (req, res) => {
  News.getCategories((err, categories) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取分类列表失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: categories
    });
  });
});

// 按分类获取新闻列表（必须在/:id之前）
router.get('/category/:category', (req, res) => {
  const category = decodeURIComponent(req.params.category);
  
  News.getListByCategory(category, (err, data) => {
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
      category: category
    });
  });
});

// 获取最近X分钟内的新新闻数量
router.get('/recent/:minutes', (req, res) => {
  const minutes = parseInt(req.params.minutes) || 30;
  
  News.getRecentNewsCount(minutes, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取新新闻数量失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: result
    });
  });
});

// 获取最近更新时间统计
router.get('/update-info', (req, res) => {
  News.getLastUpdateInfo((err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '获取更新信息失败',
        error: err.message
      });
    }
    res.json({
      success: true,
      data: result
    });
  });
});

// 生成文章摘要（使用AI大模型）
router.post('/summarize', async (req, res) => {
  const { text } = req.body;
  
  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供要摘要的文本'
    });
  }

  try {
    // 限制文本长度
    const textToSummarize = text.substring(0, 4000);
    
    // 调用AI摘要服务
    const summary = await generateAISummary(textToSummarize);
    
    if (summary) {
      res.json({
        success: true,
        summary: summary
      });
    } else {
      res.status(500).json({
        success: false,
        message: '生成摘要失败'
      });
    }
  } catch (error) {
    console.error('生成摘要错误:', error);
    res.status(500).json({
      success: false,
      message: '生成摘要失败',
      error: error.message
    });
  }
});

// 翻译文章（使用 DeepSeek API，带缓存）
router.post('/translate', async (req, res) => {
  const { articleId, text, source = 'en', target = 'zh', field = 'content' } = req.body;
  
  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: '文本内容不能为空'
    });
  }
  
  // 如果有 articleId，先检查缓存
  if (articleId) {
    try {
      await new Promise((resolve, reject) => {
        News.getTranslationCache(articleId, (err, cache) => {
          if (err) {
            console.error('获取翻译缓存失败:', err);
            resolve(null);
            return;
          }
          
          if (cache) {
            // 根据字段返回对应的翻译
            let translatedText = null;
            if (field === 'title' && cache.titleTranslated) {
              translatedText = cache.titleTranslated;
            } else if (field === 'summary' && cache.summaryTranslated) {
              translatedText = cache.summaryTranslated;
            } else if (field === 'content' && cache.contentTranslated) {
              translatedText = cache.contentTranslated;
            }
            
            if (translatedText) {
              res.json({
                success: true,
                translatedText: translatedText,
                fromCache: true
              });
              reject(new Error('CACHE_HIT')); // 使用错误来中断后续流程
              return;
            }
          }
          resolve(null);
        });
      });
    } catch (err) {
      if (err.message === 'CACHE_HIT') {
        return; // 已返回缓存结果，直接返回
      }
    }
  }
  
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'DeepSeek API Key 未配置'
    });
  }
  
  try {
    const axios = require('axios');
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的翻译助手。请将用户提供的文本从${source === 'en' ? '英文' : '中文'}翻译为${target === 'zh' ? '中文' : '英文'}。只返回翻译结果，不要添加任何其他说明。`
        },
        {
          role: 'user',
          content: text.substring(0, 4000) // 限制长度
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      const translatedText = response.data.choices[0].message.content.trim();
      
      // 注意：单个字段的翻译不保存到缓存，只有整篇文章翻译才保存
      res.json({
        success: true,
        translatedText: translatedText,
        fromCache: false
      });
    } else {
      res.status(500).json({
        success: false,
        message: '翻译失败：API返回格式错误'
      });
    }
  } catch (error) {
    console.error('DeepSeek 翻译API错误:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: '翻译失败',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// 翻译整篇文章（标题、摘要、正文）
router.post('/translate/article', async (req, res) => {
  const { articleId, title, summary, content, source = 'en', target = 'zh' } = req.body;
  
  if (!articleId) {
    return res.status(400).json({
      success: false,
      message: '文章ID不能为空'
    });
  }
  
  // 先检查缓存
  try {
    await new Promise((resolve, reject) => {
      News.getTranslationCache(articleId, (err, cache) => {
        if (err) {
          console.error('获取翻译缓存失败:', err);
          resolve(null);
          return;
        }
        
        if (cache && cache.titleTranslated && cache.contentTranslated) {
          res.json({
            success: true,
            translatedTitle: cache.titleTranslated,
            translatedSummary: cache.summaryTranslated || null,
            translatedContent: cache.contentTranslated,
            fromCache: true
          });
          reject(new Error('CACHE_HIT'));
          return;
        }
        resolve(null);
      });
    });
  } catch (err) {
    if (err.message === 'CACHE_HIT') {
      return; // 已返回缓存结果
    }
  }
  
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'DeepSeek API Key 未配置'
    });
  }
  
  try {
    const axios = require('axios');
    const translatedResults = {};
    
    // 翻译标题
    if (title) {
      const titleResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的翻译助手。请将用户提供的文本从${source === 'en' ? '英文' : '中文'}翻译为${target === 'zh' ? '中文' : '英文'}。只返回翻译结果，不要添加任何其他说明。`
          },
          {
            role: 'user',
            content: title.substring(0, 500)
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (titleResponse.data && titleResponse.data.choices && titleResponse.data.choices[0]) {
        translatedResults.title = titleResponse.data.choices[0].message.content.trim();
      }
    }
    
    // 翻译摘要
    if (summary) {
      try {
        const summaryResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的翻译助手。请将用户提供的文本从${source === 'en' ? '英文' : '中文'}翻译为${target === 'zh' ? '中文' : '英文'}。只返回翻译结果，不要添加任何其他说明。`
            },
            {
              role: 'user',
              content: summary.substring(0, 2000)
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (summaryResponse.data && summaryResponse.data.choices && summaryResponse.data.choices[0]) {
          translatedResults.summary = summaryResponse.data.choices[0].message.content.trim();
        }
      } catch (e) {
        console.error('翻译摘要失败:', e);
      }
    }
    
    // 翻译正文
    if (content) {
      const contentResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的翻译助手。请将用户提供的文本从${source === 'en' ? '英文' : '中文'}翻译为${target === 'zh' ? '中文' : '英文'}。只返回翻译结果，不要添加任何其他说明。`
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (contentResponse.data && contentResponse.data.choices && contentResponse.data.choices[0]) {
        translatedResults.content = contentResponse.data.choices[0].message.content.trim();
      }
    }
    
    // 保存到缓存
    if (translatedResults.title && translatedResults.content) {
      News.saveTranslationCache(
        articleId,
        translatedResults.title,
        translatedResults.summary || null,
        translatedResults.content,
        (err) => {
          if (err) {
            console.error('保存翻译缓存失败:', err);
          }
        }
      );
    }
    
    res.json({
      success: true,
      translatedTitle: translatedResults.title || null,
      translatedSummary: translatedResults.summary || null,
      translatedContent: translatedResults.content || null,
      fromCache: false
    });
  } catch (error) {
    console.error('DeepSeek 翻译API错误:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: '翻译失败',
      error: error.response?.data?.error?.message || error.message
    });
  }
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

// AI摘要生成函数
async function generateAISummary(text) {
  // 方案1: 使用 DeepSeek API（优先）
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const axios = require('axios');
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文章摘要助手。请用简洁的中文总结以下文章的主要内容，摘要长度控制在100-150字。只返回摘要内容，不要添加其他说明。'
          },
          {
            role: 'user',
            content: `请为以下文章生成摘要：\n\n${text}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        const summary = response.data.choices[0].message.content.trim();
        console.log('DeepSeek API 摘要生成成功');
        return summary;
      }
    } catch (error) {
      console.error('DeepSeek API错误:', error.response?.data || error.message);
    }
  }
  
  // 方案2: 使用 OpenAI API（备选）
  if (process.env.OPENAI_API_KEY) {
    try {
      const axios = require('axios');
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文章摘要助手。请用简洁的中文总结以下文章的主要内容，摘要长度控制在100-150字。'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('OpenAI API错误:', error.message);
    }
  }
  
  // 方案3: 使用 Hugging Face Inference API（免费，但可能需要token）
  try {
    const axios = require('axios');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // 如果有Hugging Face token，添加认证
    if (process.env.HUGGINGFACE_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
    }
    
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      {
        inputs: text,
        parameters: {
          max_length: 150,
          min_length: 50,
          do_sample: false
        }
      },
      { headers }
    );
    
    if (response.data && response.data[0] && response.data[0].summary_text) {
      return response.data[0].summary_text;
    }
  } catch (error) {
    console.error('Hugging Face API错误:', error.message);
    // 如果是503错误（模型加载中），可以等待后重试
    if (error.response && error.response.status === 503) {
      console.log('模型正在加载，等待5秒后重试...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      // 可以在这里添加重试逻辑
    }
  }
  
  // 方案4: 使用简单的提取式摘要作为备选
  return generateSimpleSummary(text);
}

// 简单的提取式摘要（备选方案）
function generateSimpleSummary(text) {
  // 按段落分割
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  
  if (paragraphs.length === 0) return '';
  
  // 提取第一段的前几句
  if (paragraphs.length > 0) {
    const firstParagraph = paragraphs[0];
    const sentences = firstParagraph.split(/[.!?。！？]\s+/).filter(s => s.trim().length > 20);
    const summaryLength = Math.min(3, Math.ceil(sentences.length * 0.3));
    if (summaryLength > 0) {
      return sentences.slice(0, summaryLength).join('。') + '。';
    }
  }
  
  // 如果无法提取，返回前200字符
  return text.substring(0, 200) + '...';
}

module.exports = router;
