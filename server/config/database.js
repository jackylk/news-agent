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
  // 检查是否是 Neon 数据库（通过检查连接字符串）
  const isNeon = process.env.DATABASE_URL.includes('neon.tech');
  let connectionString = process.env.DATABASE_URL;
  
  // 如果是 Neon 且没有使用 pooler，建议使用 pooler
  if (isNeon && !connectionString.includes('-pooler')) {
    console.warn('⚠️  检测到 Neon 数据库，建议使用 Connection Pooler');
    console.warn('   请在 Neon 控制台获取带 -pooler 的连接字符串');
    console.warn('   这样可以避免 Serverless 暂停导致的连接超时问题');
  }
  
  // 使用 DATABASE_URL（推荐，适用于 Neon 和 Railway PostgreSQL）
  poolConfig = {
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }, // Neon 和 Railway 都需要 SSL
    // 连接池配置：针对 Neon Serverless 优化
    max: isNeon ? 5 : 20, // Neon Serverless 建议使用更少的连接数
    min: 0, // 不保持最小连接数（Serverless 友好）
    idleTimeoutMillis: isNeon ? 10000 : 30000, // Neon 使用更短的空闲超时
    connectionTimeoutMillis: isNeon ? 30000 : 10000, // Neon 需要更长的连接超时（等待唤醒）
    // 添加 keep-alive 配置
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // 允许退出时关闭连接池
    allowExitOnIdle: false,
  };
  console.log('📦 使用 DATABASE_URL 连接数据库');
  if (isNeon) {
    console.log('   🚀 检测到 Neon Serverless 数据库，已优化连接池配置');
  }
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

// 处理连接池错误
pool.on('error', (err) => {
  console.error('❌ 数据库连接池错误:', err.message);
  console.error('   错误代码:', err.code);
  // 不退出进程，让应用继续运行
});

// 测试连接并初始化数据库（带重试机制，特别针对 Neon Serverless）
async function connectWithRetry(maxRetries = 3, delay = 5000) {
  const isNeon = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔌 尝试连接数据库 (${i + 1}/${maxRetries})...`);
      
      // 对于 Neon，首次连接可能需要等待数据库唤醒
      if (isNeon && i === 0) {
        console.log('   ⏳ Neon Serverless 数据库可能需要几秒钟唤醒...');
      }
      
      await pool.query('SELECT NOW()');
      console.log('✅ 已连接到 PostgreSQL 数据库');
      await initDatabase();
      return;
    } catch (err) {
      const errorMsg = err.message || '未知错误';
      const errorCode = err.code || 'UNKNOWN';
      
      console.error(`❌ 数据库连接失败 (尝试 ${i + 1}/${maxRetries}):`, errorMsg);
      console.error(`   错误代码: ${errorCode}`);
      
      // 如果是 Neon 的 ETIMEDOUT 错误，提供更具体的建议
      if (isNeon && (errorCode === 'ETIMEDOUT' || errorMsg.includes('ETIMEDOUT'))) {
        console.error('   💡 Neon Serverless 数据库可能处于暂停状态');
        console.error('   💡 建议：');
        console.error('      1. 使用 Neon Connection Pooler（连接字符串包含 -pooler）');
        console.error('      2. 在 Neon 控制台检查数据库状态');
        console.error('      3. 考虑使用 Railway PostgreSQL 作为替代方案');
      }
      
      if (i < maxRetries - 1) {
        const waitTime = isNeon ? delay * (i + 1) : delay; // Neon 需要更长的等待时间
        console.log(`⏳ ${waitTime / 1000} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // 最后一次尝试失败
        if (!process.env.DATABASE_URL) {
          console.error('');
          console.error('💡 解决方案：');
          console.error('   1. 如果使用 Neon:');
          console.error('      - 在 https://neon.tech 创建数据库');
          console.error('      - 在 Railway 项目设置中添加 DATABASE_URL 环境变量');
          console.error('      - 使用 Connection Pooler 连接字符串（包含 -pooler）');
          console.error('   2. 如果使用 Railway PostgreSQL:');
          console.error('      - 在 Railway 项目中点击 "New" → "Database" → "Add PostgreSQL"');
          console.error('      - Railway 会自动设置 DATABASE_URL');
        } else {
          console.error('');
          console.error('💡 请检查 DATABASE_URL 是否正确：');
          console.error('   - 连接字符串格式是否正确');
          console.error('   - 数据库服务是否正常运行');
          console.error('   - 网络连接是否正常');
          if (isNeon) {
            console.error('   - 如果使用 Neon，请使用 Connection Pooler 连接字符串');
            console.error('   - 在 Neon 控制台获取带 -pooler 的连接字符串');
          }
        }
        // 不退出进程，让应用继续运行（可能只是数据库暂时不可用）
      }
    }
  }
}

