<script setup lang="ts">
import { computed, ref } from "vue";
import { MonitoringItem } from "../../types/monitoringTypes";
import HtmlSandbox from "./HtmlSandbox.vue";
import ContentHistoryView from "./ContentHistoryView.vue";

const props = defineProps<{
  item: MonitoringItem;
}>();

const emit = defineEmits<{
  (e: "delete-item", id: string): void;
  (e: "clear-update", id: string): void;
}>();

// 状态
const showHtmlPreview = ref(false);
const previewMode = ref<"text" | "html" | "raw">("html");
const showChanges = ref(false);
const showHistory = ref(false);

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

// 计算属性：预览内容
const previewContent = computed(() => {
  if (props.item.selectionType === "elements") {
    if (props.item.elements && props.item.elements.length > 0) {
      return (
        props.item.elements
          .map((e) => e.innerText || "HTML元素")
          .join(" | ")
          .substring(0, 200) + "..."
      );
    }
    return "无预览内容";
  } else {
    return (props.item.innerText || "").substring(0, 200) + "...";
  }
});

// 计算属性：HTML内容
const htmlContent = computed(() => {
  if (props.item.selectionType === "elements") {
    if (props.item.elements && props.item.elements.length > 0) {
      return props.item.elements.map((e) => e.html || "").join("");
    }
    return "";
  } else {
    return props.item.html || "";
  }
});

// 计算属性：原始HTML源码
const rawHtmlContent = computed(() => {
  const content = htmlContent.value;
  return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
});

