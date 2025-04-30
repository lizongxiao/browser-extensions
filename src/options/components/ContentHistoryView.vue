<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseMonitoringItem, ContentHistoryEntry, DiffInfo, DiffFragment, DiffFragmentType } from '../../types/monitoringTypes';
import HtmlSandbox from './HtmlSandbox.vue';

const props = defineProps<{
  item: BaseMonitoringItem;
}>();

// State
const selectedVersion = ref<number | null>(null);
const compareMode = ref(false);
const compareFromIndex = ref<number | null>(null);
const compareToIndex = ref<number | null>(null);

// Computed properties
const hasHistory = computed(() => {
  return props.item.contentHistory && props.item.contentHistory.length > 0;
});

const formattedHistory = computed(() => {
  if (!props.item.contentHistory) return [];
  
  return props.item.contentHistory.map((entry, index) => ({
    index,
    content: entry.content,
    formattedDate: formatDate(entry.timestamp)
  }));
});

// Helper functions
const formatDate = (timestamp: number | string) => {
  let time: number;
  if (typeof timestamp === 'string') {
    // 尝试解析ISO日期字符串
    const dateTime = new Date(timestamp).getTime();
    time = !isNaN(dateTime) ? dateTime : parseInt(timestamp, 10);
  } else {
    time = timestamp;
  }
  
  if (isNaN(time)) return "无效时间";
  
  const date = new Date(time);
  return date.toLocaleString();
};

// Actions
const viewVersion = (index: number) => {
  if (compareMode.value) {
    if (compareFromIndex.value === null) {
      compareFromIndex.value = index;
    } else {
      compareToIndex.value = index;
      // 确保老版本索引小于新版本索引
      if (compareFromIndex.value > compareToIndex.value) {
        const temp = compareFromIndex.value;
        compareFromIndex.value = compareToIndex.value;
        compareToIndex.value = temp;
      }
    }
  } else {
    selectedVersion.value = index;
  }
};

const backToHistory = () => {
  selectedVersion.value = null;
  compareMode.value = false;
  compareFromIndex.value = null;
  compareToIndex.value = null;
};

const toggleCompareMode = () => {
  compareMode.value = !compareMode.value;
  if (!compareMode.value) {
    compareFromIndex.value = null;
    compareToIndex.value = null;
  }
};

const getVersionContent = (index: number) => {
  if (!props.item.contentHistory || index < 0 || index >= props.item.contentHistory.length) {
    return '';
  }
  return props.item.contentHistory[index].content;
};

const hasDiffInfo = computed(() => {
  return props.item.lastDiff && 
         (props.item.lastDiff.added.length > 0 || props.item.lastDiff.removed.length > 0);
});

// 获取两个版本之间的比较
const compareVersions = (oldIndex: number, newIndex: number) => {
  if (!props.item.contentHistory) return null;
  
  const oldContent = props.item.contentHistory[oldIndex]?.content || '';
  const newContent = props.item.contentHistory[newIndex]?.content || '';
  
  if (!oldContent || !newContent) return null;
  
  // 行级差异比较
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const added = newLines.filter(line => !oldLines.includes(line) && line.trim() !== '');
  const removed = oldLines.filter(line => !newLines.includes(line) && line.trim() !== '');
  
  // 查找可能的数字变化作为fragments
  const fragments: DiffFragment[] = [];
  
  // 尝试提取和比较数字
  const oldNumbers = extractNumbers(oldContent);
  const newNumbers = extractNumbers(newContent);
  
  // 对比数字变化
  if (oldNumbers.length > 0 && newNumbers.length > 0) {
    for (let i = 0; i < Math.min(oldNumbers.length, newNumbers.length); i++) {
      if (oldNumbers[i].value !== newNumbers[i].value) {
        fragments.push({
          type: DiffFragmentType.NUMBER,
          oldText: oldNumbers[i].value.toString(),
          newText: newNumbers[i].value.toString(),
          context: oldNumbers[i].context || newNumbers[i].context
        });
      }
    }
  }
  
  const diff: DiffInfo = {
    added,
    removed,
    fragments,
    timestamp: props.item.contentHistory[newIndex].timestamp
  };
  
  return diff;
};

