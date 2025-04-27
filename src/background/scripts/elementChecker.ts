// 元素检查器 - 定期检查监控的元素和区域是否有更新
import { MonitoringItem, ContentCheckResult, AppSettings } from "../../types/monitoringTypes";

// 存储检查计时器ID
let checkInterval: number | null = null;

// 初始化检查器
export function initElementChecker() {
  // 加载设置
  chrome.storage.local.get('settings', (result) => {
    const settings: AppSettings = result.settings || { checkInterval: 30 };
    startChecking(settings.checkInterval);
  });

  // 监听设置变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      const newSettings: AppSettings = changes.settings.newValue;
      startChecking(newSettings.checkInterval);
    }
  });
}

// 开始定期检查
function startChecking(intervalMinutes: number) {
  // 清除现有计时器
  if (checkInterval !== null) {
    clearInterval(checkInterval);
  }

  // 设置新的计时器
  const intervalMilliseconds = intervalMinutes * 60 * 1000;
  checkInterval = setInterval(checkAllMonitoredItems, intervalMilliseconds) as unknown as number;
  
  console.log(`开始监控检查，间隔${intervalMinutes}分钟`);
  
  // 立即执行一次检查
  checkAllMonitoredItems();
}

// 检查所有监控项目
async function checkAllMonitoredItems() {
  console.log('开始检查所有监控项目');
  
  // 获取所有保存的选择
  chrome.storage.local.get('savedSelections', async (result) => {
    const savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    if (savedSelections.length === 0) {
      console.log('没有监控项目');
      return;
    }
    
    // 检查每个监控项
    for (const item of savedSelections) {
      try {
        await checkItem(item);
      } catch (error) {
        console.error(`检查项目出错 ${item.id}:`, error);
      }
    }
  });
}

// 检查单个监控项
async function checkItem(item: MonitoringItem): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`检查监控项: ${item.url}`);
      
      // 打开标签页但不激活
      chrome.tabs.create({ url: item.url, active: false }, (tab) => {
        if (!tab || !tab.id) {
          reject(new Error('创建标签页失败'));
          return;
        }
        
        // 等待页面加载完成
        const tabId = tab.id;
        
        // 添加超时保护
        const timeout = setTimeout(() => {
          cleanupTab(tabId);
          reject(new Error('检查超时'));
        }, 30000); // 30秒超时
        
        // 监听标签页加载完成
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            // 页面加载完成，移除监听器
            chrome.tabs.onUpdated.removeListener(listener);
            
            // 执行内容脚本来检查内容
            setTimeout(() => {
              checkContent(tabId, item, () => {
                clearTimeout(timeout);
                cleanupTab(tabId);
                resolve();
              });
            }, 2000); // 等待2秒确保页面加载完成
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 清理标签页
function cleanupTab(tabId: number) {
  chrome.tabs.remove(tabId).catch(err => console.error('关闭标签页失败:', err));
}

// 检查内容
function checkContent(tabId: number, item: MonitoringItem, callback: () => void) {
  // 注入脚本进行检查
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: checkContentInPage,
    args: [item]
  }).then(results => {
    const result = results[0].result as ContentCheckResult;
    
    if (result.hasChanged) {
      // 内容有变化，更新存储并发送通知
      updateItem(item.id, result.newContent || '', result.newInnerText || '').then(() => {
        sendChangeNotification(item, result);
        callback();
      });
    } else {
      // 仅更新最后检查时间
      updateItemLastCheckTime(item.id).then(callback);
    }
  }).catch(error => {
    console.error('执行内容检查脚本失败:', error);
    callback();
  });
}

