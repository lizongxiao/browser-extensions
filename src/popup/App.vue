<template>
  <div class="container">
    <h2>网页更新监控</h2>
    
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
    
    <div v-else-if="selectedItem">
      <!-- 显示选中的监控项详情 -->
      <div class="back-nav">
        <button class="back-btn" @click="clearSelectedItem">
          &larr; 返回列表
        </button>
      </div>
      
      <ItemDetailsView 
        :item="selectedItem" 
        @clear-update="clearUpdateStatus"
      />
    </div>
    
    <div v-else-if="monitoringItems.length > 0" class="item-list">
      <p class="summary">当前共有 {{ totalItemsCount }} 个监控项{{ updatesCount > 0 ? `，${updatesCount} 个有更新` : '' }}</p>
      
      <div 
        v-for="item in monitoringItems" 
        :key="item.id" 
        class="item-summary" 
        :class="{ 'has-updates': item.hasUpdates }"
        @click="selectItem(item)"
      >
        <div class="item-title">{{ item.title || '未命名监控项' }}</div>
        <div class="item-url">{{ item.url }}</div>
        <div class="item-badges">
          <span class="badge" :class="item.selectionType === 'elements' ? 'element-badge' : 'region-badge'">
            {{ item.selectionType === 'elements' ? '元素监控' : '区域监控' }}
          </span>
          <span v-if="item.hasUpdates" class="update-badge">有更新!</span>
        </div>
      </div>
      
      <div class="actions">
        <button class="options-btn" @click="openOptionsPage">管理监控项</button>
        <button v-if="updatesCount > 0" class="clear-all-btn" @click="clearAllUpdates">全部标为已读</button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <p>暂无监控项</p>
      <p>请打开想要监控的网页，使用 Ctrl+Shift+U (Mac: Command+Shift+U) 激活选择模式添加监控。</p>
      <button class="options-btn" @click="openOptionsPage">前往设置</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { MonitoringItem } from "../types/monitoringTypes";
import ItemDetailsView from "./components/ItemDetailsView.vue";

// 状态
const monitoringItems = ref<MonitoringItem[]>([]);
const allMonitoringItems = ref<MonitoringItem[]>([]);
const isLoading = ref<boolean>(true);
const selectedItem = ref<MonitoringItem | null>(null);

// 计算属性
const updatesCount = computed(() => {
  return allMonitoringItems.value.filter(item => item.hasUpdates).length;
});

const totalItemsCount = computed(() => {
  return allMonitoringItems.value.length;
});

// 生命周期钩子
onMounted(async () => {
  await loadMonitoringItems();
  isLoading.value = false;
});

// 加载监控项
const loadMonitoringItems = async () => {
  const result = await chrome.storage.local.get('savedSelections');
  const savedSelections: MonitoringItem[] = result.savedSelections || [];
  
  // 保存全部监控项
  allMonitoringItems.value = savedSelections;
  
  // 按更新状态和时间排序
  savedSelections.sort((a, b) => {
    // 首先按是否有更新排序
    if (a.hasUpdates && !b.hasUpdates) return -1;
    if (!a.hasUpdates && b.hasUpdates) return 1;
    
    // 然后按时间倒序排序
    if (typeof a.timestamp === 'string') a.timestamp = new Date(a.timestamp).getTime();
    if (typeof b.timestamp === 'string') b.timestamp = new Date(b.timestamp).getTime();
    
    return b.timestamp - a.timestamp;
  });
  
  monitoringItems.value = savedSelections.slice(0, 5); // 只显示前5项
};

// 选择项目查看详情
const selectItem = (item: MonitoringItem) => {
  selectedItem.value = item;
};

// 清除选中项目，返回列表
const clearSelectedItem = () => {
  // 如果选中的项目状态有改变，刷新列表
  if (selectedItem.value) {
    const currentItemId = selectedItem.value.id;
    loadMonitoringItems().then(() => {
      selectedItem.value = null;
    });
  } else {
    selectedItem.value = null;
  }
};

// 清除更新状态
const clearUpdateStatus = async (id: string) => {
  const result = await chrome.storage.local.get('savedSelections');
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
  await chrome.storage.local.set({ savedSelections: updatedSelections });
  
  // 如果当前在详情页，更新选中的项目
  if (selectedItem.value && selectedItem.value.id === id) {
    selectedItem.value = {
      ...selectedItem.value,
      hasUpdates: false
    };
  }
  
  // 重新加载列表
  await loadMonitoringItems();
};

// 清除所有更新标记
const clearAllUpdates = async () => {
  const result = await chrome.storage.local.get('savedSelections');
  let savedSelections: MonitoringItem[] = result.savedSelections || [];
  
  // 更新所有项目，移除更新标记
  const updatedSelections = savedSelections.map(item => {
    if (item.hasUpdates) {
      return {
        ...item,
        hasUpdates: false
      };
    }
    return item;
  });
  
  // 保存回存储
  await chrome.storage.local.set({ savedSelections: updatedSelections });
  
  // 如果当前在详情页，更新选中的项目
  if (selectedItem.value) {
    selectedItem.value = {
      ...selectedItem.value,
      hasUpdates: false
    };
  }
  
  // 重新加载列表
  await loadMonitoringItems();
};

// 打开选项页
const openOptionsPage = () => {
  chrome.runtime.openOptionsPage();
};
</script>

<style scoped>
.container {
  padding: 16px;
  min-width: 300px;
  max-width: 350px;
}

h2 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 18px;
  margin-bottom: 16px;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.summary {
  margin-bottom: 12px;
  color: #666;
  font-size: 14px;
  text-align: center;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-summary {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  background-color: #f9f9f9;
  transition: all 0.2s ease;
  cursor: pointer;
}

.item-summary:hover {
  background-color: #f0f0f0;
  border-color: #bbb;
}

.item-summary.has-updates {
  border-left: 3px solid #e74c3c;
  background-color: #fff8f8;
}

.item-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.item-url {
  font-size: 12px;
  color: #3498db;
  word-break: break-all;
  margin-bottom: 6px;
}

.item-badges {
  display: flex;
  gap: 6px;
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.element-badge {
  background-color: #2ecc71;
  color: white;
}

.region-badge {
  background-color: #f39c12;
  color: white;
}

.update-badge {
  background-color: #e74c3c;
  color: white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}

.actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.options-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  flex: 1;
}

.options-btn:hover {
  background-color: #2980b9;
}

.clear-all-btn {
  background-color: #f39c12;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
  flex: 1;
}

.clear-all-btn:hover {
  background-color: #e67e22;
}

.empty-state {
  text-align: center;
  padding: 20px 10px;
  color: #666;
}

.empty-state p {
  margin-bottom: 12px;
  font-size: 14px;
}

.back-nav {
  margin-bottom: 12px;
}

.back-btn {
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  display: flex;
  align-items: center;
}

.back-btn:hover {
  color: #2980b9;
  text-decoration: underline;
}
</style>
