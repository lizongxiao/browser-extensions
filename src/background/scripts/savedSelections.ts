// 存储已保存的选择区域
let savedSelections: any[] = [];

// 加载保存的选择区域
chrome.storage.local.get("savedSelections", (result) => {
  if (result.savedSelections) {
    savedSelections = result.savedSelections;
    console.log("已加载保存的选择区域:", savedSelections.length);
  }
});

export function saveSelection(
  message: any,
  sender: chrome.runtime.MessageSender
) {
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
}
