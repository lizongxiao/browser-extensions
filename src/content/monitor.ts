import { ref } from 'vue';

// 选择状态
let isSelecting = false;
let startX = 0;
let startY = 0;

// 监控区域接口
interface MonitorArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLElement;
  lastValue?: string;  // 用于存储元素的上一次值
  lastStyle?: string;  // 用于存储元素的上一次样式
  areaName?: string;   // 区域名称
}

// 监控区域列表
const monitoredAreas = ref<MonitorArea[]>([]);

// 创建选择框
let selectionBox: HTMLDivElement | null = null;

// 初始化事件监听
export function initMonitor() {
  console.log('Monitor initialized');
  
  // 创建选择框
  selectionBox = document.createElement('div');
  selectionBox.style.position = 'fixed';
  selectionBox.style.border = '2px dashed #1890ff';
  selectionBox.style.backgroundColor = 'rgba(24, 144, 255, 0.1)';
  selectionBox.style.pointerEvents = 'none';
  selectionBox.style.display = 'none';
  selectionBox.style.zIndex = '999999';
  document.body.appendChild(selectionBox);

  // 监听鼠标事件
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 监听来自popup和background的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.type);
    
    try {
      switch (message.type) {
        case 'START_SELECTION':
          startSelection();
          // 更改鼠标样式
          document.body.style.cursor = 'crosshair';
          sendResponse({ success: true });
          break;
        case 'GET_MONITOR_AREAS':
          sendResponse(monitoredAreas.value);
          break;
        case 'REMOVE_MONITOR_AREA':
          removeMonitorArea(message.areaId);
          sendResponse({ success: true });
          break;
        case 'CONFIRM_MONITOR':
          if (message.area) {
            addMonitorArea(message.area);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No area data provided' });
          }
          break;
        case 'CANCEL_MONITOR':
          cancelSelection();
          sendResponse({ success: true });
          break;
        case 'HIGHLIGHT_CHANGED_AREA':
          highlightChangedArea(message.areaId);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: handleError(error) });
    }
    
    return true; // 保持消息通道开放
  });

  // 开始监控变化
  startMonitoring();
}

// 处理鼠标按下事件
function handleMouseDown(e: MouseEvent) {
  if (!isSelecting) return;
  
  console.log('Mouse down in selection mode');
  startX = e.clientX;
  startY = e.clientY;
  
  if (selectionBox) {
    selectionBox.style.display = 'block';
    updateSelectionBox(e.clientX, e.clientY);
  }
}

// 处理鼠标移动事件
function handleMouseMove(e: MouseEvent) {
  if (!isSelecting || !selectionBox) return;
  updateSelectionBox(e.clientX, e.clientY);
}

// 更新选择框位置和大小
function updateSelectionBox(currentX: number, currentY: number) {
  if (!selectionBox) return;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  selectionBox.style.left = left + 'px';
  selectionBox.style.top = top + 'px';
  selectionBox.style.width = width + 'px';
  selectionBox.style.height = height + 'px';
}

// 检查扩展连接状态的函数
function checkConnection(): boolean {
  try {
    // 使用更可靠的方式检查连接
    if (!chrome.runtime?.id) {
      console.debug('Extension disconnected (runtime.id not available)');
      return false;
    }
    return true;
  } catch (e) {
    console.debug('Extension connection check failed:', e);
    return false;
  }
}

