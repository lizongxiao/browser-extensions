import http from 'http';
import { WebSocketServer } from 'ws';

// 常量定义
const PORT = 8787;
const UPDATE_CONTENT = 'UPDATE_CONTENT';
const EXTENSION_NAME = 'web-update-alerts';

// 创建HTTP服务器
function createServer(port) {
  const server = http.createServer();
  
  return new Promise((resolve, reject) => {
    const onError = (e) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`端口 ${port} 已被占用，尝试下一个端口...`);
        server.listen(++port);
      } else {
        server.removeListener('error', onError);
        reject(e);
      }
    };
    
    server.on('error', onError);
    server.listen(port, () => {
      console.log(`WebSocket 服务器已启动，端口: ${port}`);
      server.removeListener('error', onError);
      resolve({ server, port });
    });
  });
}

// 启动WebSocket服务器
async function startDevServer() {
  const { server, port } = await createServer(PORT);
  const wss = new WebSocketServer({ noServer: true });
  let socket = null;

  wss.on('connection', (ws) => {
    console.log('客户端已连接');
    socket = ws;
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          // 保持连接
        }
      } catch (e) {
        // 忽略无效消息
      }
    });
    
    ws.on('close', () => {
      console.log('客户端已断开连接');
      socket = null;
    });
  });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === `/${encodeURIComponent(EXTENSION_NAME)}/crx`) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // 导出通知客户端更新的函数
  return {
    notifyUpdate: () => {
      if (socket) {
        socket.send(UPDATE_CONTENT);
        console.log('通知客户端更新');
      }
    },
    port
  };
}

// 导出模块
export { startDevServer }; 