// 开始连接（带重试）
connectWithRetry();

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
        category TEXT,
        url TEXT NOT NULL,
        image_url TEXT,
        publish_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        topic_keywords TEXT,
        is_relevant_to_topic BOOLEAN,
        UNIQUE(user_id, topic_keywords, url)
      )
    `);
    
    // 如果表已存在但没有category字段，添加该字段
    try {
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS category TEXT
      `);
    } catch (err) {
      // 字段可能已存在，忽略错误
    }
    
    // 添加翻译缓存字段
    try {
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS title_translated TEXT
      `);
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS summary_translated TEXT
      `);
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS content_translated TEXT
      `);
    } catch (err) {
      // 字段可能已存在，忽略错误
    }

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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_category ON news(category)
    `);

    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建用户主题表
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_topics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic_keywords TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, topic_keywords)
      )
    `);

    // 创建用户订阅表
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_name VARCHAR(255) NOT NULL,
        source_url TEXT NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        topic_keywords TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, source_name, topic_keywords)
      )
    `);
    
    // 为现有表添加 topic_keywords 字段（如果表已存在但没有该字段）
    try {
      // 首先检查字段是否已存在
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'topic_keywords'
      `);
      
      if (columnCheck.rows.length === 0) {
        // 字段不存在，先添加为可空字段
        await client.query(`
          ALTER TABLE user_subscriptions ADD COLUMN topic_keywords TEXT
        `);
        
        // 为现有数据设置默认值（空字符串）
        await client.query(`
          UPDATE user_subscriptions 
          SET topic_keywords = '' 
          WHERE topic_keywords IS NULL
        `);
        
        // 如果需要，可以将字段设置为 NOT NULL（但这里我们保持可空，因为旧数据可能没有主题）
        // 新代码会要求 topic_keywords 不能为空，所以旧数据需要用户重新订阅
      }
      
      // 修改 UNIQUE 约束（需要先删除旧的，再创建新的）
      // 注意：PostgreSQL 不支持直接修改约束，需要先删除再创建
      try {
        // 尝试删除可能存在的旧约束（可能有不同的名称）
        await client.query(`
          DO $$ 
          BEGIN
            -- 删除通过 CREATE TABLE 创建的约束
            IF EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'user_subscriptions_user_id_source_name_key'
            ) THEN
              ALTER TABLE user_subscriptions 
              DROP CONSTRAINT user_subscriptions_user_id_source_name_key;
            END IF;
            
            -- 删除可能存在的唯一索引
            IF EXISTS (
              SELECT 1 FROM pg_indexes 
              WHERE indexname = 'user_subscriptions_user_id_source_name_key'
            ) THEN
              DROP INDEX IF EXISTS user_subscriptions_user_id_source_name_key;
            END IF;
          END $$;
        `);
      } catch (err) {
        // 约束可能不存在或名称不同，忽略错误
        console.log('删除旧约束时出现错误（可能已不存在）:', err.message);
      }
      
      // 创建新的唯一索引（替代唯一约束）
      try {
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_id_source_name_topic_key 
          ON user_subscriptions(user_id, source_name, topic_keywords)
        `);
        console.log('✅ 已创建新的唯一索引: user_subscriptions_user_id_source_name_topic_key');
      } catch (err) {
        // 索引可能已存在，忽略错误
        console.log('创建唯一索引时出现错误（可能已存在）:', err.message);
      }
    } catch (err) {
      // 字段可能已存在，忽略错误
      console.log('添加 topic_keywords 字段时出现错误（可能已存在）:', err.message);
    }

    // 修改新闻表，添加 user_id 字段
    try {
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
    } catch (err) {
      // 字段可能已存在，忽略错误
    }

    // 添加主题相关字段
    try {
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS topic_keywords TEXT
      `);
      await client.query(`
        ALTER TABLE news ADD COLUMN IF NOT EXISTS is_relevant_to_topic BOOLEAN
      `);
    } catch (err) {
      // 字段可能已存在，忽略错误
    }

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_id ON news(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_topics_user_id ON user_topics(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)
    `);

    // 创建推荐历史表（存储推荐过程和推荐的信息源列表）
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendation_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic_keywords TEXT NOT NULL,
        process_logs JSONB,
        recommended_sources JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, topic_keywords)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_id ON recommendation_history(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at ON recommendation_history(created_at DESC)
    `);

    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('初始化数据库表失败:', err);
  } finally {
    client.release();
  }
}

// 封装pool.query为Promise，添加重试机制（特别针对 Neon Serverless）
const db = {
  query: async (text, params, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        // 如果是连接错误且还有重试次数，则重试
        if (i < retries && (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message.includes('timeout'))) {
          const delay = 1000 * (i + 1); // 递增延迟
          console.warn(`⚠️  数据库查询失败，${delay}ms 后重试 (${i + 1}/${retries}):`, err.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // 其他错误或重试次数用完，直接抛出
        throw err;
      }
    }
  },
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
