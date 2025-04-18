<template>
  <div class="popup-container">
    <header class="header">
      <h1>Web Monitor</h1>
    </header>

    <main class="content">
      <div class="monitored-areas">
        <h2>监控区域列表</h2>
        <div v-if="monitoredAreas.length === 0" class="empty-state">
          暂无监控区域，请右键点击页面选择"开始监控此区域"
        </div>
        <ul v-else class="area-list">
          <li v-for="area in monitoredAreas" :key="area.id" class="area-item">
            <div class="area-info">
              <span class="area-title">{{ area.areaName || getDefaultAreaName(area) }}</span>
              <span class="area-coordinates">
                Position: ({{ Math.round(area.x) }}, {{ Math.round(area.y) }})
              </span>
              <span class="area-dimensions">
                Size: {{ Math.round(area.width) }}x{{ Math.round(area.height) }}
              </span>
            </div>
            <div class="area-actions">
              <button @click="removeArea(area.id)" class="remove-btn">
                删除
              </button>
            </div>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface MonitorArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLElement;
  areaName?: string;
}

const monitoredAreas = ref<MonitorArea[]>([]);

// Get default area name if areaName is not provided
function getDefaultAreaName(area: MonitorArea): string {
  if (!area.element) return "Unknown Element";
  let name = area.element.tagName.toLowerCase();
  if (area.element.id) {
    name += `#${area.element.id}`;
  } else if (area.element.className) {
    name += `.${area.element.className.split(" ")[0]}`;
  }
  return name;
}

// 获取元素的路径
function getElementPath(element: HTMLElement | null): string {
  if (!element) return "unknown";
  const path: string[] = [];
  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement.tagName !== "HTML") {
    let selector = currentElement.tagName.toLowerCase();
    if (currentElement.id) {
      selector += `#${currentElement.id}`;
    } else if (currentElement.className) {
      selector += `.${currentElement.className.split(" ")[0]}`;
    }
    path.unshift(selector);
    currentElement = currentElement.parentElement;
  }

  return path.join(" > ");
}

// 移除监控区域
async function removeArea(areaId: string) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "REMOVE_MONITOR_AREA",
      areaId,
    });
    // 从本地列表中移除
    monitoredAreas.value = monitoredAreas.value.filter(
      (area) => area.id !== areaId
    );
  }
}

// 加载监控区域列表
onMounted(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {
        type: "GET_MONITOR_AREAS",
      },
      (response) => {
        if (response && Array.isArray(response)) {
          monitoredAreas.value = response;
        }
      }
    );
  }
});
</script>

<style scoped>
.popup-container {
  min-width: 500px;
  width: fit-content;
  min-height: 300px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  background-color: #1890ff;
  color: white;
  padding: 12px 16px;
}

.header h1 {
  margin: 0;
  font-size: 18px;
}

.content {
  padding: 16px;
}

.monitored-areas h2 {
  font-size: 16px;
  margin: 0 0 12px;
  color: #333;
}

.empty-state {
  color: #666;
  text-align: center;
  padding: 24px 16px;
  background: #f5f5f5;
  border-radius: 4px;
}

.area-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.area-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.area-info {
  flex: 1;
  min-width: 0;
}

.area-title {
  font-weight: 500;
  color: #333;
  margin-right: 8px;
  display: block;
  margin-bottom: 4px;
}

.area-coordinates,
.area-dimensions {
  color: #666;
  font-size: 12px;
  margin-right: 12px;
}

.area-actions {
  margin-left: 12px;
}

.remove-btn {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.remove-btn:hover {
  background: #ff7875;
}
</style>
