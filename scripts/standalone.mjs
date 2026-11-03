import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Keep the normal Vite output, and additionally produce a file://-compatible standalone game.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');

// Match script tag whether base is relative (./assets/...) or absolute (/ram-hunter/assets/...)
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
if (!script) throw new Error('The Vite entry script was not found. Run vite build first.');

const jsFileName = path.basename(script[1]);
const js = await readFile(path.join(dist, 'assets', jsFileName), 'utf8');
if (/\bfrom\s*["']\.\//.test(js)) throw new Error('Standalone output must contain no external JS chunks.');
html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);

// Inline stylesheets
for (const match of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]) {
  const cssFileName = path.basename(match[1]);
  const css = await readFile(path.join(dist, 'assets', cssFileName), 'utf8');
  html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}

// Inline favicon as data URI for local offline compatibility
const icon = await readFile(path.join(dist, 'favicon.svg'), 'utf8');
const data = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
html = html.replaceAll('./favicon.svg', data);
html = html.replaceAll('/ram-hunter/favicon.svg', data);
html = html.replaceAll('/favicon.svg', data);

// Ensure brand anchor works safely on standalone local file
html = html.replaceAll('href="/ram-hunter/"', 'href="./"');

await writeFile(path.join(dist, 'RAM-HUNTER.html'), html, 'utf8');
console.log(`Standalone game: dist/RAM-HUNTER.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
