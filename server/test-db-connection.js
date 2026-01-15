// 测试 Neon 数据库连接
require('dotenv').config();
const { Pool } = require('pg');

// 从环境变量或命令行参数获取连接字符串
const connectionString = process.env.DATABASE_URL || process.argv[2];

if (!connectionString) {
  console.error('❌ 错误: 请提供 DATABASE_URL 环境变量或作为命令行参数');
  console.error('   使用方法: node test-db-connection.js "postgresql://..."');
  process.exit(1);
}

console.log('🔗 正在测试数据库连接...');
console.log('   连接字符串:', connectionString.replace(/:[^:@]+@/, ':****@')); // 隐藏密码

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1, // 测试时只需要一个连接
  connectionTimeoutMillis: 30000,
});

async function testConnection() {
  let client;
  try {
    console.log('\n📡 正在建立连接...');
    client = await pool.connect();
    console.log('✅ 连接成功！');
    
    // 测试查询
    console.log('\n📊 测试查询...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ 查询成功！');
    console.log('   当前时间:', result.rows[0].current_time);
    console.log('   PostgreSQL 版本:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);
    
    // 检查 news 表是否存在
    console.log('\n📋 检查数据库表...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'news'
      ) as table_exists
    `);
    
    if (tableCheck.rows[0].table_exists) {
      console.log('✅ news 表已存在');
      
      // 获取新闻数量
      const countResult = await client.query('SELECT COUNT(*) as count FROM news');
      console.log('   新闻总数:', countResult.rows[0].count);
      
      // 获取来源列表
      const sourcesResult = await client.query(`
        SELECT source, COUNT(*) as count 
        FROM news 
        GROUP BY source 
        ORDER BY count DESC 
        LIMIT 5
      `);
      if (sourcesResult.rows.length > 0) {
        console.log('\n   前5个新闻来源:');
        sourcesResult.rows.forEach(row => {
          console.log(`   - ${row.source}: ${row.count} 条`);
        });
      }
    } else {
      console.log('⚠️  news 表不存在（这是正常的，首次运行时会自动创建）');
    }
    
    console.log('\n✅ 数据库连接测试完成！所有测试通过。');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('   错误类型: 连接超时');
      console.error('   可能原因:');
      console.error('   1. 网络连接问题');
      console.error('   2. 防火墙阻止连接');
      console.error('   3. Neon 数据库服务不可用');
    } else if (error.code === 'ENETUNREACH') {
      console.error('   错误类型: 网络不可达（可能是 IPv6 问题）');
      console.error('   建议: 使用 pooler 连接字符串（已包含 -pooler）');
    } else if (error.message.includes('password')) {
      console.error('   错误类型: 认证失败');
      console.error('   可能原因: 密码错误或用户不存在');
    } else {
      console.error('   错误代码:', error.code);
      console.error('   错误详情:', error);
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testConnection();
