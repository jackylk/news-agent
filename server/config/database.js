const { Pool } = require('pg');

// 从环境变量获取数据库连接信息
// 支持 Neon、Railway PostgreSQL 或其他 PostgreSQL 服务
// 优先使用 DATABASE_URL（Neon 和 Railway 都会提供）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果没有DATABASE_URL，尝试从单独的环境变量构建
  ...(process.env.DATABASE_URL ? {} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'news_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  }),
  // SSL 配置：Neon 和 Railway 都需要 SSL
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // 连接池配置：针对 Neon Serverless 优化
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时
  connectionTimeoutMillis: 10000, // 连接超时
});

// 测试连接并初始化数据库
pool.query('SELECT NOW()')
  .then(() => {
    console.log('已连接到 PostgreSQL 数据库');
    return initDatabase();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
  });

// 初始化数据库表
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        source TEXT,
        url TEXT UNIQUE,
        image_url TEXT,
        publish_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引以提高查询性能
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publish_date ON news(publish_date DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_url ON news(url)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_source ON news(source)
    `);

    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('初始化数据库表失败:', err);
  } finally {
    client.release();
  }
}

// 封装pool.query为Promise，保持与SQLite类似的API
const db = {
  query: (text, params) => pool.query(text, params),
  // 为了兼容性，提供类似SQLite的接口（如果还有地方使用）
  run: (text, params, callback) => {
    pool.query(text, params)
      .then(result => {
        // 模拟SQLite的this.lastID
        const lastID = result.rows[0]?.id || null;
        callback(null, { lastID, changes: result.rowCount });
      })
      .catch(err => callback(err, null));
  },
  get: (text, params, callback) => {
    pool.query(text, params)
      .then(result => callback(null, result.rows[0] || null))
      .catch(err => callback(err, null));
  },
  all: (text, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    pool.query(text, params || [])
      .then(result => callback(null, result.rows))
      .catch(err => callback(err, null));
  },
  close: (callback) => {
    pool.end()
      .then(() => callback && callback(null))
      .catch(err => callback && callback(err));
  }
};

module.exports = db;
