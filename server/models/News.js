const db = require('../config/database');

class News {
  // 插入新闻
  static create(newsData, callback) {
    const { title, content, summary, source, url, image_url, publish_date } = newsData;
    const sql = `
      INSERT INTO news (title, content, summary, source, url, image_url, publish_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [title, content, summary, source, url, image_url, publish_date], function(err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, { id: this.lastID, ...newsData });
      }
    });
  }

  // 检查新闻是否已存在（通过URL）
  static exists(url, callback) {
    const sql = `SELECT id FROM news WHERE url = ?`;
    db.get(sql, [url], (err, row) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, !!row);
      }
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
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        // 按日期分组
        const grouped = {};
        rows.forEach(row => {
          const date = row.date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: row.publish_date
          });
        });
        
        // 转换为数组格式，按日期排序
        const result = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, result);
      }
    });
  }

  // 根据ID获取新闻详情
  static getById(id, callback) {
    const sql = `SELECT * FROM news WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, row);
      }
    });
  }

  // 获取今天的新闻
  static getTodayNews(callback) {
    const today = new Date().toISOString().split('T')[0];
    const sql = `
      SELECT * FROM news 
      WHERE DATE(publish_date) = ?
      ORDER BY publish_date DESC
    `;
    db.all(sql, [today], callback);
  }

  // 搜索新闻
  static search(keyword, callback) {
    // 使用instr()函数进行搜索，对中文支持更好
    // instr()返回子字符串的位置，如果找到返回>0，否则返回0
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
      WHERE instr(title, ?) > 0
         OR instr(content, ?) > 0
         OR instr(summary, ?) > 0
         OR instr(source, ?) > 0
      ORDER BY publish_date DESC
      LIMIT 100
    `;
    
    db.all(sql, [keyword, keyword, keyword, keyword], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        // 按日期分组
        const grouped = {};
        rows.forEach(row => {
          const date = row.date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: row.publish_date
          });
        });
        
        // 转换为数组格式，按日期排序
        const result = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, result);
      }
    });
  }

  // 按新闻源获取新闻列表
  static getListBySource(source, callback) {
    // 使用TRIM来匹配，避免空格问题
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
      WHERE TRIM(source) = TRIM(?)
      ORDER BY publish_date DESC
    `;
    
    db.all(sql, [source], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        // 按日期分组
        const grouped = {};
        rows.forEach(row => {
          const date = row.date;
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push({
            id: row.id,
            title: row.title,
            summary: row.summary,
            source: row.source,
            image_url: row.image_url,
            publish_date: row.publish_date
          });
        });
        
        // 转换为数组格式，按日期排序
        const result = Object.keys(grouped)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(date => ({
            date,
            news: grouped[date]
          }));
        
        callback(null, result);
      }
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
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, rows);
      }
    });
  }
}

module.exports = News;
