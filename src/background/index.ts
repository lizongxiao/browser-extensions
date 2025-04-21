console.log("加载背景脚本");

// 创建右键菜单
chrome.runtime.onInstalled.addListener((details) => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "selectElement",
    title: "监控此区域",
    contexts: ["page"],
  });

  // 如果是扩展更新，通知所有标签页刷新
  if (details.reason === "update") {
    console.log("扩展已更新，版本:", chrome.runtime.getManifest().version);
    notifyContentScriptsToRefresh();
  }
});

// 监听扩展重启
chrome.runtime.onStartup.addListener(() => {
  console.log("浏览器已启动，扩展开始运行");
  // 延迟一些时间让所有内容脚本加载
  setTimeout(notifyContentScriptsToRefresh, 1000);
});

// 重新加载扩展
function reloadExtension() {
  console.log("准备重新加载扩展...");
  // 先通知所有内容脚本
  notifyContentScriptsToRefresh();
  // 延迟后重新加载扩展
  setTimeout(() => {
    chrome.runtime.reload();
  }, 500);
}

// 通知所有标签页刷新扩展内容
function notifyContentScriptsToRefresh() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        try {
          chrome.tabs.sendMessage(tab.id, { action: "refreshExtension" });
        } catch (error) {
          console.log(`向标签页 ${tab.id} 发送消息失败`, error);
        }
      }
    }
  });
}

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
    chrome.storage.local.set(
      {
        savedSelections: savedSelections,
      },
      () => {
        console.log("选择区域已保存", selection);

        // 显示通知
        chrome.notifications.create({
          type: "basic",
          iconUrl: "/src/assets/icon128.png",
          title: "区域监控已添加",
          message: `已开始监控 ${selection.url} 上的选定区域`,
          priority: 2,
        });
      }
    );

    return true;
  } else if (message.action === "checkAlive") {
    // 响应存活检查
    sendResponse({ status: "alive" });
    return true;
  } else if (message.action === "reloadExtension") {
    // 处理重新加载扩展的请求
    console.log("收到重新加载扩展的请求");
    reloadExtension();
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
