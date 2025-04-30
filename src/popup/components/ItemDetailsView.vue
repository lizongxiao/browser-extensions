<script setup lang="ts">
import { computed, ref } from 'vue';
import { MonitoringItem } from '../../types/monitoringTypes';
import SimpleContentHistoryView from './SimpleContentHistoryView.vue';

const props = defineProps<{
  item: MonitoringItem;
}>();

const emit = defineEmits<{
  (e: "clear-update", id: string): void;
}>();

// State
const showDiff = ref(false);

// 格式化时间
const formatTime = (timestamp: number | string) => {
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

// 计算属性：上次内容与当前内容的差异
const contentDiff = computed(() => {
  // 如果没有更新，返回空
  if (!props.item.hasUpdates) {
    return { hasChanges: false };
  }

  // 获取最新的差异信息
  if (props.item.lastDiff) {
    return {
      added: props.item.lastDiff.added,
      removed: props.item.lastDiff.removed,
      timestamp: props.item.lastDiff.timestamp,
      hasChanges: props.item.lastDiff.added.length > 0 || props.item.lastDiff.removed.length > 0
    };
  }

  return { hasChanges: false };
});

// 计算属性：是否有历史记录
const hasHistory = computed(() => {
  return props.item.contentHistory && props.item.contentHistory.length > 0;
});

// 切换显示更新内容
const toggleDiff = () => {
  showDiff.value = !showDiff.value;
};

// 打开页面
const viewPage = () => {
  chrome.tabs.create({ url: props.item.url });
};

// 查看选项页
const openOptionsPage = () => {
  chrome.runtime.openOptionsPage();
};

// 清除更新标记
const clearUpdate = () => {
  emit("clear-update", props.item.id);
};
</script>

<template>
  <div class="item-details">
    <div class="item-header">
      <h3>{{ item.title || "未命名监控项" }}</h3>
      <div class="item-url">{{ item.url }}</div>
      
      <div class="item-badges">
        <span
          class="badge"
          :class="
            item.selectionType === 'elements'
              ? 'element-badge'
              : 'region-badge'
          ">
          {{ item.selectionType === "elements" ? "元素监控" : "区域监控" }}
        </span>
        
        <span v-if="item.hasUpdates" class="update-badge">
          有更新
        </span>
      </div>
      
      <div class="item-timestamp">
        最后检查: {{ formatTime(item.lastCheck || item.timestamp) }}
      </div>
    </div>
    
    <!-- 差异信息显示 -->
    <div v-if="item.hasUpdates" class="diff-container">
      <div class="diff-header" @click="toggleDiff">
        <div class="diff-title">内容变更</div>
        <div class="expand-icon">{{ showDiff ? '▼' : '▶' }}</div>
      </div>
      
      <div v-if="showDiff && contentDiff.hasChanges" class="diff-content">
        <div v-if="contentDiff.added && contentDiff.added.length > 0" class="diff-preview added">
          <strong>新增内容:</strong> 
          <div v-for="(line, index) in contentDiff.added.slice(0, 3)" :key="`added-${index}`" class="diff-line">
            + {{ line }}
          </div>
          <div v-if="contentDiff.added.length > 3" class="more-diff">
            ...还有 {{ contentDiff.added.length - 3 }} 项新增内容
          </div>
        </div>
        
        <div v-if="contentDiff.removed && contentDiff.removed.length > 0" class="diff-preview removed">
          <strong>删除内容:</strong> 
          <div v-for="(line, index) in contentDiff.removed.slice(0, 3)" :key="`removed-${index}`" class="diff-line">
            - {{ line }}
          </div>
          <div v-if="contentDiff.removed.length > 3" class="more-diff">
            ...还有 {{ contentDiff.removed.length - 3 }} 项删除内容
          </div>
        </div>
      </div>
    </div>
    
    <!-- 历史记录组件 -->
    <SimpleContentHistoryView :item="item" />
    
    <!-- 按钮操作 -->
    <div class="actions">
      <button class="view-btn" @click="viewPage">查看页面</button>
      <button v-if="item.hasUpdates" class="clear-btn" @click="clearUpdate">标记已读</button>
      <button class="details-btn" @click="openOptionsPage">完整详情</button>
    </div>
  </div>
</template>

<style scoped>
.item-details {
  padding: 12px;
  background-color: white;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.item-header {
  margin-bottom: 12px;
}

h3 {
  margin: 0 0 6px 0;
  color: #2c3e50;
  font-size: 16px;
}

.item-url {
  font-size: 12px;
  color: #3498db;
  word-break: break-all;
  margin-bottom: 6px;
}

.item-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
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
}

.item-timestamp {
  font-size: 11px;
  color: #777;
}

.diff-container {
  margin-bottom: 12px;
  background-color: #fff8f8;
  border-radius: 4px;
  border: 1px solid #f7d6d6;
  overflow: hidden;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #ffeaea;
  cursor: pointer;
  transition: background-color 0.2s;
}

.diff-header:hover {
  background-color: #ffe0e0;
}

.diff-title {
  font-weight: 600;
  font-size: 13px;
  color: #e74c3c;
}

.expand-icon {
  font-size: 10px;
  color: #555;
}

.diff-content {
  padding: 8px 12px;
}

.diff-preview {
  padding: 6px 8px;
  border-radius: 3px;
  margin-bottom: 8px;
  font-size: 12px;
}

.diff-preview.added {
  background-color: #e6ffed;
  color: #22863a;
}

.diff-preview.removed {
  background-color: #ffeef0;
  color: #cb2431;
}

.diff-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 2px 0;
}

.more-diff {
  font-size: 11px;
  font-style: italic;
  margin-top: 4px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.view-btn {
  background-color: #3498db;
  color: white;
  flex: 1;
}

.view-btn:hover {
  background-color: #2980b9;
}

.clear-btn {
  background-color: #f39c12;
  color: white;
  flex: 1;
}

.clear-btn:hover {
  background-color: #e67e22;
}

.details-btn {
  background-color: #95a5a6;
  color: white;
  flex: 1;
}

.details-btn:hover {
  background-color: #7f8c8d;
}
</style> 