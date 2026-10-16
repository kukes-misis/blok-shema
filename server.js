// server.js - Hardened HTTP Server & Telegram Mini App host for «Блок-Схема»
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  loadEnv,
  sanitizeSVG,
  redactToken
} = require('./bot-security');

// Load environment variables from .env
loadEnv();

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload limit

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

// Flowchart generation core modules
const LangParsers = require('./static/js/lang-parsers');
const CFGBuilder = require('./static/js/cfg-builder');
const GOSTLayout = require('./static/js/gost-layout');
const GOSTRenderer = require('./static/js/gost-renderer');

const server = http.createServer((req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');

  // Hardened Security Headers (Permitting Telegram Mini App iframes)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' https://telegram.org; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org;"
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API endpoint /api/build (for programmatic building)
  if (req.url === '/api/build' && req.method === 'POST') {
    let body = '';
    let bodySize = 0;

    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_PAYLOAD_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Размер тела запроса превышает лимит (1 МБ)' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const code = payload.code || '';
        const lang = payload.lang || 'csharp';

        if (code.length > 25000) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Код превышает допустимый лимит (25 КБ)' }));
          return;
        }

        const ast = LangParsers.parse(code, lang);
        const cfg = CFGBuilder.buildCFG(ast, { showMethodName: true });
        const model = GOSTLayout.layoutDiagram(cfg);
        const rawSvg = GOSTRenderer.renderModelSVG(model);
        const cleanSvg = sanitizeSVG(rawSvg);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          svg: cleanSvg,
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

  // Static file serving with strict path traversal protection
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, reqPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  // Block direct serving of sensitive files (.env, secrets, logs)
  const baseName = path.basename(filePath);
  if (baseName.startsWith('.env') || baseName.includes('token') || baseName.includes('secret')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ОШИБКА] Порт ${PORT} уже занят другим приложением.`);
    console.error(`Вы можете открыть index.html напрямую в браузере без запуска локального сервера!\n`);
  } else {
    console.error(`\n[ОШИБКА СЕРВЕРА]`, err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
======================================================
  ГОСТ 19.701-90 Flowchart Server & Mini App
======================================================
  Локальный доступ (IPv4): http://127.0.0.1:${PORT}
  Локальный доступ:        http://localhost:${PORT}
  API эндпоинт:           http://127.0.0.1:${PORT}/api/build
  Каталог файлов:         ${ROOT}
  Защита заголовков:      CSP + nosniff + 1MB payload limit
  Автономный режим:        Можно открыть index.html напрямую!
======================================================
`);

  // Optionally launch Telegram Bot alongside server
  if (process.argv.includes('--with-bot') || process.env.START_BOT === 'true') {
    try {
      const { pollUpdates } = require('./bot.js');
      console.log('🤖 Запуск Telegram-бота параллельно с сервером...');
      pollUpdates().catch(botErr => {
        console.error('Ошибка в цикле Telegram-бота:', botErr.message);
      });
    } catch (e) {
      console.error('Не удалось запустить Telegram-бота:', e.message);
    }
  }
});

module.exports = server;
