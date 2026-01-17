const db = require('../config/database');

class NitterInstance {
  // 创建Nitter实例
  static create(instanceData, callback) {
    const { url, name, priority = 0, is_active = true } = instanceData;
    
    if (!url || !url.trim()) {
      return callback(new Error('URL不能为空'), null);
    }

    // 确保URL格式正确（添加https://如果缺失）
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    // 移除末尾的斜杠
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    const sql = `
      INSERT INTO nitter_instances (url, name, priority, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    db.query(sql, [normalizedUrl, name || null, priority, is_active])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取所有Nitter实例
  static getAll(callback) {
    const sql = `
      SELECT * FROM nitter_instances
      ORDER BY priority DESC, created_at DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 获取所有激活的Nitter实例（按优先级排序）
  static getActive(callback) {
    const sql = `
      SELECT * FROM nitter_instances
      WHERE is_active = TRUE
      ORDER BY priority DESC, created_at DESC
    `;
    
    db.query(sql, [])
      .then(result => {
        callback(null, result.rows);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 根据ID获取Nitter实例
  static getById(id, callback) {
    const sql = `SELECT * FROM nitter_instances WHERE id = $1`;
    
    db.query(sql, [id])
      .then(result => {
        callback(null, result.rows[0] || null);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 更新Nitter实例
  static update(id, instanceData, callback) {
    const { url, name, priority, is_active, status, error_message } = instanceData;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (url !== undefined) {
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      normalizedUrl = normalizedUrl.replace(/\/$/, '');
      updates.push(`url = $${paramIndex++}`);
      params.push(normalizedUrl);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (error_message !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(error_message);
    }

    if (updates.length === 0) {
      return callback(new Error('没有要更新的字段'), null);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE nitter_instances
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    db.query(sql, params)
      .then(result => {
        if (result.rows.length === 0) {
          return callback(new Error('Nitter实例不存在'), null);
        }
        callback(null, result.rows[0]);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 删除Nitter实例
  static delete(id, callback) {
    const sql = `DELETE FROM nitter_instances WHERE id = $1 RETURNING *`;
    
    db.query(sql, [id])
      .then(result => {
        if (result.rows.length === 0) {
          return callback(new Error('Nitter实例不存在'), null);
        }
        callback(null, result.rows[0]);
      })
      .catch(err => {
        callback(err, null);
      });
  }

  // 测试Nitter实例（检查是否可用）
  static testInstance(url, callback) {
    const axios = require('axios');
    const testUrl = url.replace(/\/$/, '') + '/OpenAI/rss'; // 使用OpenAI作为测试用户
    
    axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: (status) => status < 500 // 接受2xx, 3xx, 4xx状态码
    })
      .then(response => {
        if (response.status === 200 && response.data.includes('<rss')) {
          callback(null, { available: true, status: 'ok' });
        } else {
          callback(null, { available: false, status: 'error', message: `HTTP ${response.status}` });
        }
      })
      .catch(err => {
        callback(null, { 
          available: false, 
          status: 'error', 
          message: err.message || '连接失败' 
        });
      });
  }

  // 更新实例状态
  static updateStatus(id, status, error_message = null, callback) {
    const sql = `
      UPDATE nitter_instances
      SET status = $1, error_message = $2, last_checked = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    db.query(sql, [status, error_message, id])
      .then(result => {
        callback(null, result.rows[0]);
      })
      .catch(err => {
        callback(err, null);
      });
  }
}

module.exports = NitterInstance;
