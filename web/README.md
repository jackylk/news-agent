# 网页版前端

这是一个简单的HTML网页版前端，用于在浏览器中测试和查看新闻API。

## 使用方法

1. **确保服务器正在运行**
   ```bash
   cd server
   npm start
   ```

2. **在浏览器中打开**
   - 直接用浏览器打开 `web/index.html` 文件
   - 或者使用简单的HTTP服务器：
     ```bash
     # 使用Python
     cd web
     python -m http.server 8080
     # 然后访问 http://localhost:8080
     
     # 或使用Node.js的http-server
     npx http-server web -p 8080
     ```

3. **配置API地址**
   - 在页面顶部的输入框中输入你的API服务器地址
   - 默认是 `http://localhost:3000/api`
   - 点击"刷新新闻"按钮加载新闻

## 功能

- ✅ 查看新闻列表（按日期分组）
- ✅ 点击新闻查看详情
- ✅ 支持配置API服务器地址
- ✅ 响应式设计，支持移动端

## 注意事项

- 如果遇到CORS错误，确保服务器端的CORS配置允许你的域名
- 如果API服务器在不同端口，记得修改API地址
