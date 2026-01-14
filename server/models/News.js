const db = require('../config/database');

// 辅助函数：确保日期正确序列化
function serializeDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  if (typeof dateValue === 'string') {
    return dateValue;
  }
  return null;
}

class News {
  // 插入新闻
  static create(newsData, callback) {
    const { title, content, summary, source, url, image_url, publish_date } = newsData;
    const sql = `
      INSERT INTO news (title, content, summary, source, url, image_url, publish_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    db.query(sql, [title, content, summary, source, url, image_url, publish_date])
      .then(result => {
        callback(null, { id: result.rows[0].id, ...newsData });
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 检查新闻是否已存在（通过URL）
  static exists(url, callback) {
    const sql = `SELECT id FROM news WHERE url = $1`;
    db.query(sql, [url])
      .then(result => {
        callback(null, result.rows.length > 0);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取新闻列表（按日期分组）
  static getListByDate(callback) {
    const sql = `
      SELECT 
        DATE(publish_date) as date,
        id,
        title,
        summary,
        source,
        image_url,
        publish_date
      FROM news
      ORDER BY publish_date DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        // 按日期分组
        const grouped = {};
        result.rows.forEach(row => {
          const date = row.date ? (row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date.split('T')[0]) : null;
          if (!date) return;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: serializeDate(row.publish_date)
          });
        });
        
        // 转换为数组格式，按日期排序
        const resultArray = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, resultArray);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 根据ID获取新闻详情
  static getById(id, callback) {
    const sql = `SELECT * FROM news WHERE id = $1`;
    db.query(sql, [id])
      .then(result => {
        if (!result.rows[0]) {
          callback(null, null);
          return;
        }
        const news = result.rows[0];
        // 确保日期正确序列化
        if (news.publish_date) {
          news.publish_date = serializeDate(news.publish_date);
        }
        if (news.created_at) {
          news.created_at = serializeDate(news.created_at);
        }
        callback(null, news);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取今天的新闻
  static getTodayNews(callback) {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
      SELECT * FROM news 
      WHERE DATE(publish_date) = $1
      ORDER BY publish_date DESC
    `;
    db.query(sql, [today])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 搜索新闻
  static search(keyword, callback) {
    // PostgreSQL使用ILIKE进行不区分大小写的搜索，或使用POSITION函数
    // 使用ILIKE '%keyword%' 对中文支持更好
    const searchPattern = `%${keyword}%`;
    const sql = `
      SELECT 
        DATE(publish_date) as date,
        id,
        title,
        summary,
        source,
        image_url,
        publish_date
      FROM news
      WHERE title ILIKE $1
         OR content ILIKE $1
         OR summary ILIKE $1
         OR source ILIKE $1
      ORDER BY publish_date DESC
      LIMIT 100
    `;
    
    db.query(sql, [searchPattern])
      .then(result => {
        // 按日期分组
        const grouped = {};
        result.rows.forEach(row => {
          const date = row.date ? (row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date.split('T')[0]) : null;
          if (!date) return;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: serializeDate(row.publish_date)
          });
        });
        
        // 转换为数组格式，按日期排序
        const resultArray = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, resultArray);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 按新闻源获取新闻列表
  static getListBySource(source, callback) {
    // PostgreSQL的TRIM函数同样支持
    const sql = `
      SELECT 
        DATE(publish_date) as date,
        id,
        title,
        summary,
        source,
        image_url,
        publish_date
      FROM news
      WHERE TRIM(source) = TRIM($1)
      ORDER BY publish_date DESC
    `;
    
    db.query(sql, [source])
      .then(result => {
        // 按日期分组
        const grouped = {};
        result.rows.forEach(row => {
          const date = row.date ? (row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date.split('T')[0]) : null;
          if (!date) return;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: serializeDate(row.publish_date)
          });
        });
        
        // 转换为数组格式，按日期排序
        const resultArray = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, resultArray);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取所有新闻源列表
  static getSources(callback) {
    const sql = `
      SELECT DISTINCT source, COUNT(*) as count
      FROM news
      GROUP BY source
      ORDER BY count DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err, null);
      });
  }
}

module.exports = News;
