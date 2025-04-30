// 元素检查器 - 定期检查监控的元素和区域是否有更新
import { MonitoringItem, ContentCheckResult, AppSettings, BaseMonitoringItem, ElementMonitoringItem, RegionMonitoringItem, ContentHistoryEntry, DiffInfo, DiffFragment, DiffFragmentType } from "../../types/monitoringTypes";
import { updateBadge } from './updateBadge';

// 存储检查计时器ID
let checkInterval: number | null = null;

// 初始化检查器
export function initElementChecker() {
  // 加载设置
  chrome.storage.local.get('settings', (result) => {
    const settings: AppSettings = result.settings || { checkInterval: 30 };
    startChecking(settings.checkInterval);
  });

  // 监听设置变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      const newSettings: AppSettings = changes.settings.newValue;
      startChecking(newSettings.checkInterval);
    }
  });

  // 监听通知按钮点击
  if (!chrome.notifications.onButtonClicked.hasListeners()) {
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      chrome.storage.local.get([`notification_${notificationId}`], (result) => {
        const itemId = result[`notification_${notificationId}`];
        
        if (!itemId) return;
        
        // 获取监控项信息
        chrome.storage.local.get('savedSelections', (selectionResult) => {
          const savedSelections: MonitoringItem[] = selectionResult.savedSelections || [];
          const targetItem = savedSelections.find(item => item.id === itemId);
          
          if (!targetItem) return;
          
          if (buttonIndex === 0) {
            // 打开相应页面
            chrome.tabs.create({ url: targetItem.url });
          } else if (buttonIndex === 1) {
            // 打开设置页面
            chrome.tabs.create({ url: 'src/options/index.html' });
          }
        });
        
        // 清理通知映射
        chrome.storage.local.remove([`notification_${notificationId}`]);
      });
    });
  }
}

// 开始定期检查
function startChecking(intervalMinutes: number) {
  // 清除现有计时器
  if (checkInterval !== null) {
    clearInterval(checkInterval);
  }

  // 设置新的计时器
  const intervalMilliseconds = intervalMinutes * 60 * 1000;
  checkInterval = setInterval(checkAllMonitoredItems, intervalMilliseconds) as unknown as number;
  
  console.log(`开始监控检查，间隔${intervalMinutes}分钟`);
  
  // 立即执行一次检查
  checkAllMonitoredItems();
}

// 检查所有监控项目
async function checkAllMonitoredItems() {
  console.log('开始检查所有监控项目');
  
  // 获取所有保存的选择
  chrome.storage.local.get('savedSelections', async (result) => {
    const savedSelections: MonitoringItem[] = result.savedSelections || [];
    
    if (savedSelections.length === 0) {
      console.log('没有监控项目');
      return;
    }
    
    // 检查每个监控项
    for (const item of savedSelections) {
      try {
        // 仅在值范围监控启用且已达到最大通知次数时跳过
        // 但对于内容变化监控，即使达到最大通知次数也继续检查
        if (item.valueRange?.enabled && 
            item.valueRange.maxNotifications > 0 && 
            item.valueRange.notificationCount >= item.valueRange.maxNotifications &&
            !item.hasUpdates) { // 如果没有未读更新，才跳过
          console.log(`项目 ${item.id} 已达到最大通知次数，但会继续监控内容变化`);
        }
        
        await checkItem(item);
      } catch (error) {
        console.error(`检查项目出错 ${item.id}:`, error);
      }
    }
    
    // 完成检查后更新徽章
    updateBadge();
  });
}

