import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Please run npm run build first.');
  process.exit(1);
}

// Recursively find all HTML files
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (filePath.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const htmlFiles = findHtmlFiles(distDir);
const urls = htmlFiles.map(file => {
  let relativePath = path.relative(distDir, file);
  // Convert Windows paths to URL paths
  relativePath = relativePath.split(path.sep).join('/');
  
  if (relativePath === 'index.html') return 'http://localhost:4321/';
  if (relativePath.endsWith('/index.html')) {
    return `http://localhost:4321/${relativePath.slice(0, -11)}/`;
  }
  if (relativePath.endsWith('.html')) {
    return `http://localhost:4321/${relativePath.slice(0, -5)}`;
  }
  return `http://localhost:4321/${relativePath}`;
});

console.log(`Found ${urls.length} URLs to audit...`);
console.log('Running axe-core on:\\n  ' + urls.join('\\n  '));

// Execute axe-core via npx
const result = spawnSync('npx', ['@axe-core/cli', ...urls, '--exit'], { stdio: 'inherit', shell: true });

if (result.status !== 0) {
  console.error('Accessibility audit failed!');
  process.exit(1);
} else {
  console.log('Accessibility audit passed!');
}
