const { Pool } = require('pg');

// 从环境变量获取数据库连接信息
// 支持 Neon、Railway PostgreSQL 或其他 PostgreSQL 服务
// 优先使用 DATABASE_URL（Neon 和 Railway 都会提供）

// 检查 DATABASE_URL 是否设置
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  警告: DATABASE_URL 环境变量未设置');
  console.warn('   在 Railway 上部署时，请确保：');
  console.warn('   1. 如果使用 Neon: 在 Railway 项目设置中添加 DATABASE_URL 环境变量');
  console.warn('   2. 如果使用 Railway PostgreSQL: 在项目中添加 PostgreSQL 服务');
  console.warn('   当前将尝试使用本地数据库配置（仅适用于本地开发）');
}

// 构建连接配置
let poolConfig;

if (process.env.DATABASE_URL) {
  // 使用 DATABASE_URL（推荐，适用于 Neon 和 Railway PostgreSQL）
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon 和 Railway 都需要 SSL
    // 连接池配置：针对 Neon Serverless 优化
    max: 20, // 最大连接数
    idleTimeoutMillis: 30000, // 空闲连接超时
    connectionTimeoutMillis: 10000, // 连接超时
  };
  console.log('📦 使用 DATABASE_URL 连接数据库');
} else {
  // 本地开发：使用单独的环境变量
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'news_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  console.log('📦 使用本地数据库配置');
}

const pool = new Pool(poolConfig);

// 测试连接并初始化数据库
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ 已连接到 PostgreSQL 数据库');
    return initDatabase();
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
    if (!process.env.DATABASE_URL) {
      console.error('');
      console.error('💡 解决方案：');
      console.error('   1. 如果使用 Neon:');
      console.error('      - 在 https://neon.tech 创建数据库');
      console.error('      - 在 Railway 项目设置中添加 DATABASE_URL 环境变量');
      console.error('   2. 如果使用 Railway PostgreSQL:');
      console.error('      - 在 Railway 项目中点击 "New" → "Database" → "Add PostgreSQL"');
      console.error('      - Railway 会自动设置 DATABASE_URL');
    } else {
      console.error('');
      console.error('💡 请检查 DATABASE_URL 是否正确：');
      console.error('   - 连接字符串格式是否正确');
      console.error('   - 数据库服务是否正常运行');
      console.error('   - 网络连接是否正常');
    }
    // 不退出进程，让应用继续运行（可能只是数据库暂时不可用）
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
