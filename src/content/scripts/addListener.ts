import { activateCanvasMode } from "./activateCanvasMode";

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "activateSelectMode") {
    activateCanvasMode();
  }
});
