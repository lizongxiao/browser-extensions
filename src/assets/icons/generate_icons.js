// 这是一个生成简单SVG图标的脚本，实际项目中应该替换为真实图标
const fs = require('fs');
const path = require('path');

// 简单的SVG图标
const svgIcon = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#3a7bd5"/>
  <path d="M64 40 L90 70 L70 70 L70 90 L58 90 L58 70 L38 70 Z" fill="white"/>
</svg>
`;

// 保存SVG文件
fs.writeFileSync(path.join(__dirname, 'icon.svg'), svgIcon);

console.log('图标生成完成！'); 