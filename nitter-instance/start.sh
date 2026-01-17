#!/bin/sh

# Nitter启动脚本
# 处理Railway环境变量并启动Nitter

# 从环境变量读取配置
NITTER_DOMAIN=${NITTER_DOMAIN:-}
REDIS_URL=${REDIS_URL:-}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-}
REDIS_DB=${REDIS_DB:-0}
PORT=${PORT:-8080}
NITTER_HMAC_KEY=${NITTER_HMAC_KEY:-}
NITTER_BASE64SECRET=${NITTER_BASE64SECRET:-}

# 如果提供了REDIS_URL，解析它
if [ -n "$REDIS_URL" ]; then
  # 解析Redis URL格式：redis://[password@]host:port[/db]
  REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+:)?([^@]+@)?([^:/]+).*|\3|')
  REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|' || echo "6379")
  REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+):([^@]+)@.*|\2|' || echo "")
fi

# 更新nitter.conf配置文件
if [ -f /etc/nitter.conf ]; then
  # 使用sed更新配置文件中的值
  if [ -n "$NITTER_DOMAIN" ]; then
    sed -i "s|hostname = .*|hostname = \"$NITTER_DOMAIN\"|" /etc/nitter.conf
  fi
  
  if [ -n "$PORT" ]; then
    sed -i "s|port = .*|port = $PORT|" /etc/nitter.conf
  fi
  
  if [ -n "$REDIS_HOST" ]; then
    sed -i "s|host = .*|host = \"$REDIS_HOST\"|" /etc/nitter.conf || echo "host = \"$REDIS_HOST\"" >> /etc/nitter.conf
  fi
  
  if [ -n "$REDIS_PORT" ]; then
    sed -i "s|port = .*|port = $REDIS_PORT|" /etc/nitter.conf || echo "port = $REDIS_PORT" >> /etc/nitter.conf
  fi
  
  if [ -n "$REDIS_PASSWORD" ]; then
    sed -i "s|password = .*|password = \"$REDIS_PASSWORD\"|" /etc/nitter.conf || echo "password = \"$REDIS_PASSWORD\"" >> /etc/nitter.conf
  fi
  
  if [ -n "$NITTER_HMAC_KEY" ]; then
    sed -i "s|hmacKey = .*|hmacKey = \"$NITTER_HMAC_KEY\"|" /etc/nitter.conf
  fi
  
  if [ -n "$NITTER_BASE64SECRET" ]; then
    sed -i "s|base64Secret = .*|base64Secret = \"$NITTER_BASE64SECRET\"|" /etc/nitter.conf
  fi
fi

# 启动Nitter（使用镜像的默认启动命令）
exec /app/nitter
