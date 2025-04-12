// 扩展背景脚本
console.log('Background script 正在运行！');

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('扩展已安装');
    
    // 初始化存储内容
    chrome.storage.local.set({
      settings: {
        enabled: true,
        theme: 'light'
      }
    });
  } else if (details.reason === 'update') {
    console.log(`扩展已更新至版本 ${chrome.runtime.getManifest().version}`);
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message);
  
  if (message.type === 'getSettings') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings);
    });
    return true; // 异步响应
  }
  
  if (message.type === 'updateSettings') {
    chrome.storage.local.set({ settings: message.data }, () => {
      sendResponse({ success: true });
    });
    return true; // 异步响应
  }
}); 