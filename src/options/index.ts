import { MonitoringItem, AppSettings } from "../types/monitoringTypes";

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  // 加载保存的监控项
  loadMonitoringItems();
  
  // 加载设置
  loadSettings();
  
  // 绑定保存设置按钮事件
  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
});

// 加载监控项目
function loadMonitoringItems(): void {
  chrome.storage.local.get('savedSelections', (result) => {
    const monitoringList = document.getElementById('monitoringList');
    if (!monitoringList) return;
    
    const savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    // 如果没有监控项，显示默认空状态
    if (savedSelections.length === 0) {
      return;
    }
    
    // 清空列表
    monitoringList.innerHTML = '';
    
    // 按时间降序排序，最新的在前面
    savedSelections.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // 添加每个监控项
    savedSelections.forEach(item => {
      const card = createMonitoringItemCard(item);
      monitoringList.appendChild(card);
    });
  });
}

// 创建监控项卡片
function createMonitoringItemCard(item: MonitoringItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'monitoring-item';
  card.dataset.id = item.id;
  
  // 创建卡片头部
  const header = document.createElement('div');
  header.className = 'item-header';
  
  // 左侧信息
  const info = document.createElement('div');
  
  // 添加标题
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = item.title || '未命名监控项';
  info.appendChild(title);
  
  // 添加URL
  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = item.url || '未知URL';
  info.appendChild(url);
  
  // 添加类型标签
  const typeLabel = document.createElement('span');
  typeLabel.className = `badge ${item.selectionType === 'elements' ? 'element-badge' : 'region-badge'}`;
  typeLabel.textContent = item.selectionType === 'elements' ? '元素监控' : '区域监控';
  info.appendChild(typeLabel);
  
  // 添加更新状态
  if (item.hasUpdates) {
    const updateBadge = document.createElement('span');
    updateBadge.className = 'badge';
    updateBadge.style.backgroundColor = '#e74c3c';
    updateBadge.style.color = 'white';
    updateBadge.textContent = '有更新';
    info.appendChild(updateBadge);
  }
  
  // 添加最后检查时间
  const lastCheck = document.createElement('div');
  lastCheck.className = 'timestamp';
  const lastCheckTime = new Date(item.lastCheck || item.timestamp);
  lastCheck.textContent = `最后检查: ${formatTime(lastCheckTime)}`;
  info.appendChild(lastCheck);
  
  header.appendChild(info);
  card.appendChild(header);
  
  // 添加内容预览
  const preview = document.createElement('div');
  preview.className = 'content-preview';
  
  if (item.selectionType === 'elements') {
    // 元素监控预览元素内容
    if (item.elements && item.elements.length > 0) {
      preview.textContent = item.elements.map(e => e.innerText || 'HTML元素').join(' | ').substring(0, 200) + '...';
    } else {
      preview.textContent = '无预览内容';
    }
  } else {
    // 区域监控预览区域文本内容
    preview.textContent = (item.innerText || '').substring(0, 200) + '...';
  }
  
  card.appendChild(preview);
  
  // 添加按钮组
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  
  // 查看按钮
  const viewBtn = document.createElement('button');
  viewBtn.className = 'view-btn';
  viewBtn.textContent = '查看页面';
  viewBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: item.url });
  });
  buttons.appendChild(viewBtn);
  
  // 如果有更新，添加清除更新状态按钮
  if (item.hasUpdates) {
    const clearUpdateBtn = document.createElement('button');
    clearUpdateBtn.className = 'view-btn';
    clearUpdateBtn.style.backgroundColor = '#3498db';
    clearUpdateBtn.textContent = '清除更新标记';
    clearUpdateBtn.addEventListener('click', () => {
      clearUpdateStatus(item.id);
    });
    buttons.appendChild(clearUpdateBtn);
  }
  
  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '删除监控';
  deleteBtn.addEventListener('click', () => {
    deleteMonitoringItem(item.id);
  });
  buttons.appendChild(deleteBtn);
  
  card.appendChild(buttons);
  
  return card;
}

// 清除更新状态
function clearUpdateStatus(id: string): void {
  chrome.storage.local.get('savedSelections', (result) => {
    let savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    // 更新项目，移除更新标记
    const updatedSelections = savedSelections.map(item => {
      if (item.id === id) {
        return {
          ...item,
          hasUpdates: false
        };
      }
      return item;
    });
    
    // 保存回存储
    chrome.storage.local.set({ savedSelections: updatedSelections }, () => {
      // 刷新列表
      loadMonitoringItems();
    });
  });
}

// 删除监控项
function deleteMonitoringItem(id: string): void {
  chrome.storage.local.get('savedSelections', (result) => {
    let savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    // 过滤掉要删除的项目
    savedSelections = savedSelections.filter(item => item.id !== id);
    
    // 保存回存储
    chrome.storage.local.set({ savedSelections }, () => {
      // 从DOM中移除
      const itemElement = document.querySelector(`.monitoring-item[data-id="${id}"]`);
      if (itemElement) {
        itemElement.remove();
      }
      
      // 如果列表为空，显示空状态
      if (savedSelections.length === 0) {
        const monitoringList = document.getElementById('monitoringList');
        if (monitoringList) {
          monitoringList.innerHTML = `
            <div class="empty-state">
              <p>暂无监控项目</p>
              <p>请打开想要监控的网页，使用Ctrl+Shift+U (Mac: Command+Shift+U)激活选择模式进行添加</p>
            </div>
          `;
        }
      }
    });
  });
}

// 加载设置
function loadSettings(): void {
  chrome.storage.local.get('settings', (result) => {
    const settings: AppSettings = result.settings || { checkInterval: 30 };
    const intervalSelect = document.getElementById('checkInterval') as HTMLSelectElement | null;
    
    if (!intervalSelect) return;
    
    // 设置选中的检查间隔
    for (let i = 0; i < intervalSelect.options.length; i++) {
      if (intervalSelect.options[i].value == settings.checkInterval.toString()) {
        intervalSelect.selectedIndex = i;
        break;
      }
    }
  });
}

// 保存设置
function saveSettings(): void {
  const intervalSelect = document.getElementById('checkInterval') as HTMLSelectElement | null;
  if (!intervalSelect) return;
  
  const checkInterval = intervalSelect.value;
  const settings: AppSettings = {
    checkInterval: parseInt(checkInterval, 10)
  };
  
  chrome.storage.local.set({ settings }, () => {
    // 显示保存成功提示
    const saveBtn = document.getElementById('saveSettings');
    if (!saveBtn) return;
    
    const originalText = saveBtn.textContent || '';
    saveBtn.textContent = '已保存';
    saveBtn.setAttribute('disabled', 'true');
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.removeAttribute('disabled');
    }, 2000);
  });
}

// 格式化时间
function formatTime(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

// 数字补零
function padZero(num: number): string {
  return num < 10 ? `0${num}` : num.toString();
} 