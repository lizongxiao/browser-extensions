<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { AppSettings } from '../../types/monitoringTypes'

const emit = defineEmits<{
  (e: 'settings-saved', settings: AppSettings): void
}>()

const checkInterval = ref<number>(30)
const customInterval = ref<number>(30)
const useCustomInterval = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const saveMessage = ref<string>('')
const errorMessage = ref<string>('')

// 计算实际使用的间隔值
const actualInterval = computed(() => {
  return useCustomInterval.value ? customInterval.value : checkInterval.value
})

onMounted(() => {
  loadSettings()
})

const loadSettings = async () => {
  const result = await chrome.storage.local.get('settings')
  const settings: AppSettings = result.settings || { checkInterval: 30 }
  
  // 检查是否是预设间隔之一
  const presetIntervals = [5, 15, 30, 60, 360, 720, 1440]
  if (presetIntervals.includes(settings.checkInterval)) {
    checkInterval.value = settings.checkInterval
    useCustomInterval.value = false
  } else {
    // 如果不是预设值，则使用自定义间隔
    customInterval.value = settings.checkInterval
    useCustomInterval.value = true
  }
}

const validateInterval = (): boolean => {
  errorMessage.value = ''
  
  if (useCustomInterval.value) {
    // 验证自定义间隔
    if (isNaN(customInterval.value) || !customInterval.value) {
      errorMessage.value = '请输入有效的数值'
      return false
    }
    
    if (customInterval.value < 1) {
      errorMessage.value = '间隔时间不能小于1分钟'
      return false
    }
    
    if (customInterval.value > 10080) { // 7天 = 10080分钟
      errorMessage.value = '间隔时间不能超过7天(10080分钟)'
      return false
    }
  }
  
  return true
}

const saveSettings = async () => {
  if (!validateInterval()) {
    return
  }
  
  isSaving.value = true
  saveMessage.value = ''
  
  const settings: AppSettings = {
    checkInterval: actualInterval.value
  }
  
  await chrome.storage.local.set({ settings })
  
  saveMessage.value = '已保存'
  emit('settings-saved', settings)
  
  setTimeout(() => {
    saveMessage.value = ''
    isSaving.value = false
  }, 2000)
}

// 切换到自定义间隔
const switchToCustom = () => {
  if (!useCustomInterval.value) {
    customInterval.value = checkInterval.value
    useCustomInterval.value = true
  }
}
</script>

<template>
  <div class="settings-section">
    <h3>全局设置</h3>
    
    <div class="interval-settings">
      <div class="section-title">监控检查间隔</div>
      
      <!-- 预设间隔 -->
      <div class="interval-option" :class="{ active: !useCustomInterval }">
        <label>
          <input 
            type="radio" 
            :checked="!useCustomInterval" 
            @change="useCustomInterval = false" 
          />
          使用预设间隔：
        </label>
        <select 
          id="checkInterval" 
          v-model="checkInterval"
          :disabled="useCustomInterval"
        >
          <option :value="5">5 分钟</option>
          <option :value="15">15 分钟</option>
          <option :value="30">30 分钟</option>
          <option :value="60">1 小时</option>
          <option :value="360">6 小时</option>
          <option :value="720">12 小时</option>
          <option :value="1440">1 天</option>
        </select>
      </div>
      
      <!-- 自定义间隔 -->
      <div class="interval-option" :class="{ active: useCustomInterval }">
        <label>
          <input 
            type="radio" 
            :checked="useCustomInterval" 
            @change="useCustomInterval = true" 
          />
          自定义间隔：
        </label>
        <div class="custom-interval">
          <input 
            type="number" 
            v-model="customInterval"
            :disabled="!useCustomInterval"
            min="1"
            max="10080"
            @focus="switchToCustom"
            placeholder="输入分钟数"
          /> 分钟
          <div class="hint">建议值: 5-1440分钟 (1分钟到1天)</div>
        </div>
      </div>
      
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      
      <button 
        class="save-btn" 
        @click="saveSettings" 
        :disabled="isSaving"
      >
        {{ saveMessage || '保存设置' }}
      </button>
      
      <div class="settings-info">
        <div>当前设置: 每 <span class="highlight">{{ actualInterval }}</span> 分钟检查一次变更</div>
        <div class="hint">提示: 频繁检查会增加资源消耗，建议根据实际需要设置合理间隔</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interval-settings {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 10px;
  color: #2c3e50;
}

.interval-option {
  display: flex;
  align-items: center;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.interval-option.active {
  background-color: #f5f9ff;
  border-color: #3498db;
}

.interval-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 10px;
  font-weight: 500;
}

.custom-interval {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-direction: column;
  align-items: flex-start;
}

.custom-interval input {
  width: 100px;
  padding: 6px 10px;
}

.hint {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 2px;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  margin-top: 5px;
}

.save-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  align-self: flex-start;
  margin-top: 5px;
}

.save-btn:hover {
  background-color: #2980b9;
}

.save-btn:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.settings-info {
  margin-top: 15px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #3498db;
}

.highlight {
  font-weight: bold;
  color: #3498db;
}
</style> 