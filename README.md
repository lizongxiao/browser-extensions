# ScrollWebSizeTop Chrome 扩展

这是一个使用 Vue 3 和组合式 API 开发的 Chrome 扩展，提供滚动到页面顶部的功能。

## 功能特点

- 在页面右下角显示滚动到顶部的按钮
- 可以通过扩展的弹出窗口开启/关闭该功能
- 支持亮色/暗色主题切换

## 开发技术栈

- Vue 3 (使用组合式 API)
- TypeScript
- Vite
- Chrome 扩展 Manifest V3
- CRXJS Vite Plugin

## 开发指南

### 安装依赖

```bash
npm install
```

### 开发构建（带热重载）

```bash
npm run watch
```

### 生产构建

```bash
npm run build
```

## 本地调试方法

1. 运行构建命令生成 dist 目录
   ```bash
   npm run build
   ```

2. 打开 Chrome 浏览器
3. 访问 `chrome://extensions/`
4. 启用右上角的"开发者模式"
5. 点击左上角的"加载已解压的扩展程序"
6. 选择项目中的 `dist` 目录
7. 现在扩展已安装在您的浏览器中
8. 点击工具栏中的扩展图标以打开弹出窗口
9. 访问任何网站，滚动页面以测试功能

## 开发时热重载

对于开发期间的热重载：

```bash
npm run watch
```

然后在 `chrome://extensions/` 页面点击扩展卡片上的"重新加载"按钮应用更改。

## 项目结构

- `src/background/`: 扩展的背景脚本
- `src/content/`: 内容脚本（注入到页面中）
- `src/popup/`: 扩展的弹出窗口
- `src/components/`: Vue 组件
- `src/assets/`: 静态资源（图标等）
- `public/`: 公共静态资源

## 许可证

ISC 