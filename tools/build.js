/* 打包为单文件 HTML：把 CSS 与 JS 内联，便于直接分发与预览 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
const js = ['js/data.js', 'js/engine.js', 'js/ui.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n\n');

const safe = s => s.replace(/<\/script/gi, '<\\/script');

html = html.replace(
  /<link rel="stylesheet" href="css\/style\.css" \/>/,
  '<style>\n' + css + '\n</style>'
);
html = html.replace(
  /<script src="js\/data\.js"><\/script>\s*<script src="js\/engine\.js"><\/script>\s*<script src="js\/ui\.js"><\/script>/,
  '<script>\n' + safe(js) + '\n</script>'
);

const out = path.join(ROOT, '将星之路-单文件版.html');
fs.writeFileSync(out, html, 'utf8');
console.log('已生成：' + out + '（' + (html.length / 1024).toFixed(1) + ' KB）');
