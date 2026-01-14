const app = getApp();

// API请求封装
function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.apiBaseUrl + url,
      method: method,
      data: data,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.success) {
            resolve(res.data.data);
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

// 获取新闻列表
function getNewsList() {
  return request('/news/list');
}

// 获取新闻详情
function getNewsDetail(id) {
  return request(`/news/${id}`);
}

module.exports = {
  getNewsList,
  getNewsDetail
};
