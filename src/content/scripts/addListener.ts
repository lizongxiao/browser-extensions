import { activateCanvasMode } from "./activateCanvasMode";
import { reshExtension } from "./reshExtension";

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "activateSelectMode") {
    activateCanvasMode();
  } else if (message.action === "refreshExtension") {
    reshExtension();
  }
});
