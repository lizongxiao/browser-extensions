<template>
  <div class="popup-container">
    <header class="header">
      <h1>ScrollWebSizeTop</h1>
    </header>
    
    <main class="content">
      <div class="setting-item">
        <label for="enable-toggle">启用滚动到顶部按钮</label>
        <input 
          type="checkbox" 
          id="enable-toggle" 
          v-model="settings.enabled"
          @change="saveSettings"
        />
      </div>
      
      <div class="setting-item">
        <label>主题</label>
        <ThemeSwitch 
          v-model:theme="settings.theme"
          @update:theme="saveSettings"
        />
      </div>
    </main>
    
    <footer class="footer">
      <p>版本 1.0.0</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ThemeSwitch from '../components/ThemeSwitch.vue';

// 使用组合式 API
const settings = ref({
  enabled: true,
  theme: 'light'
});

// 生命周期钩子
onMounted(() => {
  // 从存储中加载设置
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      settings.value = data.settings;
    }
  });
});

// 保存设置
const saveSettings = async () => {
  await chrome.storage.local.set({ settings: settings.value });
  
  // 通知内容脚本设置已更新
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'settingsUpdated',
      data: settings.value
    });
  }
};
</script>

<style scoped>
.popup-container {
  width: 300px;
  min-height: 250px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #3a7bd5;
  color: white;
  padding: 10px 15px;
  text-align: center;
}

.header h1 {
  margin: 0;
  font-size: 18px;
}

.content {
  padding: 15px;
  flex: 1;
}

.setting-item {
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer {
  font-size: 12px;
  color: #666;
  text-align: center;
  padding: 10px;
  border-top: 1px solid #eee;
}

select, input[type="checkbox"] {
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style> 