// 发送消息到background script的辅助函数
async function sendToBackground(message: any): Promise<any> {
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  while (retryCount < maxRetries) {
    try {
      if (!checkConnection()) {
        console.debug(`[Attempt ${retryCount + 1}/${maxRetries}] Waiting for connection...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
        continue;
      }

      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.debug('Message send failed:', error.message);
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      if (retryCount === maxRetries - 1) {
        console.warn('Failed to send message after retries:', message, error);
        return null;
      }
      console.debug(`[Attempt ${retryCount + 1}/${maxRetries}] Retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryCount++;
    }
  }
  return null;
}

// 处理鼠标松开事件
async function handleMouseUp(e: MouseEvent) {
  if (!isSelecting || !selectionBox) return;

  try {
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    const left = Math.min(e.clientX, startX);
    const top = Math.min(e.clientY, startY);

    const element = document.elementFromPoint(left + width / 2, top + height / 2);
    if (!element) return;

    // Generate a descriptive areaName
    let areaName = element.tagName.toLowerCase();
    if (element.id) {
      areaName += `#${element.id}`;
    } else if (element.className) {
      areaName += `.${element.className.split(' ')[0]}`;
    }
    // Add position info to make it unique
    areaName += `-${left},${top}`;

    const area = {
      id: Date.now().toString(),
      x: left,
      y: top,
      width,
      height,
      element: element as HTMLElement,
      lastValue: element.textContent || '',
      lastStyle: element.getAttribute('style') || '',
      areaName
    };

    const response = await sendToBackground({
      type: 'MONITOR_AREA',
      area
    });

    if (response?.success) {
      console.log('Monitor area confirmed:', response);
    } else {
      console.error('Failed to add monitor area:', response);
    }

    // 隐藏选择框并重置状态
    selectionBox.style.display = 'none';
    isSelecting = false;
    document.body.style.cursor = 'default';
  } catch (error) {
    console.error('Error in handleMouseUp:', error);
    // 确保重置状态
    selectionBox.style.display = 'none';
    isSelecting = false;
    document.body.style.cursor = 'default';
  }
}

// 开始选择
export function startSelection() {
  console.log('Starting selection mode');
  isSelecting = true;
  document.body.style.cursor = 'crosshair';
}

// 取消选择
export function cancelSelection() {
  isSelecting = false;
  if (selectionBox) {
    selectionBox.style.display = 'none';
  }
  document.body.style.cursor = 'default';
}

// 添加监控区域
export function addMonitorArea(area: MonitorArea) {
  monitoredAreas.value.push(area);
  highlightMonitorArea(area);
}

// 高亮显示监控区域
function highlightMonitorArea(area: MonitorArea) {
  // 移除可能存在的旧高亮框
  const existingHighlight = document.querySelector(`[data-monitor-id="${area.id}"]`);
  if (existingHighlight) {
    existingHighlight.remove();
  }

  const highlight = document.createElement('div');
  highlight.style.position = 'fixed';
  highlight.style.left = area.x + 'px';
  highlight.style.top = area.y + 'px';
  highlight.style.width = area.width + 'px';
  highlight.style.height = area.height + 'px';
  highlight.style.border = '2px solid #1890ff';
  highlight.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.2)';
  highlight.style.backgroundColor = 'rgba(24, 144, 255, 0.05)';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '2147483647'; // 最大的 z-index 值
  highlight.style.transition = 'all 0.3s ease-in-out';
  highlight.dataset.monitorId = area.id;
  
  // 添加淡入动画
  highlight.style.animation = 'fadeIn 0.3s ease-in-out';
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(1.1);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(highlight);
}

// 移除监控区域
export function removeMonitorArea(id: string) {
  const index = monitoredAreas.value.findIndex(area => area.id === id);
  if (index !== -1) {
    monitoredAreas.value.splice(index, 1);
    const highlight = document.querySelector(`[data-monitor-id="${id}"]`);
    if (highlight) {
      highlight.remove();
    }
  }
}

// 清除所有监控区域
export function clearMonitorAreas() {
  monitoredAreas.value = [];
  document.querySelectorAll('[data-monitor-id]').forEach(el => el.remove());
}

// 获取监控区域列表
export function getMonitorAreas() {
  return monitoredAreas.value;
}

// 开始监控变化
function startMonitoring() {
  let monitoringInterval: number | null = null;
  let reconnectInterval: number | null = null;
  let isMonitoring = true;
  const MONITORING_INTERVAL = 20000; // 20 seconds
  const RECONNECT_INTERVAL = 5000;  // 5 seconds
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;

  // 监控变化的函数
  async function checkChanges() {
    if (!isMonitoring) return;

    if (!checkConnection()) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`Connection lost for ${MAX_CONSECUTIVE_FAILURES} consecutive checks, pausing monitoring`);
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          monitoringInterval = null;
        }
        startReconnection();
        return;
      }
      return;
    }

    consecutiveFailures = 0; // Reset on successful connection
    
    for (const area of monitoredAreas.value) {
      try {
        if (!document.contains(area.element)) {
          console.warn(`Monitored element ${area.id} no longer exists in DOM`);
          removeMonitorArea(area.id);
          continue;
        }

        const currentValue = area.element.textContent || '';
        const currentStyle = area.element.getAttribute('style') || '';

        if (currentValue !== area.lastValue) {
          await notifyChange(area, 'content', area.lastValue || '', currentValue);
          area.lastValue = currentValue;
        }

        if (currentStyle !== area.lastStyle) {
          await notifyChange(area, 'style', area.lastStyle || '', currentStyle);
          area.lastStyle = currentStyle;
        }
      } catch (error) {
        console.error(`Error monitoring area ${area.id}:`, error);
      }
    }
  }

  // 开始重连
  function startReconnection() {
    if (reconnectInterval) return;
    
    console.debug('Starting reconnection attempts...');
    reconnectInterval = window.setInterval(async () => {
      if (checkConnection()) {
        console.log('Extension connection restored');
        consecutiveFailures = 0;
        if (!monitoringInterval) {
          monitoringInterval = window.setInterval(checkChanges, MONITORING_INTERVAL);
        }
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
      }
    }, RECONNECT_INTERVAL);
  }

  // 启动监控
  monitoringInterval = window.setInterval(checkChanges, MONITORING_INTERVAL);

  // 监听连接状态
  chrome.runtime.onConnect.addListener((port) => {
    console.log('Extension connected');
    consecutiveFailures = 0;
    
    port.onDisconnect.addListener(() => {
      console.warn('Extension disconnected via port');
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
      startReconnection();
    });
  });

  // 监听页面卸载事件
  window.addEventListener('unload', () => {
    isMonitoring = false;
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
    }
  });

  // 立即执行一次检查
  checkChanges();
}

