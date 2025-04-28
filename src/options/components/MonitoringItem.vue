<script setup lang="ts">
import { computed } from 'vue'
import { MonitoringItem } from '../../types/monitoringTypes'

const props = defineProps<{
  item: MonitoringItem
}>()

const emit = defineEmits<{
  (e: 'delete-item', id: string): void
  (e: 'clear-update', id: string): void
}>()

// 格式化时间
const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`
}

// 数字补零
const padZero = (num: number): string => {
  return num < 10 ? `0${num}` : num.toString()
}

// 计算属性：预览内容
const previewContent = computed(() => {
  if (props.item.selectionType === 'elements') {
    if (props.item.elements && props.item.elements.length > 0) {
      return props.item.elements.map(e => e.innerText || 'HTML元素').join(' | ').substring(0, 200) + '...'
    }
    return '无预览内容'
  } else {
    return (props.item.innerText || '').substring(0, 200) + '...'
  }
})

// 查看页面
const viewPage = () => {
  chrome.tabs.create({ url: props.item.url })
}

// 删除监控项
const deleteItem = () => {
  emit('delete-item', props.item.id)
}

// 清除更新标记
const clearUpdate = () => {
  emit('clear-update', props.item.id)
}
</script>

<template>
  <div class="monitoring-item">
    <div class="item-header">
      <div>
        <div class="title">{{ item.title || '未命名监控项' }}</div>
        <div class="url">{{ item.url || '未知URL' }}</div>
        
        <span 
          class="badge" 
          :class="item.selectionType === 'elements' ? 'element-badge' : 'region-badge'"
        >
          {{ item.selectionType === 'elements' ? '元素监控' : '区域监控' }}
        </span>
        
        <span 
          v-if="item.hasUpdates" 
          class="badge" 
          style="background-color: #e74c3c; color: white"
        >
          有更新
        </span>
        
        <div class="timestamp">
          最后检查: {{ formatTime(item.lastCheck || item.timestamp) }}
        </div>
      </div>
    </div>
    
    <div class="content-preview">
      {{ previewContent }}
    </div>
    
    <div class="buttons">
      <button class="view-btn" @click="viewPage">查看页面</button>
      
      <button 
        v-if="item.hasUpdates" 
        class="view-btn" 
        style="background-color: #3498db"
        @click="clearUpdate"
      >
        清除更新标记
      </button>
      
      <button class="delete-btn" @click="deleteItem">删除监控</button>
    </div>
  </div>
</template> 