const api = require('../../utils/api');

Page({
  data: {
    newsList: [],
    loading: true,
    error: null
  },

  onLoad() {
    this.loadNewsList();
  },

  onPullDownRefresh() {
    this.loadNewsList().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadNewsList() {
    this.setData({ loading: true, error: null });
    
    try {
      const data = await api.getNewsList();
      // 格式化日期显示
      const processedData = data.map(item => ({
        ...item,
        displayDate: this.formatDate(item.date)
      }));
      this.setData({
        newsList: processedData,
        loading: false
      });
    } catch (error) {
      console.error('加载新闻列表失败:', error);
      this.setData({
        loading: false,
        error: error.message || '加载失败，请稍后重试'
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  processNewsList() {
    const { newsList } = this.data;
    if (newsList && newsList.length > 0) {
      const processedData = newsList.map(item => ({
        ...item,
        displayDate: this.formatDate(item.date)
      }));
      this.setData({ newsList: processedData });
    }
  },

  onNewsTap(e) {
    const newsId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${newsId}`
    });
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今天';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  }
});
