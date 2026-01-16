const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

class User {
  // 创建用户（注册）
  static create(userData, callback) {
    const timestamp = new Date().toISOString();
    const { username, email, password } = userData;
    
    console.log(`[${timestamp}] [User.create] 开始创建用户: ${username}`);
    
    // 验证输入
    if (!username || !email || !password) {
      const error = new Error('用户名、邮箱和密码都是必填项');
      console.error(`[${timestamp}] [User.create] ❌ 验证失败: ${error.message}`);
      return callback(error, null);
    }
    
    if (password.length < 6) {
      const error = new Error('密码长度至少6位');
      console.error(`[${timestamp}] [User.create] ❌ 验证失败: ${error.message}`);
      return callback(error, null);
    }
    
    console.log(`[${timestamp}] [User.create] 🔍 检查用户名和邮箱是否已存在...`);
    
    // 检查用户名和邮箱是否已存在
    db.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email])
      .then(result => {
        if (result.rows.length > 0) {
          const error = new Error('用户名或邮箱已存在');
          console.error(`[${timestamp}] [User.create] ❌ 用户已存在: ${username} 或 ${email}`);
          return callback(error, null);
        }
        
        console.log(`[${timestamp}] [User.create] 🔐 开始加密密码...`);
        
        // 加密密码
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
            console.error(`[${timestamp}] [User.create] ❌ 密码加密失败:`, err.message);
            return callback(err, null);
          }
          
          console.log(`[${timestamp}] [User.create] 💾 开始插入用户到数据库...`);
          
          // 插入用户
          const sql = `
            INSERT INTO users (username, email, password_hash, is_admin)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, is_admin, created_at
          `;
          
          db.query(sql, [username, email, hash, false])
            .then(result => {
              const user = result.rows[0];
              console.log(`[${timestamp}] [User.create] ✅ 用户创建成功: ID=${user.id}, username=${user.username}`);
              callback(null, {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: user.is_admin
              });
            })
            .catch(err => {
              console.error(`[${timestamp}] [User.create] ❌ 数据库插入失败:`, err.message);
              console.error(`[${timestamp}] [User.create]   错误堆栈:`, err.stack);
              callback(err, null);
            });
        });
      })
      .catch(err => {
        console.error(`[${timestamp}] [User.create] ❌ 数据库查询失败:`, err.message);
        console.error(`[${timestamp}] [User.create]   错误堆栈:`, err.stack);
        callback(err, null);
      });
  }
  
  // 用户登录
  static login(credentials, callback) {
    const { username, password } = credentials;
    
    if (!username || !password) {
      return callback(new Error('用户名和密码都是必填项'), null);
    }
    
    // 查找用户（支持用户名或邮箱登录）
    const sql = 'SELECT * FROM users WHERE username = $1 OR email = $1';
    db.query(sql, [username])
      .then(result => {
        if (result.rows.length === 0) {
          return callback(new Error('用户名或密码错误'), null);
        }
        
        const user = result.rows[0];
        
        // 验证密码
        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
          if (err) {
            return callback(err, null);
          }
          
          if (!isMatch) {
            return callback(new Error('用户名或密码错误'), null);
          }
          
          // 生成 JWT token
          const token = jwt.sign(
            {
              id: user.id,
              username: user.username,
              email: user.email,
              isAdmin: user.is_admin
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          
          callback(null, {
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              isAdmin: user.is_admin
            }
          });
        });
      })
      .catch(err => callback(err, null));
  }
  
  // 根据 ID 获取用户
  static getById(userId, callback) {
    const sql = 'SELECT id, username, email, is_admin, created_at FROM users WHERE id = $1';
    db.query(sql, [userId])
      .then(result => {
        if (result.rows.length === 0) {
          return callback(new Error('用户不存在'), null);
        }
        callback(null, result.rows[0]);
      })
      .catch(err => callback(err, null));
  }
  
  // 获取所有用户（管理员）
  static getAll(callback) {
    const sql = `
      SELECT 
        id, 
        username, 
        email, 
        is_admin, 
        created_at,
        (SELECT COUNT(*) FROM user_topics WHERE user_id = users.id) as topic_count,
        (SELECT COUNT(*) FROM user_subscriptions WHERE user_id = users.id) as subscription_count
      FROM users
      ORDER BY created_at DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => callback(err, null));
  }
  
  // 验证 JWT token
  static verifyToken(token, callback) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return callback(new Error('无效的token'), null);
      }
      callback(null, decoded);
    });
  }
  
  // 添加用户主题
  static addTopic(userId, keywords, callback) {
    const sql = `
      INSERT INTO user_topics (user_id, topic_keywords)
      VALUES ($1, $2)
      ON CONFLICT (user_id, topic_keywords) DO NOTHING
      RETURNING id
    `;
    
    db.query(sql, [userId, keywords])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => callback(err, null));
  }
  
  // 获取用户主题列表
  static getTopics(userId, callback) {
    const sql = 'SELECT * FROM user_topics WHERE user_id = $1 ORDER BY created_at DESC';
    db.query(sql, [userId])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => callback(err, null));
  }

  // 获取所有用户的主题列表（管理员用）
  static getAllTopics(callback) {
    const sql = `
      SELECT 
        ut.id,
        ut.user_id,
        ut.topic_keywords,
        ut.created_at,
        u.username,
        u.email,
        (SELECT COUNT(*) FROM news WHERE user_id = ut.user_id) as article_count
      FROM user_topics ut
      JOIN users u ON ut.user_id = u.id
      ORDER BY ut.created_at DESC
    `;
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => callback(err, null));
  }
  
  // 删除用户主题
  static removeTopic(userId, keywords, callback) {
    let deletedSubscriptionCount = 0;
    
    // 1. 先获取该主题的推荐历史，找出推荐的信息源
    const getHistorySql = 'SELECT recommended_sources FROM recommendation_history WHERE user_id = $1 AND topic_keywords = $2';
    db.query(getHistorySql, [userId, keywords])
      .then(result => {
        if (result.rows.length === 0) {
          // 没有推荐历史，直接删除主题
          return Promise.resolve([]);
        }
        
        const history = result.rows[0];
        let recommendedSources = [];
        
        // 解析推荐信息源
        if (history.recommended_sources) {
          if (typeof history.recommended_sources === 'string') {
            recommendedSources = JSON.parse(history.recommended_sources);
          } else {
            recommendedSources = history.recommended_sources;
          }
        }
        
        // 获取推荐信息源的名称列表
        const sourceNames = recommendedSources.map(s => s.sourceName || s.name).filter(Boolean);
        
        if (sourceNames.length === 0) {
          return Promise.resolve([]);
        }
        
        // 2. 检查这些信息源是否还属于其他主题
        // 获取该用户所有其他主题的推荐历史
        const getOtherHistoriesSql = `
          SELECT recommended_sources 
          FROM recommendation_history 
          WHERE user_id = $1 AND topic_keywords != $2
        `;
        return db.query(getOtherHistoriesSql, [userId, keywords])
          .then(otherHistories => {
            // 收集所有其他主题推荐的信息源名称
            const otherTopicSourceNames = new Set();
            otherHistories.rows.forEach(row => {
              if (row.recommended_sources) {
                let sources = [];
                if (typeof row.recommended_sources === 'string') {
                  sources = JSON.parse(row.recommended_sources);
                } else {
                  sources = row.recommended_sources;
                }
                sources.forEach(s => {
                  const name = s.sourceName || s.name;
                  if (name) {
                    otherTopicSourceNames.add(name);
                  }
                });
              }
            });
            
            // 找出只属于当前主题的信息源（不在其他主题中）
            const sourcesToDelete = sourceNames.filter(name => !otherTopicSourceNames.has(name));
            
            // 3. 删除这些只属于当前主题的订阅
            if (sourcesToDelete.length > 0) {
              const placeholders = sourcesToDelete.map((_, i) => `$${i + 3}`).join(', ');
              const deleteSubscriptionsSql = `
                DELETE FROM user_subscriptions 
                WHERE user_id = $1 AND source_name IN (${placeholders})
              `;
              return db.query(deleteSubscriptionsSql, [userId, ...sourcesToDelete])
                .then(deleteResult => {
                  deletedSubscriptionCount = deleteResult.rowCount;
                  return sourcesToDelete;
                });
            }
            
            return Promise.resolve([]);
          });
      })
      .then(() => {
        // 4. 删除推荐历史
        const deleteHistorySql = 'DELETE FROM recommendation_history WHERE user_id = $1 AND topic_keywords = $2';
        return db.query(deleteHistorySql, [userId, keywords]);
      })
      .then(() => {
        // 5. 删除主题
        const sql = 'DELETE FROM user_topics WHERE user_id = $1 AND topic_keywords = $2';
        return db.query(sql, [userId, keywords]);
      })
      .then(result => {
        callback(null, { 
          deleted: result.rowCount > 0,
          deletedSubscriptionCount: deletedSubscriptionCount
        });
      })
      .catch(err => callback(err, null));
  }

  // 删除用户主题（管理员用，可选择是否删除相关文章）
  static removeTopicByAdmin(userId, keywords, deleteArticles, callback) {
    let deletedSubscriptionCount = 0;
    let articleCount = 0;
    
    // 1. 先获取要删除的文章数量（如果选择删除文章）
    const getArticleCountPromise = deleteArticles 
      ? db.query('SELECT COUNT(*) as count FROM news WHERE user_id = $1', [userId])
          .then(result => {
            articleCount = parseInt(result.rows[0].count) || 0;
          })
      : Promise.resolve();
    
    getArticleCountPromise
      .then(() => {
        // 2. 如果选择删除文章，先删除该用户的所有文章
        if (deleteArticles && articleCount > 0) {
          return db.query('DELETE FROM news WHERE user_id = $1', [userId]);
        }
        return Promise.resolve({ rowCount: 0 });
      })
      .then(() => {
        // 3. 获取该主题的推荐历史，找出推荐的信息源
        const getHistorySql = 'SELECT recommended_sources FROM recommendation_history WHERE user_id = $1 AND topic_keywords = $2';
        return db.query(getHistorySql, [userId, keywords]);
      })
      .then(result => {
        if (result.rows.length === 0) {
          // 没有推荐历史，直接删除主题
          return Promise.resolve([]);
        }
        
        const history = result.rows[0];
        let recommendedSources = [];
        
        // 解析推荐信息源
        if (history.recommended_sources) {
          if (typeof history.recommended_sources === 'string') {
            recommendedSources = JSON.parse(history.recommended_sources);
          } else {
            recommendedSources = history.recommended_sources;
          }
        }
        
        // 获取推荐信息源的名称列表
        const sourceNames = recommendedSources.map(s => s.sourceName || s.name).filter(Boolean);
        
        if (sourceNames.length === 0) {
          return Promise.resolve([]);
        }
        
        // 4. 检查这些信息源是否还属于其他主题
        // 获取该用户所有其他主题的推荐历史
        const getOtherHistoriesSql = `
          SELECT recommended_sources 
          FROM recommendation_history 
          WHERE user_id = $1 AND topic_keywords != $2
        `;
        return db.query(getOtherHistoriesSql, [userId, keywords])
          .then(otherHistories => {
            // 收集所有其他主题推荐的信息源名称
            const otherTopicSourceNames = new Set();
            otherHistories.rows.forEach(row => {
              if (row.recommended_sources) {
                let sources = [];
                if (typeof row.recommended_sources === 'string') {
                  sources = JSON.parse(row.recommended_sources);
                } else {
                  sources = row.recommended_sources;
                }
                sources.forEach(s => {
                  const name = s.sourceName || s.name;
                  if (name) {
                    otherTopicSourceNames.add(name);
                  }
                });
              }
            });
            
            // 找出只属于当前主题的信息源（不在其他主题中）
            const sourcesToDelete = sourceNames.filter(name => !otherTopicSourceNames.has(name));
            
            // 5. 删除这些只属于当前主题的订阅
            if (sourcesToDelete.length > 0) {
              const placeholders = sourcesToDelete.map((_, i) => `$${i + 3}`).join(', ');
              const deleteSubscriptionsSql = `
                DELETE FROM user_subscriptions 
                WHERE user_id = $1 AND source_name IN (${placeholders})
              `;
              return db.query(deleteSubscriptionsSql, [userId, ...sourcesToDelete])
                .then(deleteResult => {
                  deletedSubscriptionCount = deleteResult.rowCount;
                  return sourcesToDelete;
                });
            }
            
            return Promise.resolve([]);
          });
      })
      .then(() => {
        // 6. 删除推荐历史
        const deleteHistorySql = 'DELETE FROM recommendation_history WHERE user_id = $1 AND topic_keywords = $2';
        return db.query(deleteHistorySql, [userId, keywords]);
      })
      .then(() => {
        // 7. 删除主题
        const sql = 'DELETE FROM user_topics WHERE user_id = $1 AND topic_keywords = $2';
        return db.query(sql, [userId, keywords]);
      })
      .then(result => {
        callback(null, { 
          deleted: result.rowCount > 0,
          deletedArticleCount: deleteArticles ? articleCount : 0,
          deletedSubscriptionCount: deletedSubscriptionCount
        });
      })
      .catch(err => callback(err, null));
  }
  
  // 添加用户订阅
  static addSubscription(userId, subscription, callback) {
    const { sourceName, sourceUrl, sourceType, category } = subscription;
    const sql = `
      INSERT INTO user_subscriptions (user_id, source_name, source_url, source_type, category)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, source_name) DO NOTHING
      RETURNING id
    `;
    
    db.query(sql, [userId, sourceName, sourceUrl, sourceType, category || null])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => callback(err, null));
  }
  
  // 批量添加用户订阅
  static addSubscriptions(userId, subscriptions, callback) {
    if (!subscriptions || subscriptions.length === 0) {
      return callback(null, []);
    }
    
    const values = subscriptions.map(sub => 
      `(${userId}, '${sub.sourceName.replace(/'/g, "''")}', '${sub.sourceUrl.replace(/'/g, "''")}', '${sub.sourceType}', ${sub.category ? `'${sub.category.replace(/'/g, "''")}'` : 'NULL'})`
    ).join(',');
    
    const sql = `
      INSERT INTO user_subscriptions (user_id, source_name, source_url, source_type, category)
      VALUES ${values}
      ON CONFLICT (user_id, source_name) DO NOTHING
      RETURNING id, source_name
    `;
    
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        // 如果批量插入失败，尝试逐个插入
        let successCount = 0;
        let errors = [];
        
        const insertPromises = subscriptions.map(sub => {
          return new Promise((resolve) => {
            User.addSubscription(userId, sub, (err, result) => {
              if (err) {
                errors.push(err.message);
              } else {
                successCount++;
              }
              resolve();
            });
          });
        });
        
        Promise.all(insertPromises).then(() => {
          callback(null, { successCount, errors });
        });
      });
  }
  
  // 获取用户订阅列表
  static getSubscriptions(userId, callback) {
    const sql = 'SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC';
    db.query(sql, [userId])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => callback(err, null));
  }
  
  // 获取所有用户的订阅列表（管理员用）
  static getAllSubscriptions(callback) {
    const sql = `
      SELECT 
        us.id, us.user_id, us.source_name, us.source_url, us.source_type, us.category, us.created_at,
        u.username, u.email
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      ORDER BY us.created_at DESC
    `;
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => callback(err, null));
  }
  
  // 删除用户订阅
  static removeSubscription(userId, sourceName, callback) {
    const sql = 'DELETE FROM user_subscriptions WHERE user_id = $1 AND source_name = $2';
    db.query(sql, [userId, sourceName])
      .then(result => {
        callback(null, { deleted: result.rowCount > 0 });
      })
      .catch(err => callback(err, null));
  }
  
  // 删除用户订阅（管理员用，可以指定用户ID）
  static removeSubscriptionByAdmin(userId, sourceName, callback) {
    const sql = 'DELETE FROM user_subscriptions WHERE user_id = $1 AND source_name = $2';
    db.query(sql, [userId, sourceName])
      .then(result => {
        callback(null, { deleted: result.rowCount > 0 });
      })
      .catch(err => callback(err, null));
  }

  // 保存推荐历史
  static saveRecommendationHistory(userId, topicKeywords, processLogs, recommendedSources, callback) {
    const sql = `
      INSERT INTO recommendation_history (user_id, topic_keywords, process_logs, recommended_sources)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, topic_keywords) 
      DO UPDATE SET 
        process_logs = EXCLUDED.process_logs,
        recommended_sources = EXCLUDED.recommended_sources,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, created_at, updated_at
    `;
    
    db.query(sql, [
      userId, 
      topicKeywords, 
      JSON.stringify(processLogs), 
      JSON.stringify(recommendedSources)
    ])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => callback(err, null));
  }

  // 获取用户最新的推荐历史
  static getLatestRecommendationHistory(userId, callback) {
    const sql = `
      SELECT id, topic_keywords, process_logs, recommended_sources, created_at, updated_at
      FROM recommendation_history
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    
    db.query(sql, [userId])
      .then(result => {
        if (result.rows.length > 0) {
          const history = result.rows[0];
          // 解析 JSON 字段
          history.process_logs = typeof history.process_logs === 'string' 
            ? JSON.parse(history.process_logs) 
            : history.process_logs;
          history.recommended_sources = typeof history.recommended_sources === 'string'
            ? JSON.parse(history.recommended_sources)
            : history.recommended_sources;
          callback(null, history);
        } else {
          callback(null, null);
        }
      })
      .catch(err => callback(err, null));
  }

  // 获取用户所有主题的推荐历史
  static getAllRecommendationHistory(userId, callback) {
    const sql = `
      SELECT id, topic_keywords, process_logs, recommended_sources, created_at, updated_at
      FROM recommendation_history
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;
    
    db.query(sql, [userId])
      .then(result => {
        const histories = result.rows.map(row => {
          // 解析 JSON 字段
          row.process_logs = typeof row.process_logs === 'string' 
            ? JSON.parse(row.process_logs) 
            : row.process_logs;
          row.recommended_sources = typeof row.recommended_sources === 'string'
            ? JSON.parse(row.recommended_sources)
            : row.recommended_sources;
          return row;
        });
        callback(null, histories);
      })
      .catch(err => callback(err, null));
  }

  // 根据主题关键词获取推荐历史
  static getRecommendationHistoryByTopic(userId, topicKeywords, callback) {
    const sql = `
      SELECT id, topic_keywords, process_logs, recommended_sources, created_at, updated_at
      FROM recommendation_history
      WHERE user_id = $1 AND topic_keywords = $2
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    
    db.query(sql, [userId, topicKeywords])
      .then(result => {
        if (result.rows.length > 0) {
          const history = result.rows[0];
          // 解析 JSON 字段
          history.process_logs = typeof history.process_logs === 'string' 
            ? JSON.parse(history.process_logs) 
            : history.process_logs;
          history.recommended_sources = typeof history.recommended_sources === 'string'
            ? JSON.parse(history.recommended_sources)
            : history.recommended_sources;
          callback(null, history);
        } else {
          callback(null, null);
        }
      })
      .catch(err => callback(err, null));
  }
}

module.exports = User;
