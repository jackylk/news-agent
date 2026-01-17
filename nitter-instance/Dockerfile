# 使用官方Nitter镜像
FROM zedeus/nitter:latest

# 复制配置文件和启动脚本
COPY nitter.conf /etc/nitter.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 暴露端口（Railway会自动设置PORT环境变量）
EXPOSE 8080

# 使用自定义启动脚本
CMD ["/start.sh"]
