console.log("加载内容脚本");

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "activateSelectMode") {
    activateCanvasMode();
  }
});

// 激活Canvas模式
function activateCanvasMode() {
  // 创建覆盖层容器
  const overlayContainer = document.createElement('div');
  overlayContainer.id = 'web-update-alerts-container';
  overlayContainer.style.position = 'fixed';
  overlayContainer.style.top = '0';
  overlayContainer.style.left = '0';
  overlayContainer.style.width = '100%';
  overlayContainer.style.height = '100%';
  overlayContainer.style.zIndex = '2147483647'; // 最高层级
  document.body.appendChild(overlayContainer);

  // 创建提示文字
  const instructions = document.createElement('div');
  instructions.textContent = '在页面上拖动鼠标绘制轨迹，按ESC取消，按Enter确认';
  instructions.style.position = 'fixed';
  instructions.style.top = '10px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  instructions.style.color = 'white';
  instructions.style.padding = '10px 15px';
  instructions.style.borderRadius = '5px';
  instructions.style.fontSize = '14px';
  instructions.style.zIndex = '2147483647';
  overlayContainer.appendChild(instructions);

  // 创建Canvas元素
  const canvas = document.createElement('canvas');
  canvas.id = 'web-update-alerts-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '2147483646'; // 略低于容器
  canvas.style.cursor = 'crosshair';
  overlayContainer.appendChild(canvas);

  // 获取Canvas上下文
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('无法获取Canvas上下文');
    return;
  }

  // 绘制灰色半透明背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 轨迹相关变量
  let isDrawing = false;
  let pathPoints: {x: number, y: number}[] = [];
  
  // 绘制轨迹函数
  function drawPath() {
    if (pathPoints.length < 2 || !ctx) return;
    
    // 清除轨迹（保留灰色背景）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 设置绘制样式
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
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
      height: maxY - minY
    };
  }

  // 鼠标事件处理
  function handleMouseDown(e: MouseEvent) {
    isDrawing = true;
    pathPoints = [{x: e.clientX, y: e.clientY}];
    drawPath();
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing) return;
    
    pathPoints.push({x: e.clientX, y: e.clientY});
    drawPath();
  }
  
  function handleMouseUp(e: MouseEvent) {
    if (!isDrawing) return;
    
    isDrawing = false;
    pathPoints.push({x: e.clientX, y: e.clientY});
    drawPath();
    
    // 绘制包围框
    const boundingBox = getPathBoundingBox();
    if (boundingBox && ctx) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        boundingBox.left, 
        boundingBox.top, 
        boundingBox.width, 
        boundingBox.height
      );
      
      // 添加确认取消按钮
      addControls(boundingBox);
    }
  }
  
  // 键盘事件处理
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // ESC键取消选择
      cleanUp();
    } else if (e.key === 'Enter') {
      // Enter键确认选择
      const boundingBox = getPathBoundingBox();
      if (boundingBox) {
        saveSelection(boundingBox);
      }
      cleanUp();
    }
  }
  
  // 添加控制按钮
  function addControls(boundingBox: {left: number, top: number, width: number, height: number}) {
    // 创建控制按钮容器
    const controls = document.createElement('div');
    controls.id = 'web-update-alerts-controls';
    controls.style.position = 'fixed';
    controls.style.left = `${boundingBox.left + boundingBox.width / 2 - 75}px`;
    controls.style.top = `${boundingBox.top + boundingBox.height + 10}px`;
    controls.style.zIndex = '2147483647';
    controls.style.backgroundColor = '#ffffff';
    controls.style.border = '1px solid #cccccc';
    controls.style.borderRadius = '4px';
    controls.style.padding = '5px';
    controls.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    controls.style.display = 'flex';
    controls.style.gap = '5px';
    overlayContainer.appendChild(controls);
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认选择';
    confirmBtn.style.backgroundColor = '#4CAF50';
    confirmBtn.style.color = 'white';
    confirmBtn.style.border = 'none';
    confirmBtn.style.padding = '5px 10px';
    confirmBtn.style.borderRadius = '4px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.onclick = () => {
      saveSelection(boundingBox);
      cleanUp();
    };
    controls.appendChild(confirmBtn);
    
    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.backgroundColor = '#f44336';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.padding = '5px 10px';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = cleanUp;
    controls.appendChild(cancelBtn);
    
    // 清除按钮
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '重新绘制';
    clearBtn.style.backgroundColor = '#2196F3';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.padding = '5px 10px';
    clearBtn.style.borderRadius = '4px';
    clearBtn.style.cursor = 'pointer';
    clearBtn.onclick = () => {
      // 移除控制按钮
      controls.remove();
      // 清除画布，重新开始
      pathPoints = [];
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    controls.appendChild(clearBtn);
  }
  
  // 保存选择信息
  function saveSelection(boundingBox: {left: number, top: number, width: number, height: number}) {
    // 添加滚动位置，转换为页面绝对位置
    const selection = {
      left: boundingBox.left + window.scrollX,
      top: boundingBox.top + window.scrollY,
      width: boundingBox.width,
      height: boundingBox.height,
      pathPoints: pathPoints.map(p => ({ 
        x: p.x + window.scrollX, 
        y: p.y + window.scrollY 
      }))
    };
    
    console.log('保存选择:', selection);
    
    // 将选择信息发送到后台脚本
    chrome.runtime.sendMessage({
      action: 'saveSelection',
      selection: selection
    });
  }
  
  // 清理函数
  function cleanUp() {
    // 移除事件监听器
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    
    // 移除整个容器
    overlayContainer.remove();
  }
  
  // 添加事件监听器
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
}
