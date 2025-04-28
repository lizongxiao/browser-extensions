<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AppSettings } from '../../types/monitoringTypes'

const emit = defineEmits<{
  (e: 'settings-saved', settings: AppSettings): void
}>()

const checkInterval = ref<number>(30)
const isSaving = ref<boolean>(false)
const saveMessage = ref<string>('')

onMounted(() => {
  loadSettings()
})

const loadSettings = async () => {
  const result = await chrome.storage.local.get('settings')
  const settings: AppSettings = result.settings || { checkInterval: 30 }
  checkInterval.value = settings.checkInterval
}

const saveSettings = async () => {
  isSaving.value = true
  saveMessage.value = ''
  
  const settings: AppSettings = {
    checkInterval: checkInterval.value
  }
  
  await chrome.storage.local.set({ settings })
  
  saveMessage.value = '已保存'
  emit('settings-saved', settings)
  
  setTimeout(() => {
    saveMessage.value = ''
    isSaving.value = false
  }, 2000)
}
</script>

<template>
  <div class="settings-section">
    <h3>全局设置</h3>
    <div class="refresh-interval">
      <label for="checkInterval">检查间隔：</label>
      <select id="checkInterval" v-model="checkInterval">
        <option :value="5">5 分钟</option>
        <option :value="15">15 分钟</option>
        <option :value="30">30 分钟</option>
        <option :value="60">1 小时</option>
        <option :value="360">6 小时</option>
        <option :value="720">12 小时</option>
        <option :value="1440">1 天</option>
      </select>
      <button 
        class="view-btn" 
        @click="saveSettings" 
        :disabled="isSaving"
      >
        {{ saveMessage || '保存设置' }}
      </button>
    </div>
  </div>
</template> 