// 创建右键菜单
export const createContextMenu = () => {
  chrome.contextMenus.create({
    id: "selectElement",
    title: "监控此区域",
    contexts: ["page"],
  });
};