// 检查单个监控项
async function checkItem(item: MonitoringItem): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`检查监控项: ${item.url}`);
      
      // 打开标签页但不激活
      chrome.tabs.create({ url: item.url, active: false }, (tab) => {
        if (!tab || !tab.id) {
          reject(new Error('创建标签页失败'));
          return;
        }
        
        // 等待页面加载完成
        const tabId = tab.id;
        
        // 添加超时保护
        const timeout = setTimeout(() => {
          cleanupTab(tabId);
          reject(new Error('检查超时'));
        }, 30000); // 30秒超时
        
        // 监听标签页加载完成
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            // 页面加载完成，移除监听器
            chrome.tabs.onUpdated.removeListener(listener);
            
            // 执行内容脚本来检查内容
            setTimeout(() => {
              checkContent(tabId, item, () => {
                clearTimeout(timeout);
                cleanupTab(tabId);
                resolve();
              });
            }, 2000); // 等待2秒确保页面加载完成
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 清理标签页
function cleanupTab(tabId: number) {
  chrome.tabs.remove(tabId).catch(err => console.error('关闭标签页失败:', err));
}

// 检查内容
function checkContent(tabId: number, item: MonitoringItem, callback: () => void) {
  // 注入脚本进行检查
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: checkContentInPage,
    args: [item]
  }).then(results => {
    const result = results[0].result as ContentCheckResult;
    
    // 先检查值范围监控
    const shouldNotify = checkValueRangeAndUpdate(item, result);
    
    if (result.hasChanged || shouldNotify) {
      // 内容有变化，更新存储并发送通知
      updateItem(item.id, result.newContent || '', result.newInnerText || '', shouldNotify).then(() => {
        // 始终发送内容变化通知，除非特定条件阻止
        sendChangeNotification(item, result);
        callback();
      });
    } else {
      // 仅更新最后检查时间
      updateItemLastCheckTime(item.id).then(callback);
    }
  }).catch(error => {
    console.error('执行内容检查脚本失败:', error);
    callback();
  });
}

// 检查值范围并更新
function checkValueRangeAndUpdate(item: MonitoringItem, result: ContentCheckResult): boolean {
  if (!item.valueRange?.enabled || !result.extractedValues || result.extractedValues.length === 0) {
    return false;
  }

  // 获取最大的提取值（通常销量等数值越大越重要）
  const maxExtractedValue = Math.max(...result.extractedValues.map(v => v.value));
  
  // 更新当前值
  if (!item.valueRange.currentValue) {
    // 首次检测到值，记录但不通知
    item.valueRange.currentValue = maxExtractedValue;
    return false;
  }
  
  // 检查值是否在范围内
  const minValue = item.valueRange.minValue;
  const maxValue = item.valueRange.maxValue;
  let isInRange = false;
  
  if (minValue !== undefined && maxValue !== undefined) {
    // 检查值是否在最小值和最大值之间
    isInRange = maxExtractedValue >= minValue && maxExtractedValue <= maxValue;
  } else if (minValue !== undefined) {
    // 只检查最小值
    isInRange = maxExtractedValue >= minValue;
  } else if (maxValue !== undefined) {
    // 只检查最大值
    isInRange = maxExtractedValue <= maxValue;
  }
  
  // 更新当前值
  item.valueRange.currentValue = maxExtractedValue;
  
  return isInRange;
}

