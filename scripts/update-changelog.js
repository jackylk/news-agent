#!/usr/bin/env node

/**
 * 更新 changelog.json 的脚本
 * 
 * 使用方法:
 * node scripts/update-changelog.js --version 1.1.0 --date 2024-01-15 --features "新功能1" "新功能2" --improvements "性能优化" --fixes "修复bug1"
 */

const fs = require('fs');
const path = require('path');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    version: null,
    date: null,
    features: [],
    improvements: [],
    fixes: []
  };

  let currentKey = null;
  let currentArray = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      if (key === 'version' || key === 'date') {
        currentKey = key;
        currentArray = null;
      } else if (key === 'features') {
        currentKey = null;
        currentArray = result.features;
      } else if (key === 'improvements') {
        currentKey = null;
        currentArray = result.improvements;
      } else if (key === 'fixes') {
        currentKey = null;
        currentArray = result.fixes;
      } else {
        console.error(`未知参数: ${arg}`);
        process.exit(1);
      }
    } else {
      if (currentKey) {
        result[currentKey] = arg;
        currentKey = null;
      } else if (currentArray !== null) {
        currentArray.push(arg);
      } else {
        console.error(`参数值没有对应的键: ${arg}`);
        process.exit(1);
      }
    }
  }

  return result;
}

// 验证参数
function validateArgs(args) {
  if (!args.version) {
    console.error('错误: 必须提供 --version 参数');
    process.exit(1);
  }

  if (!args.date) {
    // 如果没有提供日期，使用当前日期
    const now = new Date();
    args.date = now.toISOString().split('T')[0];
    console.log(`未提供日期，使用当前日期: ${args.date}`);
  }

  // 验证日期格式 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(args.date)) {
    console.error('错误: 日期格式不正确，应为 YYYY-MM-DD');
    process.exit(1);
  }

  // 验证版本号格式
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(args.version)) {
    console.error('错误: 版本号格式不正确，应为 x.y.z');
    process.exit(1);
  }
}

// 读取 changelog.json
function readChangelog() {
  const changelogPath = path.join(__dirname, '..', 'web', 'changelog.json');
  
  if (!fs.existsSync(changelogPath)) {
    console.error(`错误: 找不到文件 ${changelogPath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(changelogPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`错误: 无法读取或解析 changelog.json: ${error.message}`);
    process.exit(1);
  }
}

// 写入 changelog.json
function writeChangelog(data) {
  const changelogPath = path.join(__dirname, '..', 'web', 'changelog.json');
  
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(changelogPath, content, 'utf8');
    console.log(`✅ 成功更新 ${changelogPath}`);
  } catch (error) {
    console.error(`错误: 无法写入 changelog.json: ${error.message}`);
    process.exit(1);
  }
}

// 主函数
function main() {
  const args = parseArgs();
  validateArgs(args);

  const changelog = readChangelog();

  // 创建新的更新记录
  const newUpdate = {
    version: args.version,
    date: args.date,
    features: args.features,
    improvements: args.improvements,
    fixes: args.fixes
  };

  // 将新记录添加到数组开头
  changelog.updates.unshift(newUpdate);

  // 更新版本号
  changelog.version = args.version;

  // 写入文件
  writeChangelog(changelog);

  // 显示更新内容
  console.log('\n📝 更新内容:');
  console.log(`   版本: ${newUpdate.version}`);
  console.log(`   日期: ${newUpdate.date}`);
  if (newUpdate.features.length > 0) {
    console.log(`   新增功能: ${newUpdate.features.join(', ')}`);
  }
  if (newUpdate.improvements.length > 0) {
    console.log(`   改进: ${newUpdate.improvements.join(', ')}`);
  }
  if (newUpdate.fixes.length > 0) {
    console.log(`   修复: ${newUpdate.fixes.join(', ')}`);
  }
  console.log('');
}

// 运行主函数
main();