// 页面内容检查函数 (在目标页面上下文中执行)
function checkContentInPage(item: MonitoringItem): ContentCheckResult {
  // 检查不同类型的监控项
  if (item.selectionType === 'elements') {
    return checkElements(item);
  } else {
    return checkRegion(item);
  }
  
  // 检查元素
  function checkElements(item: MonitoringItem): ContentCheckResult {
    if (item.selectionType !== 'elements') {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'elements'
      };
    }

    const elements = item.elements || [];
    let newContent = '';
    let newInnerText = '';
    let hasChanged = false;
    
    // 检查每个元素
    for (const elementInfo of elements) {
      try {
        // 使用XPath找到元素
        const xpath = elementInfo.xpath;
        if (!xpath) continue;
        
        const element = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.FIRST_ORDERED_NODE_TYPE, 
          null
        ).singleNodeValue as Element;
        
        if (element) {
          const html = element.outerHTML;
          const text = element.textContent || '';
          
          newContent += html;
          newInnerText += text + ' | ';
        }
      } catch (e) {
        console.error('检查元素失败:', e);
      }
    }
    
    // 检查内容是否有变化
    hasChanged = (item.lastContent !== newContent);
    
    return {
      hasChanged,
      newContent,
      newInnerText: newInnerText.trim(),
      timeChecked: new Date().toISOString(),
      type: 'elements'
    };
  }
  
  // 检查区域
  function checkRegion(item: MonitoringItem): ContentCheckResult {
    if (item.selectionType !== 'region') {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'region'
      };
    }

    // 提取绝对位置坐标
    const left = item.left - window.scrollX;
    const top = item.top - window.scrollY;
    const width = item.width;
    const height = item.height;
    
    // 尝试找到区域中心的元素
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const element = document.elementFromPoint(centerX, centerY);
    
    // 如果找不到元素，则返回无变化
    if (!element) {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'region'
      };
    }
    
    // 尝试找到合适的容器
    let targetElement = element;
    let closestContainer = element;
    
    // 向上查找合适的容器
    let currentEl = element;
    while (currentEl && currentEl !== document.body) {
      const rect = currentEl.getBoundingClientRect();
      const isContainer = (
        rect.width >= width * 0.8 && 
        rect.height >= height * 0.8 &&
        rect.width <= width * 1.5 && 
        rect.height <= height * 1.5
      );
      
      if (isContainer) {
        closestContainer = currentEl;
        break;
      }
      currentEl = currentEl.parentElement as Element;
    }
    
    targetElement = closestContainer || element;
    
    // 获取区域HTML内容
    const newContent = targetElement.outerHTML;
    const newInnerText = targetElement.textContent || '';
    
    // 检查内容是否有变化
    const hasChanged = (item.lastContent !== newContent);
    
    return {
      hasChanged,
      newContent,
      newInnerText,
      timeChecked: new Date().toISOString(),
      type: 'region'
    };
  }
}

// 更新监控项
async function updateItem(itemId: string, newContent: string, newInnerText: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('savedSelections', (result) => {
      let savedSelections: MonitoringItem[] = result.savedSelections || [];
      
      // 查找并更新指定ID的项目
      const updatedSelections = savedSelections.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            lastContent: newContent,
            innerText: item.selectionType === 'region' ? newInnerText : undefined,
            lastCheck: new Date().toISOString(),
            hasUpdates: true
          };
        }
        return item;
      });
      
      // 保存回存储
      chrome.storage.local.set({ savedSelections: updatedSelections }, () => {
        resolve();
      });
    });
  });
}

// 只更新最后检查时间
async function updateItemLastCheckTime(itemId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('savedSelections', (result) => {
      let savedSelections: MonitoringItem[] = result.savedSelections || [];
      
      // 查找并更新指定ID的项目
      const updatedSelections = savedSelections.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            lastCheck: new Date().toISOString()
          };
        }
        return item;
      });
      
      // 保存回存储
      chrome.storage.local.set({ savedSelections: updatedSelections }, () => {
        resolve();
      });
    });
  });
}

// 发送变化通知
function sendChangeNotification(item: MonitoringItem, result: ContentCheckResult) {
  const title = item.title || '监控项更新';
  const message = `${item.url} 上的内容有变化`;
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/src/assets/icon128.png',
    title: title,
    message: message,
    priority: 2,
    buttons: [
      { title: '查看页面' },
      { title: '查看设置' }
    ]
  }, (notificationId) => {
    // 存储通知和对应项目的关系
    chrome.storage.local.set({
      [`notification_${notificationId}`]: item.id
    });
  });
  
  // 监听通知按钮点击
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    chrome.storage.local.get([`notification_${notificationId}`], (result) => {
      const itemId = result[`notification_${notificationId}`];
      
      if (!itemId) return;
      
      if (buttonIndex === 0) {
        // 打开相应页面
        chrome.tabs.create({ url: item.url });
      } else if (buttonIndex === 1) {
        // 打开设置页面
        chrome.tabs.create({ url: 'src/options/index.html' });
      }
      
      // 清理通知映射
      chrome.storage.local.remove([`notification_${notificationId}`]);
    });
  });
}

// 导出初始化函数
export default initElementChecker; 