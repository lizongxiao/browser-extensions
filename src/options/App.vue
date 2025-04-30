<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SettingsPanel from './components/SettingsPanel.vue'
import MonitoringItem from './components/MonitoringItem.vue'
import { MonitoringItem as MonitoringItemType, AppSettings } from '../types/monitoringTypes'

// 状态
const monitoringItems = ref<MonitoringItemType[]>([])
const isLoading = ref<boolean>(true)

// 生命周期钩子
onMounted(async () => {
  await loadMonitoringItems()
  isLoading.value = false
})

// 加载监控项目
const loadMonitoringItems = async () => {
  const result = await chrome.storage.local.get('savedSelections')
  let savedSelections: MonitoringItemType[] = result.savedSelections || []
  
  // 按时间降序排序，最新的在前面
  savedSelections.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
  
  monitoringItems.value = savedSelections
}

// 删除监控项
const deleteMonitoringItem = async (id: string) => {
  const result = await chrome.storage.local.get('savedSelections')
  let savedSelections: MonitoringItemType[] = result.savedSelections || []
  
  // 过滤掉要删除的项目
  savedSelections = savedSelections.filter(item => item.id !== id)
  
  // 保存回存储
  await chrome.storage.local.set({ savedSelections })
  
  // 更新本地状态
  monitoringItems.value = monitoringItems.value.filter(item => item.id !== id)
}

// 清除更新状态
const clearUpdateStatus = async (id: string) => {
  const result = await chrome.storage.local.get('savedSelections')
  let savedSelections: MonitoringItemType[] = result.savedSelections || []
  
  // 更新项目，移除更新标记
  const updatedSelections = savedSelections.map(item => {
    if (item.id === id) {
      return {
        ...item,
        hasUpdates: false
      }
    }
    return item
  })
  
  // 保存回存储
  await chrome.storage.local.set({ savedSelections: updatedSelections })
  
  // 更新本地状态
  monitoringItems.value = monitoringItems.value.map(item => {
    if (item.id === id) {
      return {
        ...item,
        hasUpdates: false
      }
    }
    return item
  })
}

// 设置已保存
const handleSettingsSaved = (settings: AppSettings) => {
  console.log('设置已保存:', settings)
}
</script>

<template>
  <div class="container">
    <h1>网页更新监控配置</h1>
    
    <SettingsPanel @settings-saved="handleSettingsSaved" />
    
    <h2>监控项目列表</h2>
    
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
    <div v-else>
      <!-- 有监控项目时显示列表 -->
      <div v-if="monitoringItems.length > 0">
        <MonitoringItem 
          v-for="item in monitoringItems" 
          :key="item.id"
          :item="item"
          @delete-item="deleteMonitoringItem"
          @clear-update="clearUpdateStatus"
        />
      </div>
      
      <!-- 没有监控项目时显示空状态 -->
      <div v-else class="empty-state">
        <p>暂无监控项目</p>
        <p>请打开想要监控的网页，使用Ctrl+Shift+U (Mac: Command+Shift+U)激活选择模式进行添加</p>
      </div>
    </div>
  </div>
</template>

<style>
.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}
</style> 