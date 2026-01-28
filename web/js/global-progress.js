/**
 * 全局进度提示组件
 * 在页面底部显示进度条，支持跨页面同步
 */
(function() {
  const STORAGE_KEY = 'globalProgress';
  let progressBar = null;
  let isInitialized = false;

  // 创建进度条 DOM
  function createProgressBar() {
    if (document.getElementById('globalProgressBar')) return;
    if (!document.body) return; // body 还不存在时不创建

    const container = document.createElement('div');
    container.id = 'globalProgressBar';
    container.innerHTML = `
      <div class="gp-content">
        <div class="gp-info">
          <span class="gp-title"></span>
          <span class="gp-text"></span>
        </div>
        <div class="gp-bar-container">
          <div class="gp-bar"></div>
        </div>
        <button class="gp-close" onclick="GlobalProgress.hide()">&times;</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #globalProgressBar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0;
        z-index: 10000;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
      }
      #globalProgressBar.visible {
        transform: translateY(0);
      }
      #globalProgressBar .gp-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      #globalProgressBar .gp-info {
        flex: 1;
        min-width: 0;
      }
      #globalProgressBar .gp-title {
        font-weight: 600;
        font-size: 14px;
        margin-right: 10px;
      }
      #globalProgressBar .gp-text {
        font-size: 13px;
        opacity: 0.9;
      }
      #globalProgressBar .gp-bar-container {
        width: 200px;
        height: 6px;
        background: rgba(255,255,255,0.3);
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
      }
      #globalProgressBar .gp-bar {
        height: 100%;
        background: white;
        border-radius: 3px;
        transition: width 0.3s ease;
        width: 0%;
      }
      #globalProgressBar .gp-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 24px;
        padding: 0;
        flex-shrink: 0;
        transition: background 0.2s;
      }
      #globalProgressBar .gp-close:hover {
        background: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #globalProgressBar .gp-content {
          flex-wrap: wrap;
        }
        #globalProgressBar .gp-bar-container {
          width: 100%;
          order: 3;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);
    progressBar = container;
  }

  // 初始化
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createProgressBar);
    } else {
      createProgressBar();
    }

    // 监听 storage 事件，实现跨页面同步
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        const data = e.newValue ? JSON.parse(e.newValue) : null;
        if (data) {
          updateUI(data);
        } else {
          hideUI();
        }
      }
    });

    // 页面加载时检查是否有进行中的任务
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // 检查是否过期（超过5分钟自动清除）
      if (data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
        setTimeout(() => updateUI(data), 100);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  // 更新 UI
  function updateUI(data) {
    // 确保 DOM 已准备好
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => updateUI(data));
      return;
    }
    createProgressBar();
    if (!progressBar) {
      // 如果 progressBar 还是 null，说明 createProgressBar 失败了，重试
      progressBar = document.getElementById('globalProgressBar');
    }
    if (!progressBar) return;

    progressBar.querySelector('.gp-title').textContent = data.title || '';
    progressBar.querySelector('.gp-text').textContent = data.text || '';
    progressBar.querySelector('.gp-bar').style.width = `${data.percent || 0}%`;
    progressBar.classList.add('visible');
  }

  // 隐藏 UI
  function hideUI() {
    if (progressBar) {
      progressBar.classList.remove('visible');
    }
  }

  // 公开 API
  window.GlobalProgress = {
    init: init,

    show: function(title, percent, text) {
      const data = {
        title: title,
        percent: percent,
        text: text,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      updateUI(data);
    },

    update: function(percent, text) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        data.percent = percent;
        if (text !== undefined) data.text = text;
        data.timestamp = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        updateUI(data);
      }
    },

    hide: function() {
      localStorage.removeItem(STORAGE_KEY);
      hideUI();
    },

    // 完成并自动隐藏
    complete: function(text, delay = 2000) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        data.percent = 100;
        if (text) data.text = text;
        data.timestamp = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        updateUI(data);
      }
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        hideUI();
      }, delay);
    }
  };

  // 自动初始化
  init();
})();
