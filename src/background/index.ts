// Web Monitor Background Script
console.log("Web Monitor background script running");

// 存储监控数据的结构
interface MonitoringData {
  performanceData: {
    loadTime: number;
    resourceCount: number;
    fps: number;
  };
  errors: Array<{
    message: string;
    source: string;
    line: number;
    timestamp: string;
  }>;
  lastUpdate: string;
}

interface ChangeRecord {
  areaId: string;
  elementTag: string;
  changeType: 'content' | 'style';
  oldValue: string;
  newValue: string;
  url: string;
  timestamp: string;
  areaName?: string; // Optional property for area name
}

// 初始化存储
let monitoringData: { [tabId: number]: MonitoringData } = {};

// 存储活动连接
const activeConnections = new Map<number, chrome.runtime.Port>();

// 创建右键菜单
function createContextMenu() {
  try {
    // 先移除已存在的菜单项
    chrome.contextMenus.removeAll(() => {
      // 创建新的菜单项
      chrome.contextMenus.create({
        id: 'startMonitoring',
        title: '开始监控此区域',
        contexts: ['page', 'selection'],
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('创建右键菜单失败:', chrome.runtime.lastError);
        } else {
          console.log('右键菜单创建成功');
        }
      });
    });
  } catch (error) {
    console.error('创建右键菜单时发生错误:', error);
  }
}

// 建立连接
function establishConnection(tabId: number): chrome.runtime.Port | undefined {
  try {
    const port = chrome.runtime.connect({ name: `monitor_${tabId}` });
    activeConnections.set(tabId, port);
    
    port.onDisconnect.addListener(() => {
      console.log(`Connection to tab ${tabId} closed`);
      activeConnections.delete(tabId);
    });

    return port;
  } catch (error) {
    console.error(`Failed to establish connection with tab ${tabId}:`, error);
    return undefined;
  }
}

// 发送消息到内容脚本
async function sendMessageToContentScript(tabId: number, message: any): Promise<void> {
  let port = activeConnections.get(tabId);
  
  if (!port) {
    port = establishConnection(tabId);
    if (!port) {
      console.error(`无法建立与标签页 ${tabId} 的连接`);
      return;
    }
  }

  try {
    port.postMessage(message);
  } catch (error) {
    console.error(`发送消息到标签页 ${tabId} 失败:`, error);
    // 如果发送失败，尝试重新建立连接
    activeConnections.delete(tabId);
    port = establishConnection(tabId);
    if (port) {
      port.postMessage(message);
    }
  }
}

// 监听扩展安装和更新事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension event:", details.reason);
  
  // 初始化存储
  chrome.storage.local.set({
    settings: {
      enabled: true,
      monitoringInterval: 1000,
      notifyOnError: true
    }
  }).then(() => {
    console.log('设置初始化成功');
  }).catch((error) => {
    console.error('设置初始化失败:', error);
  });

  // 创建右键菜单
  createContextMenu();
});

// 监听扩展启动事件
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started");
  // 确保在浏览器启动时也创建右键菜单
  createContextMenu();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info.menuItemId);
  if (info.menuItemId === 'startMonitoring' && tab?.id) {
    // 向content script发送开始选择的消息
    sendMessageToContentScript(tab.id, {
      type: 'START_SELECTION'
    });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // 重置该标签页的监控数据
    monitoringData[tabId] = {
      performanceData: {
        loadTime: 0,
        resourceCount: 0,
        fps: 0
      },
      errors: [],
      lastUpdate: new Date().toISOString()
    };

    // 尝试建立新的连接
    establishConnection(tabId);
  }
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
  // 清理该标签页的监控数据和连接
  delete monitoringData[tabId];
  activeConnections.delete(tabId);
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  try {
    switch (message.type) {
      case 'ping':
        sendResponse({ success: true });
        break;
      case 'MONITOR_AREA':
        handleMonitorArea(message, sender, sendResponse);
        break;
      case 'AREA_CHANGED':
        handleAreaChanged(message.data);
        sendResponse({ success: true });
        break;
      case 'performanceData':
      case 'errorOccurred':
      case 'fpsData':
        if (sender.tab?.id) {
          updateMonitoringData(sender.tab.id, message);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No tab ID found' });
        }
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
  
  return true;
});

// 处理监控区域变化
async function handleAreaChanged(data: ChangeRecord): Promise<void> {
  try {
    // 创建通知
    const notificationId = `change_${Date.now()}`;
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'assets/icon-48.png',
      title: '监控区域发生变化',
      message: `区域 "${data.areaName}" 发生了变化`,
      buttons: [
        { title: '查看详情' },
        { title: '忽略' }
      ]
    });

    // 存储变更记录
    const changes = await chrome.storage.local.get('changes') || { changes: [] };
    changes.push(data);
    await chrome.storage.local.set({ changes });
    
  } catch (error) {
    console.error('处理区域变化时发生错误:', error);
  }
}

// 处理监控区域添加
async function handleMonitorArea(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  const notificationId = 'monitor_confirmation';
  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
      title: '确认监控',
      message: '是否要开始监控选中区域？',
      buttons: [
        { title: '确认监控' },
        { title: '取消' }
      ],
      requireInteraction: true
    });

    // 存储当前选择的区域信息
    await chrome.storage.local.set({
      pendingMonitorArea: {
        area: message.area,
        tabId: sender.tab?.id
      }
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error handling monitor area:', error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// 更新监控数据
function updateMonitoringData(tabId: number, message: any) {
  if (!monitoringData[tabId]) {
    monitoringData[tabId] = {
      performanceData: {
        loadTime: 0,
        resourceCount: 0,
        fps: 0
      },
      errors: [],
      lastUpdate: new Date().toISOString()
    };
  }

  switch (message.type) {
    case 'performanceData':
      monitoringData[tabId].performanceData = {
        ...monitoringData[tabId].performanceData,
        ...message.data
      };
      break;
    case 'errorOccurred':
      monitoringData[tabId].errors.push(message.data);
      break;
    case 'fpsData':
      monitoringData[tabId].performanceData.fps = message.data;
      break;
  }

  monitoringData[tabId].lastUpdate = new Date().toISOString();
}

// 监听通知按钮点击
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'monitor_confirmation') {
    try {
      // 获取存储的区域信息
      const { pendingMonitorArea } = await chrome.storage.local.get('pendingMonitorArea');
      if (!pendingMonitorArea?.tabId) {
        throw new Error('No pending monitor area found');
      }

      // 发送确认或取消消息到content script
      await chrome.tabs.sendMessage(pendingMonitorArea.tabId, {
        type: buttonIndex === 0 ? 'CONFIRM_MONITOR' : 'CANCEL_MONITOR',
        area: buttonIndex === 0 ? pendingMonitorArea.area : undefined
      });

      // 清除存储的区域信息
      await chrome.storage.local.remove('pendingMonitorArea');
      // 清除通知
      await chrome.notifications.clear(notificationId);
    } catch (error) {
      console.error('Error handling notification click:', error);
      // 创建错误通知
      chrome.notifications.create('error_notification', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
        title: '错误',
        message: '处理操作时发生错误，请重试',
        requireInteraction: false
      });
    }
  }
});
