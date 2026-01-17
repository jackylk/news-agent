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
    const { title, content, summary, source, category, url, image_url, publish_date, user_id, topic_keywords, is_relevant_to_topic } = newsData;
    
    // 先尝试使用 ON CONFLICT（如果约束存在）
    const sql = `
      INSERT INTO news (title, content, summary, source, category, url, image_url, publish_date, user_id, topic_keywords, is_relevant_to_topic)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, topic_keywords, url) DO NOTHING
      RETURNING id
    `;
    
    db.query(sql, [title, content, summary, source, category || '科技', url, image_url, publish_date, user_id || null, topic_keywords || null, is_relevant_to_topic !== undefined ? is_relevant_to_topic : null])
      .then(result => {
        // 如果result.rows为空，说明是重复的文章，返回null但不报错
        if (result.rows.length === 0) {
          callback(null, null); // 返回null表示文章已存在，但不报错
        } else {
          callback(null, { id: result.rows[0].id, ...newsData });
        }
      })
      .catch(err => {
        // 如果错误是约束不存在，回退到先检查是否存在的方式
        if (err.message && err.message.includes('no unique or exclusion constraint')) {
          console.warn('⚠️ 唯一约束不存在，使用备用方法检查重复文章');
          // 使用备用方法：先检查是否存在
          News.exists(url, user_id, topic_keywords, (existsErr, exists) => {
            if (existsErr) {
              callback(existsErr, null);
            } else if (exists) {
              // 文章已存在，返回null
              callback(null, null);
            } else {
              // 文章不存在，直接插入（不使用ON CONFLICT）
              const insertSql = `
                INSERT INTO news (title, content, summary, source, category, url, image_url, publish_date, user_id, topic_keywords, is_relevant_to_topic)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
              `;
              
              db.query(insertSql, [title, content, summary, source, category || '科技', url, image_url, publish_date, user_id || null, topic_keywords || null, is_relevant_to_topic !== undefined ? is_relevant_to_topic : null])
                .then(insertResult => {
                  callback(null, { id: insertResult.rows[0].id, ...newsData });
                })
                .catch(insertErr => {
                  // 如果插入时还是遇到重复键错误，说明在检查和插入之间被其他进程插入了
                  if (insertErr.code === '23505' || insertErr.message.includes('duplicate key')) {
                    callback(null, null); // 视为已存在，不报错
                  } else {
                    callback(insertErr, null);
                  }
                });
            }
          });
        } else {
          // 其他错误，直接返回
          callback(err, null);
        }
      });
  }

  // 检查新闻是否已存在（通过URL、用户ID和主题关键词的组合）
  static exists(url, userId, topicKeywords, callback) {
    // 如果 callback 是第二个参数（旧调用方式），调整参数
    if (typeof userId === 'function') {
      callback = userId;
      userId = null;
      topicKeywords = null;
    } else if (typeof topicKeywords === 'function') {
      callback = topicKeywords;
      topicKeywords = null;
    }
    
    let sql = `SELECT id FROM news WHERE url = $1`;
    const params = [url];
    
    if (userId) {
      sql += ` AND user_id = $2`;
      params.push(userId);
      if (topicKeywords) {
        sql += ` AND topic_keywords = $3`;
        params.push(topicKeywords);
      } else {
        sql += ` AND topic_keywords IS NULL`;
      }
    } else {
      // 如果没有提供 userId，只检查 URL（向后兼容）
      sql += ` AND user_id IS NULL`;
    }
    
    db.query(sql, params)
      .then(result => {
        callback(null, result.rows.length > 0);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取新闻列表（按日期分组，支持按用户和主题过滤）
  static getListByDate(userId, topicKeywords = null, callback) {
    // 如果callback是第一个参数，说明是旧调用方式（无userId）
    if (typeof userId === 'function') {
      callback = userId;
      userId = null;
      topicKeywords = null;
    } else if (typeof topicKeywords === 'function') {
      callback = topicKeywords;
      topicKeywords = null;
    }
    
    let sql = `
      SELECT 
        DATE(publish_date) as date,
        id,
        title,
        summary,
        source,
        category,
        image_url,
        publish_date,
        topic_keywords,
        is_relevant_to_topic
      FROM news
    `;
    
    const params = [];
    const conditions = [];
    
    if (userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(userId);
      
      if (topicKeywords && topicKeywords.trim()) {
        conditions.push(`topic_keywords = $${params.length + 1}`);
        params.push(topicKeywords);
      }
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY publish_date DESC';
    
    db.query(sql, params)
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

  // 获取翻译缓存
  static getTranslationCache(id, callback) {
    const sql = `
      SELECT title_translated, summary_translated, content_translated
      FROM news
      WHERE id = $1
    `;
    
    db.query(sql, [id])
      .then(result => {
        if (result.rows.length > 0) {
          const row = result.rows[0];
          // 如果所有翻译字段都有值，返回缓存
          if (row.title_translated && row.content_translated) {
            callback(null, {
              titleTranslated: row.title_translated,
              summaryTranslated: row.summary_translated,
              contentTranslated: row.content_translated
            });
          } else {
            callback(null, null);
          }
        } else {
          callback(null, null);
        }
      })
      .catch(err => callback(err, null));
  }

  // 保存翻译缓存
  static saveTranslationCache(id, titleTranslated, summaryTranslated, contentTranslated, callback) {
    const sql = `
      UPDATE news
      SET title_translated = $2,
          summary_translated = $3,
          content_translated = $4
      WHERE id = $1
      RETURNING id
    `;
    
    db.query(sql, [id, titleTranslated || null, summaryTranslated || null, contentTranslated || null])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => callback(err, null));
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

  // 删除某个来源的所有新闻
  static deleteBySource(source, callback) {
    const sql = `DELETE FROM news WHERE TRIM(source) = TRIM($1)`;
    
    db.query(sql, [source])
      .then(result => {
        const deletedCount = result.rowCount || 0;
        console.log(`已删除来源 "${source}" 的 ${deletedCount} 条新闻`);
        callback(null, deletedCount);
      })
      .catch(err => {
        console.error('删除来源新闻失败:', err);
        callback(err, null);
      });
  }

  // 删除特定用户、信息源和主题的文章
  static deleteByUserSourceAndTopic(userId, sourceName, topicKeywords, callback) {
    let sql = `DELETE FROM news WHERE user_id = $1 AND TRIM(source) = TRIM($2)`;
    const params = [userId, sourceName];
    
    if (topicKeywords && topicKeywords.trim()) {
      sql += ' AND topic_keywords = $3';
      params.push(topicKeywords.trim());
    }
    
    db.query(sql, params)
      .then(result => {
        const deletedCount = result.rowCount || 0;
        console.log(`已删除用户 ${userId} 的信息源 "${sourceName}" (主题: "${topicKeywords || '全部'}") 的 ${deletedCount} 篇文章`);
        callback(null, deletedCount);
      })
      .catch(err => {
        console.error('删除用户信息源文章失败:', err);
        callback(err, null);
      });
  }

  // 获取来源的详细信息（包括新闻数量、最新更新时间等）
  static getSourceDetails(callback) {
    const sql = `
      SELECT 
        source,
        COUNT(*) as count,
        MAX(created_at) as last_updated,
        MIN(created_at) as first_added,
        MAX(publish_date) as latest_publish_date
      FROM news
      GROUP BY source
      ORDER BY count DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        const sources = result.rows.map(row => ({
          source: row.source,
          count: parseInt(row.count, 10),
          lastUpdated: serializeDate(row.last_updated),
          firstAdded: serializeDate(row.first_added),
          latestPublishDate: serializeDate(row.latest_publish_date)
        }));
        callback(null, sources);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取新闻列表（管理员用，支持分页和搜索）
  static getListForAdmin(page = 1, pageSize = 20, search = '', source = '', callback) {
    const offset = (page - 1) * pageSize;
    let sql = 'SELECT id, title, summary, source, category, url, image_url, publish_date, created_at, user_id FROM news WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search && search.trim()) {
      sql += ` AND (title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (source && source.trim()) {
      sql += ` AND TRIM(source) = TRIM($${paramIndex})`;
      params.push(source.trim());
      paramIndex++;
    }

    sql += ` ORDER BY publish_date DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as count FROM news WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (search && search.trim()) {
      countSql += ` AND (title ILIKE $${countParamIndex} OR summary ILIKE $${countParamIndex} OR content ILIKE $${countParamIndex})`;
      countParams.push(`%${search.trim()}%`);
      countParamIndex++;
    }

    if (source && source.trim()) {
      countSql += ` AND TRIM(source) = TRIM($${countParamIndex})`;
      countParams.push(source.trim());
      countParamIndex++;
    }

    Promise.all([
      db.query(sql, params),
      db.query(countSql, countParams)
    ])
      .then(([result, countResult]) => {
        const news = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          source: row.source,
          category: row.category,
          url: row.url,
          image_url: row.image_url,
          publish_date: serializeDate(row.publish_date),
          created_at: serializeDate(row.created_at),
          user_id: row.user_id
        }));
        const totalCount = parseInt(countResult.rows[0].count, 10);
        callback(null, {
          news,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize)
        });
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 删除单条新闻
  static deleteById(id, callback) {
    const sql = 'DELETE FROM news WHERE id = $1';
    db.query(sql, [id])
      .then(result => {
        callback(null, { deleted: result.rowCount > 0 });
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 批量删除新闻
  static deleteByIds(ids, callback) {
    if (!ids || ids.length === 0) {
      return callback(null, { deletedCount: 0 });
    }
    const sql = 'DELETE FROM news WHERE id = ANY($1::int[])';
    db.query(sql, [ids])
      .then(result => {
        callback(null, { deletedCount: result.rowCount || 0 });
      })
      .catch(err => {
        callback(err, null);
      });
  }
}

module.exports = News;