// 提取文本中的数字及其上下文
const extractNumbers = (text: string) => {
  const result = [];
  const regex = /(\D*)(\d+\.?\d*)(\D*)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      result.push({
        value: parseFloat(match[2]),
        context: (match[1] || '').trim() + ' ... ' + (match[3] || '').trim()
      });
    }
  }
  
  return result;
};

// 计算当前比较的差异
const currentComparison = computed(() => {
  if (compareFromIndex.value !== null && compareToIndex.value !== null) {
    return compareVersions(compareFromIndex.value, compareToIndex.value);
  }
  return null;
});

// 高亮显示差异文本
const highlightDiffs = (text: string, type: 'added' | 'removed') => {
  if (!text) return '';
  
  return type === 'added' 
    ? `<span class="diff-highlight-text added-text">${text}</span>` 
    : `<span class="diff-highlight-text removed-text">${text}</span>`;
};
</script>

<template>
  <div class="content-history-view">
    <div v-if="!hasHistory" class="no-history">
      <p>暂无内容历史记录，检测到变更时会记录历史版本。</p>
    </div>
    
    <template v-else>
      <!-- 最后检测到的变化 -->
      <div v-if="hasDiffInfo" class="diff-section">
        <div class="section-header">最近检测到的变化</div>
        
        <!-- 添加的内容 -->
        <div v-if="item.lastDiff?.added.length" class="diff-highlight added">
          <div class="diff-title">添加的内容：</div>
          <div v-for="(line, index) in item.lastDiff?.added" :key="`added-${index}`" class="diff-line">
            <span class="diff-marker">+</span> {{ line }}
          </div>
        </div>
        
        <!-- 删除的内容 -->
        <div v-if="item.lastDiff?.removed.length" class="diff-highlight removed">
          <div class="diff-title">删除的内容：</div>
          <div v-for="(line, index) in item.lastDiff?.removed" :key="`removed-${index}`" class="diff-line">
            <span class="diff-marker">-</span> {{ line }}
          </div>
        </div>
        
        <!-- 精细差异片段 -->
        <div v-if="item.lastDiff?.fragments && item.lastDiff.fragments.length > 0" class="fragments-section">
          <div class="diff-title">变更详情：</div>
          <div v-for="(fragment, index) in item.lastDiff.fragments" :key="`fragment-${index}`" 
               class="fragment-item" :class="fragment.type.toLowerCase()">
            <div class="fragment-type">{{ fragment.type }}</div>
            <div class="fragment-change">
              <div class="old-text">旧：{{ fragment.oldText }}</div>
              <div class="new-text">新：{{ fragment.newText }}</div>
              <div v-if="fragment.context" class="fragment-context">
                上下文：{{ fragment.context }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 版本比较视图 -->
      <div v-if="compareFromIndex !== null && compareToIndex !== null" class="compare-view">
        <div class="compare-header">
          比较版本： {{ formattedHistory[compareFromIndex].formattedDate }} → 
          {{ formattedHistory[compareToIndex].formattedDate }}
        </div>
        
        <div v-if="currentComparison" class="comparison-results">
          <!-- 添加的内容 -->
          <div v-if="currentComparison.added.length > 0" class="diff-highlight added">
            <div class="diff-title">添加的内容：</div>
            <div v-for="(line, index) in currentComparison.added" :key="`comp-added-${index}`" class="diff-line">
              <span class="diff-marker">+</span> {{ line }}
            </div>
          </div>
          
          <!-- 删除的内容 -->
          <div v-if="currentComparison.removed.length > 0" class="diff-highlight removed">
            <div class="diff-title">删除的内容：</div>
            <div v-for="(line, index) in currentComparison.removed" :key="`comp-removed-${index}`" class="diff-line">
              <span class="diff-marker">-</span> {{ line }}
            </div>
          </div>
          
          <!-- 数值变化等精细差异 -->
          <div v-if="currentComparison.fragments.length > 0" class="fragments-section">
            <div class="diff-title">详细变化：</div>
            <div v-for="(fragment, index) in currentComparison.fragments" :key="`comp-fragment-${index}`" 
                 class="fragment-item" :class="fragment.type.toLowerCase()">
              <div class="fragment-type">{{ fragment.type === 'NUMBER' ? '数值变化' : fragment.type }}</div>
              <div class="fragment-change">
                <div class="old-text">旧：{{ fragment.oldText }}</div>
                <div class="new-text">新：{{ fragment.newText }}</div>
                <div v-if="fragment.context" class="fragment-context">
                  上下文：{{ fragment.context }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 如果没有检测到差异 -->
          <div v-if="currentComparison.added.length === 0 && 
                     currentComparison.removed.length === 0 && 
                     currentComparison.fragments.length === 0" 
               class="no-differences">
            未检测到显著差异
          </div>
        </div>
        
        <div class="compare-versions">
          <div class="version-panel">
            <div class="version-panel-header">旧版本</div>
            <div class="version-panel-content">
              <HtmlSandbox :html="getVersionContent(compareFromIndex)" :maxHeight="250" />
            </div>
          </div>
          <div class="version-panel">
            <div class="version-panel-header">新版本</div>
            <div class="version-panel-content">
              <HtmlSandbox :html="getVersionContent(compareToIndex)" :maxHeight="250" />
            </div>
          </div>
        </div>
        
        <button class="back-btn" @click="backToHistory">返回历史列表</button>
      </div>
      
      <!-- 历史版本内容 -->
      <div v-else-if="selectedVersion !== null" class="version-content">
        <div class="version-header">
          {{ formattedHistory[selectedVersion].formattedDate }} 的内容
        </div>
        <div class="scrollable-content">
          <HtmlSandbox :html="getVersionContent(selectedVersion)" :maxHeight="300" />
        </div>
        <button class="back-btn" @click="backToHistory">返回历史列表</button>
      </div>
      
      <!-- 历史版本列表 -->
      <div v-else class="history-timeline">
        <div class="section-header">
          <span>历史版本</span>
          <button class="toggle-compare-btn" @click="toggleCompareMode">
            {{ compareMode ? '取消比较模式' : '比较版本' }}
          </button>
        </div>
        
        <div v-if="compareMode" class="compare-instructions">
          请选择两个版本进行比较{{ compareFromIndex !== null ? '，已选择第一个版本' : '' }}
        </div>
        
        <div class="timeline">
          <div 
            v-for="entry in formattedHistory" 
            :key="entry.index" 
            class="timeline-item"
            :class="{ 
              'latest': entry.index === formattedHistory.length - 1,
              'selected-version': entry.index === compareFromIndex || entry.index === compareToIndex 
            }"
          >
            <div class="timeline-date">{{ entry.formattedDate }}</div>
            <div class="timeline-actions">
              <button class="view-content-btn" @click="viewVersion(entry.index)">
                {{ compareMode ? '选择此版本' : '查看内容' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.content-history-view {
  margin-bottom: 16px;
  background-color: #fff;
  border-radius: 6px;
  border: 1px solid #eee;
  overflow: hidden;
}

.no-history {
  padding: 16px;
  text-align: center;
  color: #666;
}

.section-header {
  font-weight: 600;
  padding: 10px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-compare-btn {
  background-color: #1890ff;
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.toggle-compare-btn:hover {
  background-color: #40a9ff;
}

.compare-instructions {
  padding: 10px 16px;
  background-color: #e6f7ff;
  color: #1890ff;
  font-size: 14px;
  text-align: center;
  border-bottom: 1px solid #91d5ff;
}

.diff-section {
  margin-bottom: 16px;
}

.diff-highlight {
  padding: 12px;
  margin: 8px 16px;
  border-radius: 4px;
}

.diff-highlight.added {
  background-color: #e6ffed;
  border: 1px solid #b7eb8f;
}

.diff-highlight.removed {
  background-color: #fff2f0;
  border: 1px solid #ffccc7;
}

.diff-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.diff-line {
  line-height: 1.5;
  font-family: monospace;
  padding: 2px 0;
  display: flex;
}

.diff-marker {
  color: #22863a;
  font-weight: bold;
  width: 20px;
  display: inline-block;
}

.diff-highlight.removed .diff-marker {
  color: #cb2431;
}

.diff-highlight-text {
  display: inline-block;
  padding: 2px 4px;
  border-radius: 2px;
}

.added-text {
  background-color: #e6ffed;
  color: #22863a;
}

.removed-text {
  background-color: #fff2f0;
  color: #cb2431;
  text-decoration: line-through;
}

.fragments-section {
  padding: 12px;
  margin: 8px 16px;
  background-color: #f6f8fa;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.fragment-item {
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 4px;
  background-color: #fff;
  border: 1px solid #eee;
}

.fragment-item.price {
  background-color: #fff5eb;
  border-color: #ffbb66;
}

.fragment-item.link {
  background-color: #ebf5ff;
  border-color: #66aaff;
}

.fragment-item.date {
  background-color: #f0ebff;
  border-color: #aa66ff;
}

.fragment-item.number {
  background-color: #ebfff5;
  border-color: #66ffaa;
}

.fragment-type {
  font-weight: 600;
  margin-bottom: 5px;
  font-size: 13px;
  color: #555;
}

.fragment-change {
  font-family: monospace;
  font-size: 13px;
}

.old-text, .new-text {
  padding: 3px 0;
}

.old-text {
  color: #cb2431;
  text-decoration: line-through;
}

.new-text {
  color: #22863a;
}

.fragment-context {
  margin-top: 5px;
  font-style: italic;
  color: #666;
  font-size: 12px;
  border-top: 1px dashed #eee;
  padding-top: 5px;
}

.scrollable-content {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  padding: 8px;
  margin: 8px 16px;
  border-radius: 4px;
  background-color: #fafafa;
}

.version-header {
  font-weight: 600;
  padding: 10px 16px;
  background-color: #e6f7ff;
  border-bottom: 1px solid #91d5ff;
}

.back-btn {
  margin: 10px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.back-btn:hover {
  background-color: #096dd9;
}

.timeline {
  padding: 10px 16px;
}

.timeline-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-left: 2px solid #1890ff;
  padding-left: 16px;
  position: relative;
  margin-left: 8px;
}

.timeline-item:before {
  content: "";
  position: absolute;
  left: -5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #1890ff;
}

.timeline-item.latest:before {
  background-color: #52c41a;
}

.timeline-item.latest {
  border-left-color: #52c41a;
}

.timeline-item.selected-version {
  border-left-color: #722ed1;
  background-color: rgba(114, 46, 209, 0.05);
}

.timeline-item.selected-version:before {
  background-color: #722ed1;
}

.timeline-date {
  font-size: 14px;
  color: #555;
}

.timeline-actions {
  display: flex;
  gap: 8px;
}

.view-content-btn, .compare-btn {
  background-color: #1890ff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.compare-btn {
  background-color: #722ed1;
}

.view-content-btn:hover {
  background-color: #096dd9;
}

.compare-btn:hover {
  background-color: #5b21b6;
}

.compare-view {
  padding-bottom: 16px;
}

.compare-header {
  font-weight: 600;
  padding: 10px 16px;
  background-color: #f0f2ff;
  border-bottom: 1px solid #d6e4ff;
  color: #4c53d9;
}

.comparison-results {
  margin-bottom: 16px;
}

.no-differences {
  padding: 16px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.compare-versions {
  display: flex;
  gap: 16px;
  padding: 0 16px;
  margin-top: 16px;
}

.version-panel {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.version-panel-header {
  background-color: #f5f5f5;
  padding: 8px 12px;
  font-weight: 600;
  color: #555;
  border-bottom: 1px solid #eee;
}

.version-panel-content {
  padding: 8px;
  max-height: 250px;
  overflow: auto;
}
</style> 