// 计算属性：上次内容与当前内容的差异
const contentDiff = computed(() => {
  // 如果没有更新，返回空
  if (!props.item.hasUpdates) {
    return { text: "无变更", hasChanges: false };
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

  // 简化的文本比较 - 实际项目中可以使用更复杂的差异算法
  let oldText = "";
  let newText = "";

  if (props.item.selectionType === "elements") {
    // 对于元素监控，比较元素文本内容
    if (props.item.elements && props.item.elements.length > 0) {
      newText = props.item.elements.map((e) => e.innerText || "").join(" ");
    }
  } else {
    // 对于区域监控，比较整个区域的文本内容
    newText = props.item.innerText || "";
  }

  // 简单返回新内容，因为我们没有保存旧的innerText
  return {
    text: newText.substring(0, 500),
    hasChanges: true,
  };
});

// 值范围监控相关的计算属性
const currentValueStr = computed(() => {
  if (props.item.valueRange && props.item.valueRange.currentValue !== undefined) {
    return String(props.item.valueRange.currentValue);
  }
  return '';
});

const notificationCountStr = computed(() => {
  if (props.item.valueRange && props.item.valueRange.notificationCount !== undefined) {
    return String(props.item.valueRange.notificationCount);
  }
  return '0';
});

const maxNotificationsStr = computed(() => {
  if (props.item.valueRange && props.item.valueRange.maxNotifications !== undefined) {
    return String(props.item.valueRange.maxNotifications);
  }
  return '0';
});

const minValueStr = computed(() => {
  if (props.item.valueRange && props.item.valueRange.minValue !== undefined) {
    return String(props.item.valueRange.minValue);
  }
  return '';
});

const maxValueStr = computed(() => {
  if (props.item.valueRange && props.item.valueRange.maxValue !== undefined) {
    return String(props.item.valueRange.maxValue);
  }
  return '';
});

// 切换历史视图显示
const toggleHistory = () => {
  showHistory.value = !showHistory.value;
};

// 切换预览模式
const setPreviewMode = (mode: "text" | "html" | "raw") => {
  previewMode.value = mode;
};

// 切换显示变更内容
const toggleChanges = () => {
  showChanges.value = !showChanges.value;
};

// 查看页面
const viewPage = () => {
  chrome.tabs.create({ url: props.item.url });
};

// 删除监控项
const deleteItem = () => {
  emit("delete-item", props.item.id);
};

// 清除更新标记
const clearUpdate = () => {
  emit("clear-update", props.item.id);
};
</script>

<template>
  <div class="monitoring-item" :class="{ 'has-updates': item.hasUpdates }">
    <!-- 更新标记 -->
    <div v-if="item.hasUpdates" class="update-badge">
      <span class="update-icon">🔔</span>
    </div>

    <div class="item-header">
      <div>
        <div class="title">{{ item.title || "未命名监控项" }}</div>
        <div class="url">{{ item.url || "未知URL" }}</div>

        <div class="badges">
          <span
            class="badge"
            :class="
              item.selectionType === 'elements'
                ? 'element-badge'
                : 'region-badge'
            ">
            {{ item.selectionType === "elements" ? "元素监控" : "区域监控" }}
          </span>

          <span
            v-if="item.hasUpdates"
            class="badge update-badge-inline"
            @click="toggleChanges">
            有更新
            <span class="toggle-icon">{{ showChanges ? "▼" : "▶" }}</span>
          </span>
          
          <!-- 添加值范围监控标记 -->
          <span
            v-if="item.valueRange && item.valueRange.enabled"
            class="badge value-range-badge">
            数值监控 
            <span v-if="item.valueRange.currentValue !== undefined">
              (当前: {{ currentValueStr }})
            </span>
          </span>
          
          <!-- 添加通知计数标记 -->
          <span
            v-if="item.valueRange && item.valueRange.enabled && item.valueRange.notificationCount"
            class="badge notification-count-badge">
            已通知 {{ notificationCountStr }}/{{ maxNotificationsStr }}
          </span>
        </div>

        <div class="timestamp">
          最后检查: {{ formatTime(item.lastCheck || item.timestamp) }}
        </div>
      </div>
    </div>

    <!-- 值范围监控信息 -->
    <div v-if="item.valueRange && item.valueRange.enabled" class="value-range-container">
      <div class="value-range-header">
        <span class="value-range-title">数值监控设置</span>
      </div>
      <div class="value-range-content">
        <div class="value-range-info">
          <div v-if="item.valueRange.minValue !== undefined && item.valueRange.maxValue !== undefined">
            监控范围: {{ minValueStr }} - {{ maxValueStr }}
          </div>
          <div v-else-if="item.valueRange.minValue !== undefined">
            监控最小值: {{ minValueStr }} (超过此值时通知)
          </div>
          <div v-else-if="item.valueRange.maxValue !== undefined">
            监控最大值: {{ maxValueStr }} (超过此值时通知)
          </div>
          <div v-if="item.valueRange.currentValue !== undefined">
            当前检测到的值: {{ currentValueStr }}
          </div>
          <div v-if="item.valueRange.maxNotifications > 0">
            最大通知次数: {{ maxNotificationsStr }}
            <span v-if="item.valueRange.notificationCount">
              (已通知 {{ notificationCountStr }} 次)
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新内容展示 -->
    <div v-if="item.hasUpdates && showChanges" class="updates-container">
      <div class="update-header">
        <span class="update-title">更新内容</span>
        <span class="timestamp"
          >更新时间: {{ formatTime(item.lastCheck || item.timestamp) }}</span
        >
      </div>

      <div class="update-content">
        <div v-if="contentDiff.hasChanges" class="update-preview">
          <div v-if="contentDiff.added && contentDiff.removed" class="content-changes">
            <div v-if="contentDiff.added.length > 0" class="added-content">
              <h4>添加的内容:</h4>
              <p v-for="(line, index) in contentDiff.added" :key="`added-${index}`" class="added-line">+ {{ line }}</p>
            </div>
            <div v-if="contentDiff.removed.length > 0" class="removed-content">
              <h4>删除的内容:</h4>
              <p v-for="(line, index) in contentDiff.removed" :key="`removed-${index}`" class="removed-line">- {{ line }}</p>
            </div>
          </div>
          <div v-else class="content-changes">
            <p>{{ contentDiff.text }}</p>
          </div>
        </div>
        <div v-else class="no-changes">
          检测到内容变化，但无法显示具体差异
        </div>
      </div>
    </div>

    <!-- 历史版本展示 - 使用新的ContentHistoryView组件 -->
    <ContentHistoryView v-if="showHistory" :item="item" />

    <!-- 内容预览切换 -->
    <div class="preview-toggle">
      <button
        class="toggle-btn"
        :class="{ active: previewMode === 'html' }"
        @click="setPreviewMode('html')">
        HTML渲染
      </button>
      <button
        class="toggle-btn"
        :class="{ active: previewMode === 'text' }"
        @click="setPreviewMode('text')">
        文本预览
      </button>
      <button
        class="toggle-btn"
        :class="{ active: previewMode === 'raw' }"
        @click="setPreviewMode('raw')">
        源代码
      </button>
    </div>

    <!-- 文本预览 -->
    <div v-if="previewMode === 'text'" class="content-preview">
      {{ previewContent }}
    </div>

    <!-- HTML渲染 -->
    <div v-else-if="previewMode === 'html'" class="html-preview-container">
      <HtmlSandbox :html="htmlContent" :maxHeight="300" />
    </div>

    <!-- 原始HTML代码 -->
    <div v-else class="raw-html-preview">
      <pre>{{ rawHtmlContent }}</pre>
    </div>

    <div class="buttons">
      <button class="view-btn" @click="viewPage">查看页面</button>

      <button
        v-if="item.hasUpdates"
        class="view-btn update-btn"
        @click="toggleChanges">
        {{ showChanges ? "隐藏更新" : "查看更新" }}
      </button>

      <button
        v-if="item.contentHistory && item.contentHistory.length > 0"
        class="view-btn history-btn"
        @click="toggleHistory">
        {{ showHistory ? "隐藏历史" : "查看历史" }}
      </button>

      <button
        v-if="item.hasUpdates"
        class="view-btn clear-btn"
        @click="clearUpdate">
        清除更新标记
      </button>

      <button class="delete-btn" @click="deleteItem">删除监控</button>
    </div>
  </div>
</template>

<style scoped>
.monitoring-item {
  position: relative;
  border-left: 4px solid transparent;
}

.monitoring-item.has-updates {
  border-left-color: #e74c3c;
  background-color: #fef9f8;
}

.update-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: #e74c3c;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.update-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  margin-bottom: 4px;
}

