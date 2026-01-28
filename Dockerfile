FROM node:20-alpine

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip bundled Chromium download and use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# 复制 package 文件
COPY server/package*.json ./

# 安装依赖
RUN npm install --production

# 复制应用代码
COPY server/ .

# 创建数据库目录
RUN mkdir -p database

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