// 页面内容检查函数 (在目标页面上下文中执行)
function checkContentInPage(item: MonitoringItem): ContentCheckResult {
  // 检查不同类型的监控项
  if (item.selectionType === 'elements') {
    return checkElements(item);
  } else {
    return checkRegion(item);
  }
  
  // 检查元素
  function checkElements(item: MonitoringItem): ContentCheckResult {
    if (item.selectionType !== 'elements') {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'elements'
      };
    }

    const elements = item.elements || [];
    let newContent = '';
    let newInnerText = '';
    let hasChanged = false;
    const extractedValues: { value: number; context: string }[] = [];
    
    // 检查每个元素
    for (const elementInfo of elements) {
      try {
        // 使用XPath找到元素
        const xpath = elementInfo.xpath;
        if (!xpath) continue;
        
        const element = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.FIRST_ORDERED_NODE_TYPE, 
          null
        ).singleNodeValue as Element;
        
        if (element) {
          const html = element.outerHTML;
          const text = element.textContent || '';
          
          // 提取数值
          extractNumbersFromText(text, extractedValues);
          
          newContent += html;
          newInnerText += text + ' | ';
        }
      } catch (e) {
        console.error('检查元素失败:', e);
      }
    }
    
    // 检查内容是否有变化
    hasChanged = (item.lastContent !== newContent);
    
    return {
      hasChanged,
      newContent,
      newInnerText: newInnerText.trim(),
      timeChecked: new Date().toISOString(),
      type: 'elements',
      extractedValues
    };
  }
  
  // 检查区域
  function checkRegion(item: MonitoringItem): ContentCheckResult {
    if (item.selectionType !== 'region') {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'region'
      };
    }

    // 提取绝对位置坐标
    const left = item.left - window.scrollX;
    const top = item.top - window.scrollY;
    const width = item.width;
    const height = item.height;
    
    // 尝试找到区域中心的元素
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const element = document.elementFromPoint(centerX, centerY);
    
    // 如果找不到元素，则返回无变化
    if (!element) {
      return {
        hasChanged: false,
        timeChecked: new Date().toISOString(),
        type: 'region'
      };
    }
    
    // 尝试找到合适的容器
    let targetElement = element;
    let closestContainer = element;
    
    // 向上查找合适的容器
    let currentEl = element;
    while (currentEl && currentEl !== document.body) {
      const rect = currentEl.getBoundingClientRect();
      const isContainer = (
        rect.width >= width * 0.8 && 
        rect.height >= height * 0.8 &&
        rect.width <= width * 1.5 && 
        rect.height <= height * 1.5
      );
      
      if (isContainer) {
        closestContainer = currentEl;
        break;
      }
      currentEl = currentEl.parentElement as Element;
    }
    
    targetElement = closestContainer || element;
    
    // 获取区域HTML内容
    const newContent = targetElement.outerHTML;
    const newInnerText = targetElement.textContent || '';
    
    // 提取数值
    const extractedValues: { value: number; context: string }[] = [];
    extractNumbersFromText(newInnerText, extractedValues);
    
    // 检查内容是否有变化
    const hasChanged = (item.lastContent !== newContent);
    
    return {
      hasChanged,
      newContent,
      newInnerText,
      timeChecked: new Date().toISOString(),
      type: 'region',
      extractedValues
    };
  }
  
  // 从文本中提取数字
  function extractNumbersFromText(text: string, results: { value: number; context: string }[]) {
    // 简单数字正则表达式，匹配常见的数量表示方式
    const simpleNumberRegex = /(\d+)([.,]\d+)?/g;
    const matches = Array.from(text.matchAll(simpleNumberRegex));
    
    for (const match of matches) {
      const matchText = match[0];
      const matchIndex = match.index || 0;
      const value = parseFloat(matchText.replace(/,/g, ''));
      
      if (!isNaN(value)) {
        // 获取数字周围的上下文
        const startIndex = Math.max(0, matchIndex - 20);
        const endIndex = Math.min(text.length, matchIndex + matchText.length + 20);
        const context = text.substring(startIndex, endIndex).trim();
        
        results.push({ value, context });
      }
    }
  }
}

