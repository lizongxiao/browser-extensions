import { MonitoringItem } from "../../types/monitoringTypes";

// 更新扩展图标徽章，显示有更新的监控项数量
export function updateBadge() {
  chrome.storage.local.get('savedSelections', (result) => {
    const savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    // 计算有更新的监控项数量
    const updatesCount = savedSelections.filter(item => item.hasUpdates).length;
    
    if (updatesCount > 0) {
      // 设置徽章文本和颜色
      chrome.action.setBadgeText({ text: updatesCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
    } else {
      // 清除徽章
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

// 监听存储变化，更新徽章
chrome.storage.onChanged.addListener((changes) => {
  if (changes.savedSelections) {
    updateBadge();
  }
});

// 初始化徽章
updateBadge(); 