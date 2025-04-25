// 通知所有标签页刷新扩展内容
export function notifyContentScriptsToRefresh() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        try {
          chrome.tabs.sendMessage(tab.id, { action: "refreshExtension" });
        } catch (error) {
          console.log(`向标签页 ${tab.id} 发送消息失败`, error);
        }
      }
    }
  });
}

// 重新加载扩展
export function reloadExtension() {
  // 重新加载扩展
  chrome.runtime.reload();
  // 通知所有内容脚本
  notifyContentScriptsToRefresh();
}
