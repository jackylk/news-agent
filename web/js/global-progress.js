/**
 * 全局进度提示组件 — 多任务模式
 * 在页面底部显示进度条，支持跨页面同步、多任务合并摘要
 */
(function() {
  const STORAGE_KEY = 'globalProgress';
  const EXPIRE_MS = 5 * 60 * 1000; // 5 分钟过期
  let progressBar = null;
  let isInitialized = false;
  let isExpanded = false;

  // ── DOM 创建 ──────────────────────────────────────────────
  function createProgressBar() {
    if (document.getElementById('globalProgressBar')) return;
    if (!document.body) return;

    const container = document.createElement('div');
    container.id = 'globalProgressBar';
    container.innerHTML = `
      <div class="gp-summary">
        <div class="gp-info">
          <span class="gp-title"></span>
          <span class="gp-text"></span>
        </div>
        <div class="gp-bar-container"><div class="gp-bar"></div></div>
        <button class="gp-toggle" style="display:none">▲</button>
        <button class="gp-close" onclick="GlobalProgress.hide()">&times;</button>
      </div>
      <div class="gp-details" style="display:none"></div>
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
        z-index: 10000;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
      }
      #globalProgressBar.visible {
        transform: translateY(0);
      }
      /* 摘要行 */
      #globalProgressBar .gp-summary {
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
      #globalProgressBar .gp-toggle {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        line-height: 24px;
        padding: 0;
        flex-shrink: 0;
        transition: background 0.2s, transform 0.2s;
      }
      #globalProgressBar .gp-toggle:hover {
        background: rgba(255,255,255,0.3);
      }
      #globalProgressBar .gp-toggle.expanded {
        transform: rotate(180deg);
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
      /* 详情列表 */
      #globalProgressBar .gp-details {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px 12px;
        border-top: 1px solid rgba(255,255,255,0.2);
      }
      #globalProgressBar .gp-detail-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        font-size: 13px;
      }
      #globalProgressBar .gp-detail-row + .gp-detail-row {
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      #globalProgressBar .gp-detail-label {
        font-weight: 600;
        white-space: nowrap;
      }
      #globalProgressBar .gp-detail-bar {
        width: 120px;
        height: 4px;
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
        flex-shrink: 0;
      }
      #globalProgressBar .gp-detail-bar-inner {
        height: 100%;
        background: white;
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      #globalProgressBar .gp-detail-text {
        flex: 1;
        min-width: 0;
        opacity: 0.9;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        #globalProgressBar .gp-summary {
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

    // 绑定展开/折叠
    container.querySelector('.gp-toggle').addEventListener('click', () => {
      isExpanded = !isExpanded;
      renderUI();
    });
  }

  // ── localStorage 读写 ─────────────────────────────────────
  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { tasks: {} };
      const data = JSON.parse(raw);
      // 清除过期任务
      const now = Date.now();
      let changed = false;
      for (const id of Object.keys(data.tasks || {})) {
        if (now - (data.tasks[id].timestamp || 0) > EXPIRE_MS) {
          delete data.tasks[id];
          changed = true;
        }
      }
      if (changed) writeStore(data);
      return data;
    } catch (e) {
      return { tasks: {} };
    }
  }

  function writeStore(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ── UI 渲染 ───────────────────────────────────────────────
  function renderUI() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => renderUI());
      return;
    }
    createProgressBar();
    if (!progressBar) progressBar = document.getElementById('globalProgressBar');
    if (!progressBar) return;

    const data = readStore();
    const taskIds = Object.keys(data.tasks || {});
    const count = taskIds.length;

    if (count === 0) {
      progressBar.classList.remove('visible');
      return;
    }

    const summaryTitle = progressBar.querySelector('.gp-title');
    const summaryText  = progressBar.querySelector('.gp-text');
    const bar          = progressBar.querySelector('.gp-bar');
    const toggleBtn    = progressBar.querySelector('.gp-toggle');
    const detailsDiv   = progressBar.querySelector('.gp-details');

    if (count === 1) {
      // 单任务：直接显示
      const t = data.tasks[taskIds[0]];
      summaryTitle.textContent = t.title + (t.label ? ': ' + t.label : '');
      summaryText.textContent  = t.text || '';
      bar.style.width          = (t.percent || 0) + '%';
      toggleBtn.style.display  = 'none';
      detailsDiv.style.display = 'none';
    } else {
      // 多任务：合并摘要
      const avgPercent = Math.round(
        taskIds.reduce((sum, id) => sum + (data.tasks[id].percent || 0), 0) / count
      );
      summaryTitle.textContent = `${count} 个任务进行中`;
      summaryText.textContent  = '';
      bar.style.width          = avgPercent + '%';
      toggleBtn.style.display  = '';
      toggleBtn.classList.toggle('expanded', isExpanded);

      if (isExpanded) {
        detailsDiv.style.display = '';
        detailsDiv.innerHTML = taskIds.map(id => {
          const t = data.tasks[id];
          return `
            <div class="gp-detail-row">
              <span class="gp-detail-label">${t.title}: ${t.label || ''}</span>
              <div class="gp-detail-bar"><div class="gp-detail-bar-inner" style="width:${t.percent || 0}%"></div></div>
              <span class="gp-detail-text">${t.text || ''}</span>
            </div>`;
        }).join('');
      } else {
        detailsDiv.style.display = 'none';
      }
    }

    progressBar.classList.add('visible');
  }

  function hideUI() {
    if (progressBar) progressBar.classList.remove('visible');
  }

  // ── 初始化 ────────────────────────────────────────────────
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createProgressBar);
    } else {
      createProgressBar();
    }

    // 跨标签页同步
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) renderUI();
    });

    // 页面加载时恢复
    const data = readStore();
    if (Object.keys(data.tasks || {}).length > 0) {
      setTimeout(() => renderUI(), 100);
    }
  }

  // ── 公开 API ──────────────────────────────────────────────
  window.GlobalProgress = {
    init: init,

    // 多任务管理
    addTask: function(taskId, title, label, percent, text) {
      const data = readStore();
      data.tasks[taskId] = {
        title: title,
        label: label || '',
        percent: percent || 0,
        text: text || '',
        timestamp: Date.now()
      };
      writeStore(data);
      renderUI();
    },

    updateTask: function(taskId, percent, text) {
      const data = readStore();
      if (data.tasks[taskId]) {
        data.tasks[taskId].percent = percent;
        if (text !== undefined) data.tasks[taskId].text = text;
        data.tasks[taskId].timestamp = Date.now();
        writeStore(data);
        renderUI();
      }
    },

    completeTask: function(taskId, text, delay) {
      if (delay === undefined) delay = 2000;
      const data = readStore();
      if (data.tasks[taskId]) {
        data.tasks[taskId].percent = 100;
        if (text) data.tasks[taskId].text = text;
        data.tasks[taskId].timestamp = Date.now();
        writeStore(data);
        renderUI();
      }
      setTimeout(() => {
        GlobalProgress.removeTask(taskId);
      }, delay);
    },

    removeTask: function(taskId) {
      const data = readStore();
      delete data.tasks[taskId];
      writeStore(data);
      renderUI();
    },

    // 兼容：单任务快捷方式（映射到 _default）
    show: function(title, percent, text) {
      GlobalProgress.addTask('_default', title, '', percent, text);
    },

    update: function(percent, text) {
      GlobalProgress.updateTask('_default', percent, text);
    },

    hide: function() {
      // 关闭按钮：移除所有任务
      const data = readStore();
      data.tasks = {};
      writeStore(data);
      hideUI();
    },

    complete: function(text, delay) {
      GlobalProgress.completeTask('_default', text, delay);
    }
  };

  // 自动初始化
  init();
})();
