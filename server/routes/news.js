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
