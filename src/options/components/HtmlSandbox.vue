<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  html: string
  maxHeight?: number
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeHeight = ref(200)
const isEmptyContent = ref(false)

// 在HTML内容变化时更新iframe
watch(() => props.html, updateIframe)

// 组件挂载后设置iframe
onMounted(() => {
  updateIframe()
})

// 更新iframe内容
function updateIframe() {
  if (!iframeRef.value) return
  
  const doc = iframeRef.value.contentDocument
  if (!doc) return
  
  // 检查HTML内容是否为空
  isEmptyContent.value = !props.html || props.html.trim() === ''
  
  // 处理HTML内容，确保元素可见
  let processedHtml = props.html
  
  // 对于非常小的元素，添加边框和最小尺寸确保可见
  if (processedHtml && processedHtml.trim().length > 0) {
    // 包裹内容，确保小元素可见
    processedHtml = `<div class="content-wrapper">${processedHtml}</div>`
  }
  
  // 设置基本HTML架构
  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 8px;
          color: #333;
          font-size: 14px;
          line-height: 1.5;
          overflow-x: hidden;
        }
        
        .content-wrapper {
          min-height: 20px;
          min-width: 20px;
          display: block;
          box-sizing: border-box;
          border: ${props.html && props.html.trim().length < 100 ? '1px dashed #ddd' : 'none'};
          padding: 4px;
        }
        
        /* 强化小元素可见性 */
        img, input, button, select, textarea, a, span, i, em, b, strong, div {
          min-width: 16px !important;
          min-height: 16px !important;
          display: inline-block !important;
          border: 1px dotted rgba(0, 0, 255, 0.2) !important;
          box-sizing: border-box !important;
          padding: 1px !important;
          margin: 1px !important;
        }
        
        /* 特殊处理超小元素以确保可见性 */
        span:empty, i:empty, em:empty, b:empty, strong:empty, div:empty {
          width: 18px !important;
          height: 18px !important;
          background-color: rgba(255, 230, 230, 0.3) !important;
          border: 1px dashed rgba(255, 0, 0, 0.3) !important;
        }
        
        /* 空元素显示占位符 */
        .content-wrapper:empty::after {
          content: "无内容";
          color: #999;
          font-style: italic;
          font-size: 12px;
        }
        
        img {
          max-width: 100%;
          height: auto;
          object-fit: contain;
        }
        
        * {
          max-width: 100% !important;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 10px;
        }
        
        td, th {
          border: 1px solid #ddd;
          padding: 4px 8px;
        }
        
        /* 强制使所有元素显示，甚至是隐藏元素 */
        [hidden], [style*="display: none"], [style*="visibility: hidden"] {
          display: block !important;
          visibility: visible !important;
          opacity: 0.7 !important;
          border: 1px dashed #ffbb33 !important;
          min-height: 16px !important;
          min-width: 16px !important;
        }
        
        /* 单字符元素特殊处理 */
        *:not(input):not(textarea):not(select):not(option) {
          min-width: ${getCharCountBasedWidth(props.html)} !important;
        }
      </style>
    </head>
    <body>
      ${processedHtml || '<div class="empty-content">无内容可显示</div>'}
    </body>
    </html>
  `)
  doc.close()
  
  // 调整iframe高度以适应内容
  setTimeout(() => {
    if (iframeRef.value && iframeRef.value.contentDocument) {
      let height = iframeRef.value.contentDocument.body.scrollHeight
      
      // 确保即使是空内容也有最小高度
      if (height < 50) height = 50
      
      iframeHeight.value = Math.min(height + 16, props.maxHeight || 500)
    }
  }, 50)
}

// 根据内容字符数量计算合适的最小宽度
function getCharCountBasedWidth(html: string): string {
  if (!html) return '16px'
  
  const charCount = html.trim().length
  
  if (charCount <= 1) return '24px' // 单字符设置更大的显示
  if (charCount <= 3) return '36px' // 2-3个字符
  if (charCount <= 10) return '60px' // 较少字符的元素
  
  return '16px' // 默认值
}
</script>

<template>
  <div class="html-sandbox">
    <div v-if="isEmptyContent" class="empty-message">
      无内容
    </div>
    <iframe
      ref="iframeRef"
      :style="{ height: `${iframeHeight}px` }"
      sandbox="allow-same-origin"
      frameborder="0"
    ></iframe>
  </div>
</template>

<style scoped>
.html-sandbox {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #fff;
  margin-bottom: 10px;
}

iframe {
  width: 100%;
  border: none;
  overflow: auto;
}

.empty-message {
  text-align: center;
  padding: 10px;
  color: #999;
  font-style: italic;
  font-size: 13px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
}
</style> 