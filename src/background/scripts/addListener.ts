import { reloadExtension } from "./reloadExtension";
import { saveSelection } from "./savedSelections";
import { createContextMenu } from "./contextMenus";

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveSelection") {
    saveSelection(message, sender);
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

// 启动
chrome.runtime.onInstalled.addListener((details) => {
  // 初始化右键菜单
  createContextMenu();
  if (details.reason === "install") {
    console.log("扩展安装");
  } else if (details.reason === "update") {
    console.log("扩展更新");
  }
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "selectElement" && tab?.id) {
    // 向内容脚本发送消息，激活选择模式
    chrome.tabs.sendMessage(tab.id, { action: "activateSelectMode" });
  }
});
