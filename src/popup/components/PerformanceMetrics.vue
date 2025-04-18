<template>
  <div class="performance-metrics">
    <div class="metrics-header">
      <h2>性能监控面板</h2>
      <button @click="exportMetrics" class="export-btn">
        导出数据
      </button>
    </div>

    <div class="metrics-grid">
      <!-- 页面加载时间 -->
      <div class="metric-card">
        <h3>页面加载时间</h3>
        <div class="load-times">
          <div class="load-item">
            <span class="label">DOM完成:</span>
            <span class="value">{{ formatTime(metrics.pageLoad.domComplete) }}</span>
          </div>
          <div class="load-item">
            <span class="label">可交互:</span>
            <span class="value">{{ formatTime(metrics.pageLoad.domInteractive) }}</span>
          </div>
          <div class="load-item">
            <span class="label">内容加载:</span>
            <span class="value">{{ formatTime(metrics.pageLoad.domContentLoaded) }}</span>
          </div>
          <div class="load-item">
            <span class="label">完全加载:</span>
            <span class="value">{{ formatTime(metrics.pageLoad.loadComplete) }}</span>
          </div>
        </div>
      </div>

      <!-- FPS监控 -->
      <div class="metric-card">
        <h3>FPS监控</h3>
        <div class="fps-stats">
          <div class="fps-item">
            <span class="label">当前:</span>
            <span class="value" :class="getFPSClass(metrics.fps.current)">
              {{ metrics.fps.current }}
            </span>
          </div>
          <div class="fps-item">
            <span class="label">平均:</span>
            <span class="value" :class="getFPSClass(metrics.fps.average)">
              {{ metrics.fps.average }}
            </span>
          </div>
          <div class="fps-item">
            <span class="label">最低:</span>
            <span class="value" :class="getFPSClass(metrics.fps.min)">
              {{ metrics.fps.min === Infinity ? 0 : metrics.fps.min }}
            </span>
          </div>
          <div class="fps-item">
            <span class="label">最高:</span>
            <span class="value" :class="getFPSClass(metrics.fps.max)">
              {{ metrics.fps.max }}
            </span>
          </div>
        </div>
        <div class="fps-graph">
          <!-- FPS图表将在mounted中初始化 -->
        </div>
      </div>

      <!-- 资源加载 -->
      <div class="metric-card resources">
        <h3>资源加载 ({{ metrics.resources.length }})</h3>
        <div class="resource-stats">
          <div class="resource-list">
            <div v-for="resource in sortedResources" :key="resource.name" class="resource-item">
              <div class="resource-info">
                <span class="resource-type">{{ resource.type }}</span>
                <span class="resource-name">{{ getFileName(resource.name) }}</span>
              </div>
              <div class="resource-metrics">
                <span class="duration">{{ formatTime(resource.duration) }}</span>
                <span class="size">{{ formatSize(resource.size) }}</span>
                <span class="status" :class="getStatusClass(resource.status)">
                  {{ resource.status || 'N/A' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误监控 -->
      <div class="metric-card errors">
        <h3>错误监控 ({{ metrics.errors.length }})</h3>
        <div class="error-list">
          <div v-for="error in metrics.errors" :key="error.timestamp" class="error-item">
            <div class="error-header">
              <span class="error-time">{{ formatDateTime(error.timestamp) }}</span>
              <span class="error-source">{{ error.source }}</span>
              <span class="error-line">行: {{ error.line }}</span>
            </div>
            <div class="error-message">{{ error.message }}</div>
          </div>
        </div>
      </div>

      <!-- 内存使用 -->
      <div class="metric-card">
        <h3>内存使用</h3>
        <div class="memory-stats">
          <div class="memory-item">
            <span class="label">已用内存:</span>
            <span class="value">{{ formatSize(metrics.memory.usedJSHeapSize) }}</span>
          </div>
          <div class="memory-item">
            <span class="label">总内存:</span>
            <span class="value">{{ formatSize(metrics.memory.totalJSHeapSize) }}</span>
          </div>
          <div class="memory-item">
            <span class="label">内存限制:</span>
            <span class="value">{{ formatSize(metrics.memory.jsHeapSizeLimit) }}</span>
          </div>
        </div>
        <div class="memory-usage-bar">
          <div 
            class="usage-fill"
            :style="{
              width: `${(metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100}%`,
              backgroundColor: getMemoryUsageColor(metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit)
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { PerformanceMetrics, ResourceMetric } from '@/content/performance/PerformanceManager';

const props = defineProps<{
  metrics: PerformanceMetrics;
}>();

// 格式化时间
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 格式化日期时间
function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// 获取文件名
function getFileName(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

// 获取FPS状态类
function getFPSClass(fps: number): string {
  if (fps >= 55) return 'fps-good';
  if (fps >= 30) return 'fps-warning';
  return 'fps-bad';
}

// 获取HTTP状态类
function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return 'status-success';
  if (status >= 400) return 'status-error';
  return 'status-warning';
}

// 获取内存使用颜色
function getMemoryUsageColor(ratio: number): string {
  if (ratio <= 0.6) return '#52c41a';
  if (ratio <= 0.8) return '#faad14';
  return '#f5222d';
}

// 排序资源
const sortedResources = computed(() => {
  return [...props.metrics.resources].sort((a, b) => b.duration - a.duration);
});

// 导出数据
function exportMetrics() {
  const dataStr = JSON.stringify(props.metrics, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-metrics-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.performance-metrics {
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
}

.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.export-btn {
  padding: 8px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn:hover {
  background-color: #40a9ff;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.metric-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.metric-card h3 {
  margin: 0 0 16px;
  color: #333;
  font-size: 16px;
}

.load-times, .fps-stats, .memory-stats {
  display: grid;
  gap: 8px;
}

.load-item, .fps-item, .memory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #666;
}

.value {
  font-weight: 500;
}

.fps-good { color: #52c41a; }
.fps-warning { color: #faad14; }
.fps-bad { color: #f5222d; }

.memory-usage-bar {
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.usage-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.resource-list, .error-list {
  max-height: 300px;
  overflow-y: auto;
}

.resource-item, .error-item {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.resource-info {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.resource-type {
  background: #e6f7ff;
  color: #1890ff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.resource-metrics {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 12px;
}

.status-success { color: #52c41a; }
.status-warning { color: #faad14; }
.status-error { color: #f5222d; }

.error-header {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.error-message {
  color: #f5222d;
  font-family: monospace;
  word-break: break-all;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style> 