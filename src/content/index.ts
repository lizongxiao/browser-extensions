console.log("加载内容脚本");

// 当前内容脚本版本
const CONTENT_SCRIPT_VERSION = "1.0.0";

// 页面加载完成后初始化
window.addEventListener("load", initializeExtension);

// 监听文件保存事件
document.addEventListener("keydown", (e) => {
  // 检测 Ctrl+S 或 Command+S (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    console.log("检测到文件保存操作");
    // 延迟发送重启请求，确保文件已经保存
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "reloadExtension" });
    }, 100);
  }
});

// 初始化扩展
function initializeExtension() {
  console.log(`内容脚本初始化，版本: ${CONTENT_SCRIPT_VERSION}`);

  // 检查后台脚本是否活跃
  checkBackgroundScriptStatus();

  // 定期检查后台脚本状态
  setInterval(checkBackgroundScriptStatus, 60000); // 每分钟检查一次
}

// 检查后台脚本状态
function checkBackgroundScriptStatus() {
  try {
    chrome.runtime.sendMessage({ action: "checkAlive" }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.log("后台脚本未响应，可能需要刷新:", error);
        // 如果发生错误，可能是扩展已经重启或更新，这时应该刷新页面
        if (
          confirm("监控插件已更新，需要刷新页面以应用最新功能。是否立即刷新？")
        ) {
          window.location.reload();
        }
      } else if (response && response.status === "alive") {
        console.log("后台脚本正常运行");
      }
    });
  } catch (e) {
    console.error("检查后台脚本状态时出错:", e);
  }
}

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "activateSelectMode") {
    activateCanvasMode();
  } else if (message.action === "refreshExtension") {
    console.log("收到扩展刷新通知，重新初始化内容脚本");
    // 移除可能存在的旧UI元素
    removeExistingUIElements();
    // 重新初始化
    initializeExtension();
  }
});

// 移除可能存在的UI元素
function removeExistingUIElements() {
  // 移除可能存在的覆盖层
  const existingContainer = document.getElementById(
    "web-update-alerts-container"
  );
  if (existingContainer) {
    existingContainer.remove();
  }

  // 移除可能存在的高亮元素
  const existingHighlight = document.getElementById(
    "web-update-alerts-highlight"
  );
  if (existingHighlight) {
    existingHighlight.remove();
  }

  // 移除可能存在的控制按钮
  const existingControls = document.getElementById(
    "web-update-alerts-controls"
  );
  if (existingControls) {
    existingControls.remove();
  }
}

