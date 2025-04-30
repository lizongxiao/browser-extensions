<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseMonitoringItem } from '../../types/monitoringTypes';

const props = defineProps<{
  item: BaseMonitoringItem;
}>();

// State
const expanded = ref(false);

// Computed properties
const hasHistory = computed(() => {
  return props.item.contentHistory && props.item.contentHistory.length > 0;
});

const formattedHistory = computed(() => {
  if (!props.item.contentHistory) return [];
  
  return props.item.contentHistory.map((entry, index) => ({
    index,
    content: entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : ''),
    formattedDate: formatDate(entry.timestamp)
  }));
});

// Helper functions
const formatDate = (timestamp: number | string) => {
  let time: number;
  if (typeof timestamp === 'string') {
    time = parseInt(timestamp, 10);
  } else {
    time = timestamp;
  }
  
  if (isNaN(time)) return "无效时间";
  
  const date = new Date(time);
  return date.toLocaleString();
};

// Toggle expanded state
const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

const hasDiffInfo = computed(() => {
  return props.item.lastDiff && 
         (props.item.lastDiff.added.length > 0 || props.item.lastDiff.removed.length > 0);
});
</script>

<template>
  <div class="simple-history-view">
    <div v-if="!hasHistory" class="no-history">
      <p>暂无内容历史记录</p>
    </div>
    
    <template v-else>
      <div class="history-header" @click="toggleExpanded">
        <div class="history-title">历史版本 ({{ item.contentHistory.length }})</div>
        <div class="expand-icon">{{ expanded ? '▼' : '▶' }}</div>
      </div>
      
      <div v-if="expanded" class="history-content">
        <!-- 最后检测到的变化 -->
        <div v-if="hasDiffInfo" class="diff-section">
          <div class="section-title">最近变化:</div>
          
          <div v-if="item.lastDiff?.added.length" class="diff-item added">
            <div v-if="item.lastDiff.added.length === 1">
              <strong>+</strong> {{ item.lastDiff.added[0] }}
            </div>
            <div v-else>
              <strong>+</strong> {{ item.lastDiff.added.length }} 行新增
            </div>
          </div>
          
          <div v-if="item.lastDiff?.removed.length" class="diff-item removed">
            <div v-if="item.lastDiff.removed.length === 1">
              <strong>-</strong> {{ item.lastDiff.removed[0] }}
            </div>
            <div v-else>
              <strong>-</strong> {{ item.lastDiff.removed.length }} 行删除
            </div>
          </div>
        </div>
        
        <!-- 历史版本列表 -->
        <div class="timeline">
          <div 
            v-for="entry in formattedHistory.slice(0, 3)" 
            :key="entry.index" 
            class="timeline-item"
          >
            <div class="history-date">{{ entry.formattedDate }}</div>
            <div class="history-preview">{{ entry.content }}</div>
          </div>
          
          <div v-if="formattedHistory.length > 3" class="more-history">
            ...还有 {{ formattedHistory.length - 3 }} 个历史版本
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.simple-history-view {
  margin-top: 12px;
  background-color: #f5f9ff;
  border-radius: 4px;
  border: 1px solid #e0eaf7;
  overflow: hidden;
}

.no-history {
  padding: 8px 12px;
  font-size: 12px;
  color: #666;
  text-align: center;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #e6f3ff;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-header:hover {
  background-color: #d6ebff;
}

.history-title {
  font-weight: 600;
  font-size: 13px;
  color: #0366d6;
}

.expand-icon {
  font-size: 10px;
  color: #555;
}

.history-content {
  padding: 8px 12px;
}

.section-title {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 6px;
  color: #555;
}

.diff-section {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e1e4e8;
}

.diff-item {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.diff-item.added {
  background-color: #e6ffed;
  color: #22863a;
}

.diff-item.removed {
  background-color: #ffeef0;
  color: #cb2431;
}

.timeline {
  font-size: 12px;
}

.timeline-item {
  margin-bottom: 6px;
  padding: 4px 0;
  border-left: 2px solid #0366d6;
  padding-left: 8px;
}

.history-date {
  font-size: 11px;
  color: #586069;
  margin-bottom: 2px;
}

.history-preview {
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-history {
  font-size: 11px;
  color: #586069;
  text-align: center;
  padding: 4px 0;
  font-style: italic;
}
</style> 