// 发送变化通知
async function notifyChange(area: MonitorArea, type: 'content' | 'style', oldValue: string, newValue: string) {
  if (!checkConnection()) {
    console.warn('Cannot send change notification: extension disconnected');
    return;
  }

  try {
    const response = await sendToBackground({
      type: 'AREA_CHANGED',
      data: {
        areaId: area.id,
        areaName: area.areaName || `${area.element.tagName.toLowerCase()}-${area.id}`,
        elementTag: area.element.tagName.toLowerCase(),
        changeType: type,
        oldValue,
        newValue,
        timestamp: new Date().toISOString()
      }
    });
    
    if (!response?.success) {
      console.warn('Failed to send change notification:', response);
    }
  } catch (error) {
    console.error('Error sending change notification:', error);
  }
}

// 处理错误的辅助函数
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// 高亮显示发生变化的区域
function highlightChangedArea(areaId: string) {
  const area = monitoredAreas.value.find(a => a.id === areaId);
  if (!area) return;

  // 创建临时高亮效果
  const highlight = document.createElement('div');
  highlight.style.position = 'fixed';
  highlight.style.left = area.x + 'px';
  highlight.style.top = area.y + 'px';
  highlight.style.width = area.width + 'px';
  highlight.style.height = area.height + 'px';
  highlight.style.border = '2px solid #ff4d4f';
  highlight.style.backgroundColor = 'rgba(255, 77, 79, 0.2)';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '999999';
  highlight.style.transition = 'all 0.3s ease-in-out';
  
  document.body.appendChild(highlight);

  // 滚动到元素位置
  area.element.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

  // 3秒后移除高亮
  setTimeout(() => {
    highlight.style.opacity = '0';
    setTimeout(() => highlight.remove(), 300);
  }, 3000);
} 