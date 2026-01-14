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
    const { title, content, summary, source, category, url, image_url, publish_date } = newsData;
    const sql = `
      INSERT INTO news (title, content, summary, source, category, url, image_url, publish_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    db.query(sql, [title, content, summary, source, category || '科技', url, image_url, publish_date])
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
            category: row.category || '科技',
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
            category: row.category || '科技',
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
        category,
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
            category: row.category || '科技',
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

  // 获取所有分类列表
  static getCategories(callback) {
    const sql = `
      SELECT DISTINCT category, COUNT(*) as count
      FROM news
      WHERE category IS NOT NULL
      GROUP BY category
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

  // 按分类获取新闻列表
  static getListByCategory(category, callback) {
    const sql = `
      SELECT 
        DATE(publish_date) as date,
        id,
        title,
        summary,
        source,
        category,
        image_url,
        publish_date
      FROM news
      WHERE category = $1
      ORDER BY publish_date DESC
    `;
    
    db.query(sql, [category])
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
            category: row.category || '科技',
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

  // 获取最近X分钟内的新新闻数量
  static getRecentNewsCount(minutes, callback) {
    const sql = `
      SELECT COUNT(*) as count, MIN(created_at) as oldest_time
      FROM news
      WHERE created_at >= NOW() - INTERVAL '1 minute' * $1
    `;
    
    db.query(sql, [minutes])
      .then(result => {
        const count = parseInt(result.rows[0].count) || 0;
        const oldestTime = result.rows[0].oldest_time;
        callback(null, { count, oldestTime });
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取最近更新时间统计
  static getLastUpdateInfo(callback) {
    const sql = `
      SELECT 
        MAX(created_at) as last_update_time,
        COUNT(*) as total_count
      FROM news
    `;
    
    db.query(sql, [])
      .then(result => {
        const lastUpdateTime = result.rows[0].last_update_time;
        const totalCount = parseInt(result.rows[0].total_count) || 0;
        callback(null, { lastUpdateTime, totalCount });
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取新闻总数
  static getTotalCount(callback) {
    const sql = `SELECT COUNT(*) as count FROM news`;
    
    db.query(sql, [])
      .then(result => {
        const count = parseInt(result.rows[0].count) || 0;
        callback(null, count);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 删除最早的新闻（按 publish_date 排序，保留最新的 maxCount 条）
  static cleanupOldNews(maxCount, callback) {
    // 先获取当前总数
    this.getTotalCount((err, totalCount) => {
      if (err) {
        callback(err, null);
        return;
      }
      
      if (totalCount <= maxCount) {
        console.log(`新闻总数 ${totalCount} 未超过限制 ${maxCount}，无需清理`);
        callback(null, 0);
        return;
      }
      
      const deleteCount = totalCount - maxCount;
      
      // 获取需要删除的新闻ID列表（最早的 deleteCount 条）
      const selectSql = `
        SELECT id FROM news
        ORDER BY publish_date ASC, created_at ASC
        LIMIT $1
      `;
      
      db.query(selectSql, [deleteCount])
        .then(selectResult => {
          if (selectResult.rows.length === 0) {
            console.log('没有需要清理的旧新闻');
            callback(null, 0);
            return;
          }
          
          const idsToDelete = selectResult.rows.map(row => row.id);
          
          // 删除这些新闻
          const deleteSql = `DELETE FROM news WHERE id = ANY($1::int[])`;
          
          return db.query(deleteSql, [idsToDelete])
            .then(deleteResult => {
              const deletedCount = deleteResult.rowCount || 0;
              console.log(`已清理 ${deletedCount} 条旧新闻，保留最新的 ${maxCount} 条`);
              callback(null, deletedCount);
            });
        })
        .catch(err => {
          console.error('清理旧新闻失败:', err);
          callback(err, null);
        });
    });
  }

  // 自动清理：如果总数超过 maxCount，删除最早的新闻
  static autoCleanup(maxCount = 3000, callback) {
    this.getTotalCount((err, totalCount) => {
      if (err) {
        console.error('获取新闻总数失败:', err);
        if (callback) callback(err, null);
        return;
      }

      if (totalCount > maxCount) {
        const excessCount = totalCount - maxCount;
        console.log(`新闻总数 ${totalCount} 超过限制 ${maxCount}，需要清理 ${excessCount} 条旧新闻`);
        this.cleanupOldNews(maxCount, callback);
      } else {
        console.log(`新闻总数 ${totalCount}，未超过限制 ${maxCount}，无需清理`);
        if (callback) callback(null, 0);
      }
    });
  }
}

module.exports = News;
