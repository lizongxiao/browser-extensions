// 激活Canvas模式
export function activateCanvasMode() {
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
  instructions.style.backgroundColor = "rgba(128, 128, 128)";
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

  // 累计存储所有已选中的元素和对应的高亮元素
  let allSelectedElements = new Map<Element, HTMLElement>();
  let lastBoundingBox: any = null;

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
      // 保存最后的包围框用于区域选择
      lastBoundingBox = boundingBox;

      // 清除整个画布，隐藏绘制的轨迹
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 完全隐藏画布背景（设置透明）
      canvas.style.backgroundColor = "transparent";

      // 标记区域内的HTML元素
      const elementsInBox = findElementsInBoundingBox(boundingBox);

      // 高亮显示找到的新元素并加入到累计集合中
      const newHighlightedElements = highlightElements(
        elementsInBox,
        allSelectedElements
      );

      // 更新或创建控制按钮
      updateControls(lastBoundingBox, allSelectedElements);
    }
  }

  // 高亮显示元素并将新元素添加到累计集合中
  function highlightElements(
    elements: Element[],
    selectedMap: Map<Element, HTMLElement>
  ): Element[] {
    const newElements: Element[] = [];

    for (const element of elements) {
      // 检查元素是否已经被选中
      if (selectedMap.has(element)) {
        continue; // 如果已选中，跳过
      }

      newElements.push(element);
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

      // 添加到累计集合
      selectedMap.set(element, highlightBox);
    }

    return newElements;
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
    // 获取每个元素的HTML内容
    const elementsWithHTML = elementInfos.map(info => {
      // 使用XPath查找元素
      const element = getElementByXPath(info.xpath);
      const htmlContent = element ? element.outerHTML : '';
      
      return {
        ...info,
        html: htmlContent, // 保存元素的HTML内容
        innerText: element ? element.textContent : ''
      };
    });

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
      elements: elementsWithHTML,
      url: window.location.href, // 保存当前页面URL
      title: document.title, // 保存页面标题
      selectionType: "elements",
      lastCheck: new Date().toISOString(), // 添加最后检查时间
      lastContent: elementsWithHTML.map(el => el.html).join(''), // 用于对比变化
    };

    console.log("保存元素选择:", selection);

    // 将选择信息发送到后台脚本
    chrome.runtime.sendMessage({
      action: "saveSelection",
      selection: selection,
    });
  }

  // 根据XPath获取元素
  function getElementByXPath(xpath: string): Element | null {
    try {
      const result = document.evaluate(
        xpath, 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      );
      return result.singleNodeValue as Element;
    } catch (e) {
      console.error("XPath解析错误:", e);
      return null;
    }
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

  // 更新或创建控制按钮
  function updateControls(
    boundingBox: {
      left: number;
      top: number;
      width: number;
      height: number;
    },
    selectedMap: Map<Element, HTMLElement>
  ) {
    // 移除已有的控制按钮
    const existingControls = document.getElementById(
      "web-update-alerts-controls"
    );
    if (existingControls) {
      existingControls.remove();
    }

    // 创建控制按钮容器，放在屏幕右下角
    const controls = document.createElement("div");
    controls.id = "web-update-alerts-controls";
    controls.style.position = "fixed";
    controls.style.right = "20px";
    controls.style.bottom = "20px";
    controls.style.zIndex = "2147483647";
    controls.style.backgroundColor = "#ffffff";
    controls.style.border = "1px solid #cccccc";
    controls.style.borderRadius = "4px";
    controls.style.padding = "10px";
    controls.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
    controls.style.display = "flex";
    controls.style.flexDirection = "column";
    controls.style.gap = "10px";
    document.body.appendChild(controls);

    // 显示选择信息
    const totalSelectedElements = selectedMap.size;

    // 显示已选中的元素数量
    const elementCountText = document.createElement("div");
    elementCountText.textContent = `已累计选择 ${totalSelectedElements} 个元素`;
    elementCountText.style.fontSize = "14px";
    elementCountText.style.color = "#666";
    elementCountText.style.marginBottom = "5px";
    controls.appendChild(elementCountText);

    if (totalSelectedElements > 0) {
      // 监控选中元素按钮
      const confirmElementsBtn = document.createElement("button");
      confirmElementsBtn.textContent = "监控选中元素";
      confirmElementsBtn.style.backgroundColor = "#4CAF50";
      confirmElementsBtn.style.color = "white";
      confirmElementsBtn.style.border = "none";
      confirmElementsBtn.style.padding = "8px 15px";
      confirmElementsBtn.style.borderRadius = "4px";
      confirmElementsBtn.style.cursor = "pointer";
      confirmElementsBtn.style.width = "100%";
      confirmElementsBtn.onclick = () => {
        // 收集所有元素信息
        const elementInfos = Array.from(selectedMap.values()).map(
          (el) => (el as any).targetElement.info
        );

        // 保存元素选择信息
        saveElementSelection(elementInfos, boundingBox);

        // 移除所有高亮
        Array.from(selectedMap.values()).forEach((el) => el.remove());
        controls.remove();

        // 清理
        cleanUp();
      };
      controls.appendChild(confirmElementsBtn);
    }

    // 监控选中区域按钮
    const confirmRegionBtn = document.createElement("button");
    confirmRegionBtn.textContent =
      totalSelectedElements > 0 ? "改为监控整个区域" : "监控选中区域";
    confirmRegionBtn.style.backgroundColor =
      totalSelectedElements > 0 ? "#FF9800" : "#4CAF50";
    confirmRegionBtn.style.color = "white";
    confirmRegionBtn.style.border = "none";
    confirmRegionBtn.style.padding = "8px 15px";
    confirmRegionBtn.style.borderRadius = "4px";
    confirmRegionBtn.style.cursor = "pointer";
    confirmRegionBtn.style.width = "100%";
    confirmRegionBtn.onclick = () => {
      saveSelection(boundingBox);
      // 移除所有高亮
      Array.from(selectedMap.values()).forEach((el) => el.remove());
      // 清空选择集合
      selectedMap.clear();
      controls.remove();
      cleanUp();
    };
    controls.appendChild(confirmRegionBtn);

    // 取消按钮
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.backgroundColor = "#f44336";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.padding = "8px 15px";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.width = "100%";
    cancelBtn.onclick = () => {
      // 移除所有高亮元素
      Array.from(selectedMap.values()).forEach((el) => el.remove());
      // 清空选择集合
      selectedMap.clear();
      controls.remove();
      // 清理
      cleanUp();
    };
    controls.appendChild(cancelBtn);

    // 清除所有选择按钮
    if (totalSelectedElements > 0) {
      const clearAllBtn = document.createElement("button");
      clearAllBtn.textContent = "清除所有选择";
      clearAllBtn.style.backgroundColor = "#9E9E9E";
      clearAllBtn.style.color = "white";
      clearAllBtn.style.border = "none";
      clearAllBtn.style.padding = "8px 15px";
      clearAllBtn.style.borderRadius = "4px";
      clearAllBtn.style.cursor = "pointer";
      clearAllBtn.style.width = "100%";
      clearAllBtn.onclick = () => {
        // 移除所有高亮元素
        Array.from(selectedMap.values()).forEach((el) => el.remove());
        // 清空选择集合
        selectedMap.clear();
        // 隐藏控制按钮
        controls.remove();

        // 恢复画布以便重新选择
        pathPoints = [];
        if (ctx) {
          canvas.style.backgroundColor = "transparent";
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      };
      controls.appendChild(clearAllBtn);
    }
  }

  // 保存选择信息
  function saveSelection(boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) {
    // 获取选定区域内的HTML内容
    const regionElement = document.elementFromPoint(
      boundingBox.left + boundingBox.width / 2,
      boundingBox.top + boundingBox.height / 2
    );
    
    // 尝试找到最接近选定区域的容器元素
    let targetElement = regionElement;
    let closestContainer = regionElement;
    
    if (regionElement) {
      // 向上查找可能的容器元素
      let currentEl = regionElement;
      while (currentEl && currentEl !== document.body) {
        const rect = currentEl.getBoundingClientRect();
        const isContainer = (
          rect.width >= boundingBox.width * 0.8 && 
          rect.height >= boundingBox.height * 0.8 &&
          rect.width <= boundingBox.width * 1.5 && 
          rect.height <= boundingBox.height * 1.5
        );
        
        if (isContainer) {
          closestContainer = currentEl;
          break;
        }
        currentEl = currentEl.parentElement as Element;
      }
      
      targetElement = closestContainer || regionElement;
    }
    
    // 获取区域HTML内容
    const regionHTML = targetElement ? targetElement.outerHTML : '';
    const regionInnerText = targetElement ? targetElement.textContent : '';

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
      url: window.location.href, // 保存当前页面URL
      title: document.title, // 保存页面标题
      selectionType: "region",
      html: regionHTML, // 保存区域的HTML内容
      innerText: regionInnerText, // 保存区域的文本内容
      lastCheck: new Date().toISOString(), // 添加最后检查时间
      lastContent: regionHTML, // 用于对比变化
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

// 移除可能存在的UI元素
export function removeExistingUIElements() {
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
