console.log("加载背景脚本");

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "selectElement",
    title: "监控此区域",
    contexts: ["page"]
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "selectElement" && tab?.id) {
    // 向内容脚本发送消息，激活选择模式
    chrome.tabs.sendMessage(tab.id, { action: "activateSelectMode" });
  }
});

// 存储已保存的选择区域
let savedSelections: any[] = [];

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveSelection") {
    // 保存选择信息
    const selection = message.selection;
    
    // 添加标识信息
    selection.id = Date.now().toString();
    selection.url = sender.tab?.url || "";
    selection.timestamp = new Date().toISOString();
    
    // 添加到存储
    savedSelections.push(selection);
    
    // 保存到 Chrome 存储
    chrome.storage.local.set({ 
      savedSelections: savedSelections 
    }, () => {
      console.log("选择区域已保存", selection);
      
      // 显示通知
      chrome.notifications.create({
        type: "basic",
        iconUrl: "/src/assets/icon128.png",
        title: "区域监控已添加",
        message: `已开始监控 ${selection.url} 上的选定区域`,
        priority: 2
      });
    });
    
    return true;
  }
});

// 加载保存的选择区域
chrome.storage.local.get("savedSelections", (result) => {
  if (result.savedSelections) {
    savedSelections = result.savedSelections;
    console.log("已加载保存的选择区域:", savedSelections.length);
  }
});