.update-badge-inline {
  background-color: #e74c3c;
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.toggle-icon {
  font-size: 10px;
}

.updates-container {
  margin-top: 10px;
  margin-bottom: 15px;
  background-color: #fff8f8;
  border: 1px solid #f0d0d0;
  border-radius: 4px;
  overflow: hidden;
}

.update-header {
  background-color: #ffebe9;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0d0d0;
}

.update-title {
  font-weight: 600;
  color: #c0392b;
}

.update-content {
  padding: 12px;
}

.update-preview {
  max-height: 200px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.5;
}

.content-changes {
  white-space: pre-wrap;
  word-break: break-word;
}

.no-changes {
  font-style: italic;
  color: #7f8c8d;
}

.preview-toggle {
  display: flex;
  margin-top: 10px;
  margin-bottom: 5px;
}

.toggle-btn {
  flex: 1;
  background-color: #f0f0f0;
  color: #666;
  border: 1px solid #ddd;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 13px;
  margin: 0;
}

.toggle-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.toggle-btn:last-child {
  border-radius: 0 4px 4px 0;
  border-left: none;
}

.toggle-btn:not(:first-child):not(:last-child) {
  border-left: none;
}

.toggle-btn.active {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.html-preview-container {
  margin-top: 10px;
}

.raw-html-preview {
  border: 1px solid #eee;
  padding: 10px;
  margin-top: 10px;
  background-color: #f8f8f8;
  max-height: 300px;
  overflow: auto;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
}

.raw-html-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.update-btn {
  background-color: #f39c12;
}

.clear-btn {
  background-color: #3498db;
}

.history-btn {
  background-color: #9c27b0;
  color: white;
}

.history-btn:hover {
  background-color: #7b1fa2;
}

.value-range-badge {
  background-color: #3498db;
  color: white;
}

.notification-count-badge {
  background-color: #9b59b6;
  color: white;
}

.value-range-container {
  margin-top: 10px;
  margin-bottom: 15px;
  background-color: #f0f8ff;
  border: 1px solid #bce8f1;
  border-radius: 4px;
  overflow: hidden;
}

.value-range-header {
  background-color: #d9edf7;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #bce8f1;
}

.value-range-title {
  font-weight: 600;
  color: #31708f;
}

.value-range-content {
  padding: 12px;
}

.value-range-info {
  font-size: 14px;
  line-height: 1.5;
}
</style>