// 激活Canvas模式
function activateCanvasMode() {
  // 首先移除可能存在的旧UI元素
  removeExistingUIElements();

  // 创建覆盖层容器
  const overlayContainer = document.createElement("div");
  overlayContainer.id = "web-update-alerts-container";
  overlayContainer.style.position = "fixed";
  overlayContainer.style.top = "0";
  overlayContainer.style.left = "0";
  overlayContainer.style.width = "100%";
  overlayContainer.style.height = "100%";
  overlayContainer.style.zIndex = "2147483647"; // 最高层级
  document.body.appendChild(overlayContainer);

  // 创建提示文字
  const instructions = document.createElement("div");
  instructions.textContent = "在页面上拖动鼠标绘制轨迹，按ESC取消，按Enter确认";
  instructions.style.position = "fixed";
  instructions.style.top = "10px";
  instructions.style.left = "50%";
  instructions.style.transform = "translateX(-50%)";
  instructions.style.backgroundColor = "rgba(128, 128, 128, 0.3)";
  instructions.style.color = "white";
  instructions.style.padding = "10px 15px";
  instructions.style.borderRadius = "5px";
  instructions.style.fontSize = "14px";
  instructions.style.zIndex = "2147483647";
  overlayContainer.appendChild(instructions);

  // 创建Canvas元素
  const canvas = document.createElement("canvas");
  canvas.id = "web-update-alerts-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.zIndex = "2147483646"; // 略低于容器
  canvas.style.cursor = "crosshair";
  overlayContainer.appendChild(canvas);

  // 获取Canvas上下文
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("无法获取Canvas上下文");
    return;
  }

  // 绘制灰色半透明背景
  ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 轨迹相关变量
  let isDrawing = false;
  let pathPoints: { x: number; y: number }[] = [];

  // 绘制轨迹函数
  function drawPath() {
    if (pathPoints.length < 2 || !ctx) return;

    // 清除轨迹（保留灰色背景）
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 设置绘制样式
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 开始绘制路径
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }

    ctx.stroke();
  }

  // 获取轨迹包围框
  function getPathBoundingBox() {
    if (pathPoints.length === 0) return null;

    let minX = pathPoints[0].x;
    let minY = pathPoints[0].y;
    let maxX = pathPoints[0].x;
    let maxY = pathPoints[0].y;

    for (let i = 1; i < pathPoints.length; i++) {
      const point = pathPoints[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // 鼠标事件处理
  function handleMouseDown(e: MouseEvent) {
    isDrawing = true;
    pathPoints = [{ x: e.clientX, y: e.clientY }];
    drawPath();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing) return;

    pathPoints.push({ x: e.clientX, y: e.clientY });
    drawPath();
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isDrawing) return;

    isDrawing = false;
    pathPoints.push({ x: e.clientX, y: e.clientY });
    
    // 计算包围框，但不显示绘制轨迹和选择框
    const boundingBox = getPathBoundingBox();
    if (boundingBox && ctx) {
      // 清除整个画布，隐藏绘制的轨迹
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 完全隐藏画布背景（设置透明）
      canvas.style.backgroundColor = "transparent";
      
      // 标记区域内的HTML元素
      const elementsInBox = findElementsInBoundingBox(boundingBox);
      if (elementsInBox.length > 0) {
        // 添加确认取消按钮
        addControlsToElements(boundingBox, elementsInBox);
      } else {
        // 如果没有找到合适的元素，使用原来的方式添加控制按钮
        addControls(boundingBox);
      }
    }
  }

  // 键盘事件处理
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // ESC键取消选择
      cleanUp();
    } else if (e.key === "Enter") {
      // Enter键确认选择
      const boundingBox = getPathBoundingBox();
      if (boundingBox) {
        saveSelection(boundingBox);
      }
      cleanUp();
    }
  }

  // 查找包围框内的HTML元素
  function findElementsInBoundingBox(boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): Element[] {
    const result: Element[] = [];
    const allElements = document.querySelectorAll("*");

    // 将固定位置转换为页面绝对位置
    const absoluteBox = {
      left: boundingBox.left + window.scrollX,
      top: boundingBox.top + window.scrollY,
      right: boundingBox.left + boundingBox.width + window.scrollX,
      bottom: boundingBox.top + boundingBox.height + window.scrollY,
    };

    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];

      // 排除我们自己的UI元素
      if (element.id?.startsWith("web-update-alerts")) continue;
      if (element === document.body || element === document.documentElement)
        continue;

      const rect = element.getBoundingClientRect();
      const elementBox = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
        bottom: rect.bottom + window.scrollY,
      };

      // 检查元素是否在包围框内(至少50%的重叠)
      const overlapWidth =
        Math.min(absoluteBox.right, elementBox.right) -
        Math.max(absoluteBox.left, elementBox.left);
      const overlapHeight =
        Math.min(absoluteBox.bottom, elementBox.bottom) -
        Math.max(absoluteBox.top, elementBox.top);

      if (overlapWidth > 0 && overlapHeight > 0) {
        const elementArea =
          (elementBox.right - elementBox.left) *
          (elementBox.bottom - elementBox.top);
        const overlapArea = overlapWidth * overlapHeight;

        // 只有当重叠面积超过元素面积的50%，并且元素自身有一定大小时才考虑
        if (overlapArea > elementArea * 0.5 && elementArea > 100) {
          result.push(element);
        }
      }
    }

    // 过滤掉包含在其他元素内的元素，保留最具体的
    return filterContainedElements(result);
  }

  // 过滤掉被其他元素完全包含的元素
  function filterContainedElements(elements: Element[]): Element[] {
    if (elements.length <= 1) return elements;

    const result: Element[] = [];

    for (let i = 0; i < elements.length; i++) {
      let isContained = false;
      const elementI = elements[i];
      const rectI = elementI.getBoundingClientRect();

      for (let j = 0; j < elements.length; j++) {
        if (i === j) continue;

        const elementJ = elements[j];
        // 检查是否是祖先元素
        if (elementJ.contains(elementI) && elementI !== elementJ) {
          isContained = true;
          break;
        }

        // 检查是否几乎完全包含(面积比)
        const rectJ = elementJ.getBoundingClientRect();
        if (
          rectI.width * rectI.height < rectJ.width * rectJ.height * 0.9 &&
          rectI.left >= rectJ.left - 5 &&
          rectI.top >= rectJ.top - 5 &&
          rectI.right <= rectJ.right + 5 &&
          rectI.bottom <= rectJ.bottom + 5
        ) {
          isContained = true;
          break;
        }
      }

      if (!isContained) {
        result.push(elementI);
      }
    }

    return result;
  }

  // 为找到的元素添加控制按钮
  function addControlsToElements(
    boundingBox: {
      left: number;
      top: number;
      width: number;
      height: number;
    },
    elements: Element[]
  ) {
    // 为每个找到的元素添加高亮边框
    const highlightedElements: HTMLElement[] = [];

    for (const element of elements) {
      const rect = element.getBoundingClientRect();

      // 创建高亮边框
      const highlightBox = document.createElement("div");
      highlightBox.className = "web-update-alerts-element-highlight";
      highlightBox.style.position = "absolute";
      highlightBox.style.left = `${window.scrollX + rect.left - 2}px`;
      highlightBox.style.top = `${window.scrollY + rect.top - 2}px`;
      highlightBox.style.width = `${rect.width + 4}px`;
      highlightBox.style.height = `${rect.height + 4}px`;
      highlightBox.style.border = "2px dashed #4CAF50";
      highlightBox.style.boxSizing = "border-box";
      highlightBox.style.pointerEvents = "none";
      highlightBox.style.zIndex = "2147483646";
      document.body.appendChild(highlightBox);

      highlightedElements.push(highlightBox);

      // 为元素存储相关信息
      (highlightBox as any).targetElement = {
        element: element,
        rect: rect,
        info: {
          tag: element.tagName,
          id: element.id,
          className: element.className,
          text: element.textContent?.slice(0, 100),
          xpath: getXPath(element),
        },
      };
    }

    // 如果找到了元素，添加控制按钮到第一个元素的顶部
    if (highlightedElements.length > 0) {
      const primaryElement = highlightedElements[0];
      const targetData = (primaryElement as any).targetElement;

      // 创建控制按钮容器，放在元素顶部
      const controls = document.createElement("div");
      controls.id = "web-update-alerts-controls";
      controls.style.position = "absolute";
      controls.style.left = `${targetData.rect.left + window.scrollX}px`;
      controls.style.top = `${targetData.rect.top + window.scrollY - 40}px`; // 放在元素上方
      controls.style.zIndex = "2147483647";
      controls.style.backgroundColor = "#ffffff";
      controls.style.border = "1px solid #4CAF50";
      controls.style.borderRadius = "4px";
      controls.style.padding = "5px";
      controls.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
      controls.style.display = "flex";
      controls.style.gap = "5px";
      document.body.appendChild(controls);

      // 设置目标元素数量指示
      const elementCountText = document.createElement("span");
      elementCountText.textContent = `已选择 ${highlightedElements.length} 个元素`;
      elementCountText.style.fontSize = "12px";
      elementCountText.style.color = "#666";
      elementCountText.style.alignSelf = "center";
      elementCountText.style.marginRight = "10px";
      controls.appendChild(elementCountText);

      // 确认按钮
      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = "监控选中元素";
      confirmBtn.style.backgroundColor = "#4CAF50";
      confirmBtn.style.color = "white";
      confirmBtn.style.border = "none";
      confirmBtn.style.padding = "5px 10px";
      confirmBtn.style.borderRadius = "4px";
      confirmBtn.style.cursor = "pointer";
      confirmBtn.onclick = () => {
        // 收集所有元素信息
        const elementInfos = highlightedElements.map(
          (el) => (el as any).targetElement.info
        );

        // 保存元素选择信息
        saveElementSelection(elementInfos, boundingBox);

        // 移除所有高亮和控制按钮
        highlightedElements.forEach((el) => el.remove());
        controls.remove();

        // 清理
        cleanUp();
      };
      controls.appendChild(confirmBtn);

      // 取消按钮
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "取消";
      cancelBtn.style.backgroundColor = "#f44336";
      cancelBtn.style.color = "white";
      cancelBtn.style.border = "none";
      cancelBtn.style.padding = "5px 10px";
      cancelBtn.style.borderRadius = "4px";
      cancelBtn.style.cursor = "pointer";
      cancelBtn.onclick = () => {
        // 移除所有高亮和控制按钮
        highlightedElements.forEach((el) => el.remove());
        controls.remove();

        // 清理
        cleanUp();
      };
      controls.appendChild(cancelBtn);
    }
  }

  // 保存元素选择信息
  function saveElementSelection(
    elementInfos: any[],
    boundingBox: {
      left: number;
      top: number;
      width: number;
      height: number;
    }
  ) {
    // 添加滚动位置，转换为页面绝对位置
    const selection = {
      left: boundingBox.left + window.scrollX,
      top: boundingBox.top + window.scrollY,
      width: boundingBox.width,
      height: boundingBox.height,
      pathPoints: pathPoints.map((p) => ({
        x: p.x + window.scrollX,
        y: p.y + window.scrollY,
      })),
      elements: elementInfos,
      selectionType: "elements",
    };

    console.log("保存元素选择:", selection);

    // 将选择信息发送到后台脚本
    chrome.runtime.sendMessage({
      action: "saveSelection",
      selection: selection,
    });
  }

  // 获取元素的XPath
  function getXPath(element: Element): string {
    if (!element) return "";

    // 如果元素有ID，直接使用ID
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    // 如果没有ID，则需要构建完整路径
    const paths: string[] = [];
    let currentElement: Element | null = element;

    while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
      let currentPath = currentElement.localName.toLowerCase();

      // 如果有同级元素，添加索引
      if (currentElement.parentNode) {
        const siblings = Array.from(currentElement.parentNode.children).filter(
          (sibling) => sibling.localName === currentElement?.localName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(currentElement) + 1;
          currentPath += `[${index}]`;
        }
      }

      paths.unshift(currentPath);
      currentElement = currentElement.parentNode as Element;

      // 如果到达 body，停止
      if (currentElement?.localName === "body") {
        paths.unshift("body");
        break;
      }
    }

    return "/" + paths.join("/");
  }

  // 添加控制按钮
  function addControls(boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    // 创建控制按钮容器
    const controls = document.createElement("div");
    controls.id = "web-update-alerts-controls";
    controls.style.position = "fixed";
    controls.style.left = `${boundingBox.left + boundingBox.width / 2 - 75}px`;
    controls.style.top = `${boundingBox.top + boundingBox.height + 10}px`;
    controls.style.zIndex = "2147483647";
    controls.style.backgroundColor = "#ffffff";
    controls.style.border = "1px solid #cccccc";
    controls.style.borderRadius = "4px";
    controls.style.padding = "5px";
    controls.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
    controls.style.display = "flex";
    controls.style.gap = "5px";
    overlayContainer.appendChild(controls);

    // 确认按钮
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "确认选择";
    confirmBtn.style.backgroundColor = "#4CAF50";
    confirmBtn.style.color = "white";
    confirmBtn.style.border = "none";
    confirmBtn.style.padding = "5px 10px";
    confirmBtn.style.borderRadius = "4px";
    confirmBtn.style.cursor = "pointer";
    confirmBtn.onclick = () => {
      saveSelection(boundingBox);
      cleanUp();
    };
    controls.appendChild(confirmBtn);

    // 取消按钮
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.backgroundColor = "#f44336";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.padding = "5px 10px";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.onclick = cleanUp;
    controls.appendChild(cancelBtn);

    // 清除按钮
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "重新绘制";
    clearBtn.style.backgroundColor = "#2196F3";
    clearBtn.style.color = "white";
    clearBtn.style.border = "none";
    clearBtn.style.padding = "5px 10px";
    clearBtn.style.borderRadius = "4px";
    clearBtn.style.cursor = "pointer";
    clearBtn.onclick = () => {
      // 移除控制按钮
      controls.remove();
      // 清除画布，重新开始
      pathPoints = [];
      if (ctx) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.1)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    controls.appendChild(clearBtn);
  }

  // 保存选择信息
  function saveSelection(boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    // 添加滚动位置，转换为页面绝对位置
    const selection = {
      left: boundingBox.left + window.scrollX,
      top: boundingBox.top + window.scrollY,
      width: boundingBox.width,
      height: boundingBox.height,
      pathPoints: pathPoints.map((p) => ({
        x: p.x + window.scrollX,
        y: p.y + window.scrollY,
      })),
      selectionType: "region",
    };

    console.log("保存区域选择:", selection);

    // 将选择信息发送到后台脚本
    chrome.runtime.sendMessage({
      action: "saveSelection",
      selection: selection,
    });
  }

  // 清理函数
  function cleanUp() {
    // 移除事件监听器
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);

    // 移除整个容器
    overlayContainer.remove();
  }

  // 添加事件监听器
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("keydown", handleKeyDown);
}
