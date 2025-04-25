/**
 * 此脚本用于修改扩展清单
 * 在开发模式下注入热重载脚本
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取命令行参数
const args = process.argv.slice(2);
const devMode = args.includes('--dev') || process.env.NODE_ENV === 'development';

// 修改manifest.json
function modifyManifest() {
  const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
  
  // 读取构建后的manifest.json
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json不存在，请先构建项目');
    process.exit(1);
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // 如果是开发模式，添加热重载脚本
    if (devMode) {
      // 确保web_accessible_resources已存在
      if (!manifest.web_accessible_resources) {
        manifest.web_accessible_resources = [];
      }
      
      // 添加开发脚本到可访问资源
      const devResourceEntry = {
        resources: ["src/dev/*"],
        matches: ["<all_urls>"]
      };
      
      let hasDevResources = false;
      
      // 检查是否已添加开发资源
      for (const resource of manifest.web_accessible_resources) {
        if (resource.resources && resource.resources.includes("src/dev/*")) {
          hasDevResources = true;
          break;
        }
      }
      
      if (!hasDevResources) {
        manifest.web_accessible_resources.push(devResourceEntry);
      }
      
      // 添加content script
      const contentDevScript = {
        matches: ['<all_urls>'],
        js: ['src/dev/content-dev.js'],
        run_at: 'document_start'
      };
      
      if (!manifest.content_scripts) {
        manifest.content_scripts = [contentDevScript];
      } else {
        // 检查是否已添加
        let hasDevScript = false;
        for (const script of manifest.content_scripts) {
          if (script.js && script.js.includes('src/dev/content-dev.js')) {
            hasDevScript = true;
            break;
          }
        }
        
        if (!hasDevScript) {
          manifest.content_scripts.push(contentDevScript);
        }
      }
      
      // 如果没有后台脚本，创建一个
      if (!manifest.background) {
        manifest.background = {
          service_worker: 'src/dev/background-dev.js',
          type: 'module'
        };
      } else {
        // 备份原始service_worker
        const originalServiceWorker = manifest.background.service_worker;
        
        // 创建一个包装后台脚本，导入开发脚本和原始脚本
        const wrapperContent = 
          `import './src/dev/background-dev.js';
import './${originalServiceWorker}';`;
        
        // 写入包装脚本
        fs.writeFileSync(
          path.resolve(__dirname, '../dist/background-wrapper.js'), 
          wrapperContent
        );
        
        // 修改manifest指向包装脚本
        manifest.background.service_worker = 'background-wrapper.js';
      }
      
      console.log('已添加热重载脚本到manifest');
    }
    
    // 写回修改后的manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('已更新manifest.json');
  } catch (error) {
    console.error('修改manifest时出错:', error);
    process.exit(1);
  }
}

modifyManifest(); 