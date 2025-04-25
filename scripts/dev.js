import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import chokidar from 'chokidar';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建WebSocket服务器需要通过动态导入
async function startDevServer() {
  const { startDevServer: startServer } = await import('./dev-server.js');
  return startServer();
}

async function main() {
  // 设置环境变量
  process.env.NODE_ENV = 'development';
  
  // 启动WebSocket服务器
  const { notifyUpdate, port } = await startDevServer();
  
  // 创建一个常量定义文件，供客户端使用
  const constantsDir = resolve(__dirname, '../src/dev');
  const constantsFile = resolve(constantsDir, 'constants.ts');
  
  if (!fs.existsSync(constantsDir)) {
    fs.mkdirSync(constantsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    constantsFile,
    `export const DEV_SERVER_PORT = ${port};
export const EXTENSION_NAME = 'web-update-alerts';
export const UPDATE_CONTENT = 'UPDATE_CONTENT';
export const RELOAD = 'RELOAD';`
  );
  
  // 使用exec替代spawn来运行pnpm命令
  console.log('启动Vite构建扩展...');
  const buildProcess = exec('npx vite build --watch', { 
    windowsHide: false 
  });
  
  let buildProcessFailed = false;
  
  buildProcess.stderr.on('data', (data) => {
    console.error(`构建错误: ${data}`);
    buildProcessFailed = true;
  });
  
  buildProcess.stdout.on('data', (data) => {
    console.log(`构建输出: ${data}`);
  });
  
  buildProcess.on('error', (error) => {
    console.error('构建过程启动失败:', error);
    process.exit(1);
  });
  
  // 等待初始构建完成
  console.log('等待初始构建完成...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  if (buildProcessFailed) {
    console.error('构建过程失败，终止热重载');
    process.exit(1);
  }
  
  // 构建开发脚本
  console.log('编译开发脚本...');
  await new Promise((resolve, reject) => {
    exec('node scripts/build-dev-scripts.js', (error) => {
      if (error) {
        console.error('编译开发脚本失败:', error);
        reject(error);
        return;
      }
      console.log('开发脚本编译完成');
      resolve();
    });
  });
  
  // 修改manifest添加热重载脚本
  await new Promise((resolve, reject) => {
    exec('node scripts/modify-manifest.js --dev', (error) => {
      if (error) {
        console.error('修改manifest失败:', error);
        reject(error);
        return;
      }
      console.log('热重载脚本已添加');
      resolve();
    });
  });
  
  // 监听文件变化 - 仅监听关键文件以触发热重载通知
  const watcher = chokidar.watch([
    'src/background/**/*.{js,ts}',
    'src/content/**/*.{js,ts,vue}',
    'src/utils/**/*.{js,ts}',
    'src/components/**/*.{js,ts,vue}'
  ], {
    ignored: ['**/node_modules/**', '**/dist/**'],
    ignoreInitial: true
  });
  
  let notifyTimeout;
  
  watcher.on('change', (path) => {
    console.log(`文件变更: ${path}`);
    
    // 防抖：避免短时间内多次通知
    clearTimeout(notifyTimeout);
    notifyTimeout = setTimeout(async () => {
      try {
        // 编译开发脚本
        await new Promise((resolve, reject) => {
          exec('node scripts/build-dev-scripts.js', (error) => {
            if (error) {
              console.error('编译开发脚本失败:', error);
              reject(error);
              return;
            }
            resolve();
          });
        });
        
        // 修改manifest
        await new Promise((resolve, reject) => {
          exec('node scripts/modify-manifest.js --dev', (error) => {
            if (error) {
              console.error('修改manifest失败:', error);
              reject(error);
              return;
            }
            resolve();
          });
        });
        
        // 通知客户端更新
        notifyUpdate();
        console.log('已通知客户端更新');
      } catch (error) {
        console.error('更新过程中出错:', error);
      }
    }, 300);
  });
  
  console.log('文件监视器已启动，等待文件变更...');
  console.log('请加载扩展并打开带有扩展内容的网页以建立WebSocket连接');
  
  // 处理进程退出
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, async () => {
      try {
        buildProcess.kill();
        process.exit(0);
      } catch (e) {
        console.error('关闭时出错:', e);
        process.exit(1);
      }
    });
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 