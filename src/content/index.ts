// 内容脚本
console.log('Content script 已加载');

// 定义不同主题的样式
const themeStyles = {
  light: {
    background: '#3a7bd5',
    color: 'white',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
  },
  dark: {
    background: '#222',
    color: '#ddd',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
  }
};

// 获取设置
chrome.runtime.sendMessage({ type: 'getSettings' }, (settings) => {
  if (settings && settings.enabled) {
    // 如果启用了扩展功能，初始化内容脚本逻辑
    initScrollFeature(settings.theme);
  }
});

// 创建滚动按钮
function initScrollFeature(theme = 'light') {
  // 移除可能已存在的按钮
  const existingButton = document.getElementById('scroll-top-button');
  if (existingButton) {
    existingButton.remove();
  }

  // 获取当前主题的样式
  const currentTheme = themeStyles[theme] || themeStyles.light;

  // 创建滚动到顶部的按钮
  const scrollButton = document.createElement('div');
  scrollButton.id = 'scroll-top-button';
  scrollButton.innerHTML = '↑';
  scrollButton.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 50px;
    height: 50px;
    background-color: ${currentTheme.background};
    color: ${currentTheme.color};
    border-radius: 50%;
    text-align: center;
    line-height: 50px;
    font-size: 24px;
    cursor: pointer;
    z-index: 9999;
    display: none;
    box-shadow: ${currentTheme.boxShadow};
  `;

  // 添加到页面
  document.body.appendChild(scrollButton);

  // 点击事件处理
  scrollButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // 监听滚动事件
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      scrollButton.style.display = 'block';
    } else {
      scrollButton.style.display = 'none';
    }
  });
}

// 监听来自扩展弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    // 如果设置已更新，重新加载逻辑
    if (message.data.enabled) {
      initScrollFeature(message.data.theme);
    } else {
      // 如果禁用了扩展，移除按钮
      const scrollButton = document.getElementById('scroll-top-button');
      if (scrollButton) {
        scrollButton.remove();
      }
    }
    sendResponse({ success: true });
  }
}); 