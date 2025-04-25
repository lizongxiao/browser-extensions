import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildDevScripts() {
  try {
    // 确保目标目录存在
    const outputDir = resolve(__dirname, '../dist/src/dev');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 首先确保constants.ts文件存在
    const constantsFile = resolve(__dirname, '../src/dev/constants.ts');
    if (!fs.existsSync(constantsFile)) {
      console.error('constants.ts文件不存在，请先运行开发服务器');
      process.exit(1);
    }
    
    // 编译background-dev.ts
    await build({
      entryPoints: [resolve(__dirname, '../src/dev/background-dev.ts')],
      outfile: resolve(outputDir, 'background-dev.js'),
      bundle: true,
      minify: false,
      format: 'esm',
      platform: 'browser',
      target: ['chrome90'],
      define: {
        'process.env.NODE_ENV': '"development"'
      },
      loader: {
        '.ts': 'ts'
      }
    });
    
    // 编译content-dev.ts
    await build({
      entryPoints: [resolve(__dirname, '../src/dev/content-dev.ts')],
      outfile: resolve(outputDir, 'content-dev.js'),
      bundle: true,
      minify: false,
      format: 'esm',
      platform: 'browser',
      target: ['chrome90'],
      define: {
        'process.env.NODE_ENV': '"development"'
      },
      loader: {
        '.ts': 'ts'
      }
    });
    
    console.log('开发脚本编译完成');
  } catch (error) {
    console.error('编译开发脚本时出错:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

buildDevScripts(); 