// 计算差异信息
function calculateDiff(oldText: string, newText: string): DiffInfo {
  const fragments: DiffFragment[] = [];
  const timestamp = new Date().toISOString();
  
  // 检测特定类型的变化
  findPriceChanges();
  findLinkChanges();
  
  // 按行分析文本变化
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const added: string[] = [];
  const removed: string[] = [];
  
  // 简单差异算法：找出不在旧内容中的新行
  for (const line of newLines) {
    if (line.trim() && !oldLines.includes(line)) {
      added.push(line);
    }
  }
  
  // 找出不在新内容中的旧行
  for (const line of oldLines) {
    if (line.trim() && !newLines.includes(line)) {
      removed.push(line);
    }
  }

  // 提取HTML内容，用于比较
  const stripHtml = (html: string) => {
    const doc = document.createElement('div');
    doc.innerHTML = html;
    return doc.textContent || '';
  };

  const oldTextStripped = stripHtml(oldText);
  const newTextStripped = stripHtml(newText);

  // 寻找价格变化
  const findPriceChanges = () => {
    // 价格正则表达式 - 匹配常见货币格式，更全面的匹配各种价格模式
    const priceRegex = /(\$|€|£|¥|USD|EUR|GBP|JPY|CAD|AUD|NZD|CHF|CNY|HKD|SGD)?\s*\d+([.,]\d{1,3})?([.,]\d{1,2})?\s*(\$|€|£|¥|USD|EUR|GBP|JPY|CAD|AUD|NZD|CHF|CNY|HKD|SGD)?/g;
    
    const oldPrices = Array.from(oldText.matchAll(priceRegex) || []).map(match => ({
      text: match[0],
      index: match.index,
      value: parseFloat(match[0].replace(/[^\d.,]/g, '').replace(',', '.'))
    })).filter(item => !isNaN(item.value) && item.text.trim().length > 0);
    
    const newPrices = Array.from(newText.matchAll(priceRegex) || []).map(match => ({
      text: match[0],
      index: match.index,
      value: parseFloat(match[0].replace(/[^\d.,]/g, '').replace(',', '.'))
    })).filter(item => !isNaN(item.value) && item.text.trim().length > 0);
    
    // 价格变化检测逻辑
    // 1. 尝试匹配位置类似的价格
    for (let i = 0; i < Math.min(oldPrices.length, newPrices.length); i++) {
      if (oldPrices[i].text.trim() !== newPrices[i].text.trim()) {
        const context = getContext(oldText, oldPrices[i].index || 0, 100);
        const percentChange = ((newPrices[i].value - oldPrices[i].value) / oldPrices[i].value) * 100;
        
        fragments.push({
          type: DiffFragmentType.PRICE,
          oldText: oldPrices[i].text,
          newText: newPrices[i].text,
          context: context,
          isIncrease: newPrices[i].value > oldPrices[i].value,
          isDecrease: newPrices[i].value < oldPrices[i].value,
          percentChange: percentChange.toFixed(2)
        });
      }
    }
    
    // 2. 查找内容周围相似的描述，但价格不同的情况
    if (oldPrices.length > 0 && newPrices.length > 0) {
      // 将价格按上下文分组
      const groupByContext = (prices, text) => {
        return prices.map(price => {
          const ctx = getContext(text, price.index || 0, 100)
            .replace(priceRegex, 'PRICE_PLACEHOLDER')
            .toLowerCase();
          return { ...price, context: ctx };
        });
      };
      
      const oldPricesWithContext = groupByContext(oldPrices, oldText);
      const newPricesWithContext = groupByContext(newPrices, newText);
      
      // 寻找上下文相似但价格不同的情况
      for (const oldPrice of oldPricesWithContext) {
        for (const newPrice of newPricesWithContext) {
          // 跳过已匹配的价格
          if (fragments.some(f => 
            f.type === DiffFragmentType.PRICE && 
            (f.oldText === oldPrice.text || f.newText === newPrice.text)
          )) {
            continue;
          }
          
          // 计算上下文相似度 - 这里用简单方法，实际可用更复杂的字符串相似度算法
          const contextSimilarity = stringSimilarity(oldPrice.context, newPrice.context);
          
          if (contextSimilarity > 0.7 && oldPrice.text !== newPrice.text) {
            const percentChange = ((newPrice.value - oldPrice.value) / oldPrice.value) * 100;
            
            fragments.push({
              type: DiffFragmentType.PRICE,
              oldText: oldPrice.text,
              newText: newPrice.text,
              context: getContext(oldText, oldPrice.index || 0, 100),
              isIncrease: newPrice.value > oldPrice.value,
              isDecrease: newPrice.value < oldPrice.value,
              percentChange: percentChange.toFixed(2)
            });
          }
        }
      }
    }
  };
  
  // 简单的字符串相似度计算函数 (Jaccard相似度)
  const stringSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  };
  
  // 寻找链接和hash值变化
  const findLinkChanges = () => {
    // 链接正则表达式
    const linkRegex = /https?:\/\/[^\s"']+/g;
    // Hash正则表达式 - 改进版，可以匹配更多格式的hash
    const hashRegex = /#([a-f0-9]{6,40}|[a-zA-Z0-9_-]{4,})/g;
    
    const oldLinks = Array.from(oldText.matchAll(linkRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    const newLinks = Array.from(newText.matchAll(linkRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    // 比较链接变化
    for (let i = 0; i < Math.min(oldLinks.length, newLinks.length); i++) {
      const oldUrl = oldLinks[i].text;
      const newUrl = newLinks[i].text;
      
      if (oldUrl !== newUrl) {
        // 检查是否是hash值变化
        const oldHash = oldUrl.includes('#') ? oldUrl.split('#')[1] : '';
        const newHash = newUrl.includes('#') ? newUrl.split('#')[1] : '';
        
        if (oldHash && newHash && oldUrl.split('#')[0] === newUrl.split('#')[0]) {
          fragments.push({
            type: DiffFragmentType.HASH,
            oldText: `#${oldHash}`,
            newText: `#${newHash}`,
            context: oldUrl.split('#')[0]
          });
        } else {
          fragments.push({
            type: DiffFragmentType.LINK,
            oldText: oldUrl,
            newText: newUrl
          });
        }
      }
    }
    
    // 分析独立的hash值变化
    const oldHashes = Array.from(oldText.matchAll(hashRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    const newHashes = Array.from(newText.matchAll(hashRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    // 比较hash值变化（非URL部分的hash）
    for (let i = 0; i < Math.min(oldHashes.length, newHashes.length); i++) {
      // 检查这个hash是否已经在URL分析中处理过
      const isAlreadyHandled = fragments.some(
        f => f.type === DiffFragmentType.HASH && 
             (f.oldText === oldHashes[i].text || f.newText === newHashes[i].text)
      );
      
      if (!isAlreadyHandled && oldHashes[i].text !== newHashes[i].text) {
        fragments.push({
          type: DiffFragmentType.HASH,
          oldText: oldHashes[i].text,
          newText: newHashes[i].text,
          context: getContext(oldText, oldHashes[i].index || 0)
        });
      }
    }
  };
  
  // 寻找数字变化
  const findNumberChanges = () => {
    // 数字正则表达式，匹配独立的数字（非价格部分）
    const numberRegex = /\b\d+(?:\.\d+)?\b/g;
    
    const oldNumbers = Array.from(oldTextStripped.matchAll(numberRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    const newNumbers = Array.from(newTextStripped.matchAll(numberRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    // 比较数字变化
    for (let i = 0; i < Math.min(oldNumbers.length, newNumbers.length); i++) {
      if (oldNumbers[i].text !== newNumbers[i].text) {
        // 确保这不是已经作为价格检测到的变化
        const isPriceChange = fragments.some(
          f => f.type === DiffFragmentType.PRICE && 
               (f.oldText.includes(oldNumbers[i].text) || f.newText.includes(newNumbers[i].text))
        );
        
        if (!isPriceChange) {
          fragments.push({
            type: DiffFragmentType.NUMBER,
            oldText: oldNumbers[i].text,
            newText: newNumbers[i].text,
            context: getContext(oldTextStripped, oldNumbers[i].index || 0)
          });
        }
      }
    }
  };
  
  // 寻找日期变化
  const findDateChanges = () => {
    // 日期正则表达式，匹配常见日期格式
    const dateRegex = /\b\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi;
    
    const oldDates = Array.from(oldTextStripped.matchAll(dateRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    const newDates = Array.from(newTextStripped.matchAll(dateRegex) || []).map(match => ({
      text: match[0],
      index: match.index
    }));
    
    // 比较日期变化
    for (let i = 0; i < Math.min(oldDates.length, newDates.length); i++) {
      if (oldDates[i].text !== newDates[i].text) {
        fragments.push({
          type: DiffFragmentType.DATE,
          oldText: oldDates[i].text,
          newText: newDates[i].text,
          context: getContext(oldTextStripped, oldDates[i].index || 0)
        });
      }
    }
  };
  
  // 获取文本上下文
  const getContext = (text: string, index: number, length = 100) => {
    const start = Math.max(0, index - length/2);
    const end = Math.min(text.length, index + length/2);
    return text.substring(start, end);
  };
  
  // 执行所有差异检测
  try {
    findPriceChanges();
    findLinkChanges();
    findNumberChanges();
    findDateChanges();  // 添加日期检测
  } catch (error) {
    console.error('计算差异时出错:', error);
  }
  
  return {
    added,
    removed,
    fragments,
    timestamp
  };
}

// 更新监控项
async function updateItem(itemId: string, newContent: string, newInnerText: string, incrementNotificationCount = false): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('savedSelections', (result) => {
      let savedSelections: MonitoringItem[] = result.savedSelections || [];
      
      // 查找并更新指定ID的项目
      const updatedSelections = savedSelections.map(item => {
        if (item.id === itemId) {
          // 确定最大历史记录长度
          const maxHistoryLength = item.maxHistoryLength || 10;
          
          // 如果内容已变化且存在旧内容，保存至历史记录
          if (newContent && item.lastContent) {
            // 初始化历史记录数组（如果不存在）
            if (!item.contentHistory) {
              item.contentHistory = [];
            }
            
            // 添加当前内容到历史记录
            const historyEntry: ContentHistoryEntry = {
              content: item.lastContent,
              timestamp: new Date().getTime()
            };
            
            item.contentHistory.push(historyEntry);
            
            // 限制历史记录数量
            if (item.contentHistory.length > maxHistoryLength) {
              item.contentHistory = item.contentHistory.slice(-maxHistoryLength);
            }
            
            // 计算差异信息
            item.lastDiff = calculateDiff(item.lastContent, newContent);
            
            // 明确标记有更新
            item.hasUpdates = true;
          }
          
          // 增加通知计数（如果需要）
          if (incrementNotificationCount && item.valueRange?.enabled) {
            if (!item.valueRange.notificationCount) {
              item.valueRange.notificationCount = 1;
            } else {
              item.valueRange.notificationCount += 1;
            }
          }
          
          // 更新内容和检查时间
          item.lastContent = newContent;
          item.lastInnerText = newInnerText;
          item.lastCheck = new Date().getTime();
          
          // 保存当前选择器类型后的数据
          if (item.selectionType === 'elements') {
            // 对于元素监控，我们只存储HTML和文本
          } else {
            // 对于区域监控，更新HTML和innerText
            item.html = newContent;
            item.innerText = newInnerText;
          }
        }
        return item;
      });
      
      // 保存更新后的选择数组
      chrome.storage.local.set({ savedSelections: updatedSelections }, () => {
        // 更新徽章显示
        updateBadge();
        resolve();
      });
    });
  });
}

// 只更新最后检查时间
async function updateItemLastCheckTime(itemId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get('savedSelections', (result) => {
      let savedSelections: MonitoringItem[] = result.savedSelections || [];
      
      // 查找并更新指定ID的项目
      const updatedSelections = savedSelections.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            lastCheck: new Date().toISOString()
          };
        }
        return item;
      });
      
      // 保存回存储
      chrome.storage.local.set({ savedSelections: updatedSelections }, () => {
        resolve();
      });
    });
  });
}

// 发送变化通知
function sendChangeNotification(item: MonitoringItem, result: ContentCheckResult) {
  // 检查通知权限是否已授予
  chrome.permissions.contains({ permissions: ['notifications'] }, (hasPermission) => {
    if (!hasPermission) {
      console.error('没有通知权限，请在浏览器设置中启用通知权限');
      return;
    }
    
    let title = item.title || '监控项更新';
    let message = `${item.url} 上的内容有变化`;
    
    // 如果是数值范围监控触发的通知，自定义消息
    if (item.valueRange?.enabled && result.extractedValues && result.extractedValues.length > 0) {
      const value = Math.max(...result.extractedValues.map(v => v.value));
      
      if (item.valueRange.minValue !== undefined && item.valueRange.maxValue !== undefined) {
        title = `数值在设定范围内: ${value}`;
        message = `监控项 "${item.title}" 的数值 ${value} 在设定范围 ${item.valueRange.minValue}-${item.valueRange.maxValue} 内`;
      } else if (item.valueRange.minValue !== undefined) {
        title = `数值已达到设定值: ${value}`;
        message = `监控项 "${item.title}" 的数值 ${value} 已达到设定的最小值 ${item.valueRange.minValue}`;
      } else if (item.valueRange.maxValue !== undefined) {
        title = `数值已达到设定值: ${value}`;
        message = `监控项 "${item.title}" 的数值 ${value} 已达到设定的最大值 ${item.valueRange.maxValue}`;
      }
      
      // 添加通知次数信息
      if (item.valueRange.maxNotifications > 0) {
        message += `（通知次数: ${item.valueRange.notificationCount || 1}/${item.valueRange.maxNotifications}）`;
      }
    } else if (result.hasChanged) {
      // 普通内容变化
      title = `${item.title || '监控项'} 有更新`;
      message = `监控的网页内容已发生变化，点击查看详情`;
    }
    
    // 创建系统通知
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/src/assets/icon128.png',
        title: title,
        message: message,
        priority: 2,
        buttons: [
          { title: '查看页面' },
          { title: '查看设置' }
        ]
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('通知创建失败:', chrome.runtime.lastError.message);
          return;
        }
        
        // 存储通知和对应项目的关系
        chrome.storage.local.set({
          [`notification_${notificationId}`]: item.id
        });
        
        // 更新徽章计数
        updateBadge();
      });
    } catch (error) {
      console.error('创建通知时出错:', error);
    }
  });
}

// 导出初始化函数
export default initElementChecker;