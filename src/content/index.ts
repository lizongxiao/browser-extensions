// Web Monitor Content Script
import { initMonitor, startSelection } from './monitor';

console.log('Web Monitor content script loaded');

// 初始化监控器
initMonitor();

// 性能监控相关变量
interface PerformanceMetrics {
  loadTime: number;
  resourceCount: number;
  errors: Array<{
    message: string;
    source: string;
    line: number;
    timestamp: string;
  }>;
  fps: number;
}

let performanceMetrics: PerformanceMetrics = {
  loadTime: 0,
  resourceCount: 0,
  errors: [],
  fps: 0
};

// 检查扩展连接状态
function isExtensionConnected(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// 安全地发送消息，带重试机制
async function sendMessageSafely(message: any): Promise<any> {
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  while (retryCount < maxRetries) {
    try {
      if (!isExtensionConnected()) {
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
        console.debug('Failed to send message after retries:', message);
        return null;
      }
      console.debug(`[Attempt ${retryCount + 1}/${maxRetries}] Retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryCount++;
    }
  }
  return null;
}

// 初始化性能监控
function initPerformanceMonitoring() {
  let isMonitoring = true;
  let monitoringPort: chrome.runtime.Port | null = null;
  const MONITORING_INTERVAL = 1000; // 1 second for FPS monitoring
  const RECONNECT_INTERVAL = 5000; // 5 seconds for reconnection attempts
  let reconnectTimer: number | null = null;

  // 建立连接
  function establishConnection() {
    try {
      if (!isExtensionConnected()) return false;
      
      monitoringPort = chrome.runtime.connect({ name: 'performance_monitor' });
      monitoringPort.onDisconnect.addListener(() => {
        console.debug('Performance monitoring connection lost');
        monitoringPort = null;
        scheduleReconnection();
      });
      
      return true;
    } catch (error) {
      console.debug('Failed to establish monitoring connection:', error);
      return false;
    }
  }

  // 计划重新连接
  function scheduleReconnection() {
    if (reconnectTimer) return;
    
    reconnectTimer = window.setInterval(() => {
      if (establishConnection()) {
        if (reconnectTimer) {
          clearInterval(reconnectTimer);
          reconnectTimer = null;
        }
      }
    }, RECONNECT_INTERVAL);
  }

  // 监控页面加载时间
  window.addEventListener('load', async () => {
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    performanceMetrics.loadTime = timing.domContentLoadedEventEnd;
    
    // 统计资源数量
    const resources = performance.getEntriesByType('resource');
    performanceMetrics.resourceCount = resources.length;
    
    // 发送初始性能数据
    await sendMessageSafely({
      type: 'performanceData',
      data: performanceMetrics
    });
  });

  // 监控页面错误
  window.addEventListener('error', async (event) => {
    const errorData = {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      timestamp: new Date().toISOString()
    };

    performanceMetrics.errors.push(errorData);

    // 发送错误信息
    await sendMessageSafely({
      type: 'errorOccurred',
      data: errorData
    });
  });

  // 监控 FPS
  let frameCount = 0;
  let lastTime = performance.now();
  let animationFrameId: number;
  
  function measureFPS() {
    if (!isMonitoring) return;
    
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime >= MONITORING_INTERVAL) {
      performanceMetrics.fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;
      
      // 发送 FPS 数据
      sendMessageSafely({
        type: 'fpsData',
        data: performanceMetrics.fps
      }).catch(console.debug);
    }
    
    animationFrameId = requestAnimationFrame(measureFPS);
  }
  
  animationFrameId = requestAnimationFrame(measureFPS);

  // 清理函数
  function cleanup() {
    isMonitoring = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
    if (monitoringPort) {
      try {
        monitoringPort.disconnect();
      } catch (e) {
        console.debug('Error disconnecting port:', e);
      }
      monitoringPort = null;
    }
  }

  // 监听页面卸载事件
  window.addEventListener('unload', cleanup);
  
  // 建立初始连接
  establishConnection();
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug('Content script received message:', message);
  
  try {
    switch (message.type) {
      case 'getPerformanceData':
        sendResponse(performanceMetrics);
        break;
      case 'START_SELECTION':
        startSelection();
        document.body.style.cursor = 'crosshair';
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: String(error) });
  }
  
  return true;
});

// 初始化监控
initPerformanceMonitoring(); 