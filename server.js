// server.js - Zero-dependency local HTTP server for C# GOST flowchart suite
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.vsdx': 'application/vnd.ms-visio.drawing',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Optional API build support
const CSharpParser = require('./static/js/csharp-parser');
const CFGBuilder = require('./static/js/cfg-builder');
const GOSTLayout = require('./static/js/gost-layout');
const GOSTRenderer = require('./static/js/gost-renderer');

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoint /api/build (for programmatic building)
  if (req.url === '/api/build' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const code = payload.code || '';
        const ast = CSharpParser.parse(code);
        const cfg = CFGBuilder.buildCFG(ast, { showMethodName: true });
        const model = GOSTLayout.layoutDiagram(cfg);
        const svg = GOSTRenderer.renderModelSVG(model);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          svg: svg,
          width: model.width,
          height: model.height,
          model: model,
          error: null
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static file serving
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, reqPath));

  // Security check: ensure path is within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`
======================================================
  C# ГОСТ 19.701-90 Flowchart Server
======================================================
  Веб-приложение запущено: http://localhost:${PORT}
  API эндпоинт:           http://localhost:${PORT}/api/build
  Каталог файлов:         ${ROOT}
======================================================
`);
});
