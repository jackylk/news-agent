App({
  globalData: {
    apiBaseUrl: 'http://localhost:3000/api' // 开发环境，生产环境需要改为实际服务器地址
  },
  onLaunch() {
    console.log('小程序启动');
  }
});
