const api = require('../../utils/api');

Page({
  data: {
    news: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    const id = options.id;
    if (id) {
      this.loadNewsDetail(id);
    } else {
      this.setData({
        loading: false,
        error: '无效的新闻ID'
      });
    }
  },

  async loadNewsDetail(id) {
    this.setData({ loading: true, error: null });
    
    try {
      const news = await api.getNewsDetail(id);
      this.setData({
        news: news,
        loading: false
      });
    } catch (error) {
      console.error('加载新闻详情失败:', error);
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

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  openSource() {
    const url = this.data.news?.url;
    if (url) {
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showToast({
            title: '链接已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.news?.title || '科技新闻',
      path: `/pages/detail/detail?id=${this.data.news?.id}`
    };
  }
});
