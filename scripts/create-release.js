// scripts/create-release.js - Creates GitHub Release and uploads ZIP archives
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 1. Get token from git credential helper
let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    const cred = execSync('printf "protocol=https\\nhost=github.com\\n" | git credential fill', { encoding: 'utf8' });
    const match = cred.match(/password=(.*)/);
    if (match) token = match[1].trim();
  } catch (err) {
    console.error('Failed to get token from git credential:', err.message);
  }
}

if (!token) {
  console.error('Error: GITHUB_TOKEN not found.');
  process.exit(1);
}

const REPO_OWNER = 'kukes-misis';
const REPO_NAME = 'csharp-gost-flowchart';
const TAG = 'v1.0.0';

const RELEASE_BODY = `# Релиз v1.0.0 — Генератор блок-схем по ГОСТ 19.701-90

Полностью автономный, бесплатный генератор блок-схем алгоритмов по ГОСТ 19.701-90 (ИСО 5807-85) с визуальным редактором, тёмной темой и поддержкой 5 языков программирования.

### 📦 Скачать готовые архивы для запуска:
- **[csharp-gost-flowchart-windows-v1.0.0.zip](https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/csharp-gost-flowchart-windows-v1.0.0.zip)** (95 КБ) — сборка для **Windows** с ярлыками запуска в 1 клик (\`start-windows.bat\` и \`open-offline-windows.bat\`).
- **[csharp-gost-flowchart-macos-v1.0.0.zip](https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/csharp-gost-flowchart-macos-v1.0.0.zip)** (95 КБ) — сборка для **macOS** с ярлыками запуска в 1 клик (\`start-macos.command\` и \`open-offline-macos.command\`).
- **[csharp-gost-flowchart-portable-all-v1.0.0.zip](https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/csharp-gost-flowchart-portable-all-v1.0.0.zip)** (97 КБ) — универсальная **Portable** сборка для всех операционных систем со всеми тестами.

---

### ✨ Главные возможности:
- **Строгий ГОСТ 19.701-90 (ИСО 5807-85)**:
  - Символы «Пуск/Останов» ($r = h/2$), «Процесс», «Данные» (параллелограмм), «Решение» (ромб с запасом $\\times 1.48$), «Подготовка» (шестиугольник для \`for\`);
  - **Стрелки НЕ ставятся** при направлении сверху вниз и слева направо (ГОСТ п. 3.2.2);
  - **Стрелки ставятся только** на линиях обратной связи (снизу вверх) и против основного потока;
  - Ортогональная трассировка без пересечений (левый канал возврата, правый канал выхода).
- **Поддержка 5 языков программирования**:
  - **C#** (C# 13 / .NET)
  - **Python** (Python 3)
  - **C++** (ISO C++)
  - **ANSI C** (C99)
  - **Go** (Golang)
- **🌙 Тёмная тема** и **☀️ Светлая тема** оформления с автосохранением в браузере.
- **Интерактивный редактор**: ручное перемещение блоков (drag & drop), привязка к направляющим, сетка, добавление/удаление блоков, Undo/Redo.
- **Экспорт в 3 формата**:
  - Векторный **SVG**;
  - Растровый **PNG** высокого разрешения ($2.5\\times$ Retina);
  - Нативный **Microsoft Visio (.VSDX)**.
- **100% автономно и бесплатно**: без регистраций, без интернета и без скрытых платежей.
`;

function apiRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        try {
          const json = JSON.parse(text);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
          }
        } catch {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(text);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function uploadAsset(uploadUrlTemplate, filePath, fileName) {
  const fileBytes = fs.readFileSync(filePath);
  const cleanUrl = uploadUrlTemplate.replace(/\{.*?\}$/, '') + '?name=' + encodeURIComponent(fileName);
  const urlObj = new URL(cleanUrl);

  console.log(`Загрузка архива ${fileName} (${(fileBytes.length / 1024).toFixed(1)} КБ)...`);

  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'User-Agent': 'Gost-Flowchart-Publisher',
      'Authorization': 'token ' + token,
      'Content-Type': 'application/zip',
      'Content-Length': fileBytes.length
    }
  };

  return apiRequest(options, fileBytes);
}

async function main() {
  console.log('======================================================');
  console.log(`  Публикация релиза ${TAG} в kukes-misis/${REPO_NAME}`);
  console.log('======================================================\n');

  // 1. Create or get release
  console.log('Создание GitHub Release...');
  const releasePayload = JSON.stringify({
    tag_name: TAG,
    target_commitish: 'main',
    name: `${TAG} — Официальный релиз (ГОСТ 19.701-90)`,
    body: RELEASE_BODY,
    draft: false,
    prerelease: false
  });

  let release;
  try {
    release = await apiRequest({
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
      method: 'POST',
      headers: {
        'User-Agent': 'Gost-Flowchart-Publisher',
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(releasePayload)
      }
    }, releasePayload);
    console.log(`✔ Релиз успешно создан! ID: ${release.id}`);
  } catch (err) {
    if (err.message.includes('already_exists')) {
      console.log('Релиз уже существует, получаем существующий...');
      release = await apiRequest({
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${TAG}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Gost-Flowchart-Publisher',
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      console.log(`✔ Найден существующий релиз ID: ${release.id}`);
    } else {
      throw err;
    }
  }

  // 2. Upload assets
  const filesToUpload = [
    { name: `csharp-gost-flowchart-windows-${TAG}.zip`, path: `/tmp/gost-release-build/csharp-gost-flowchart-windows-${TAG}.zip` },
    { name: `csharp-gost-flowchart-macos-${TAG}.zip`, path: `/tmp/gost-release-build/csharp-gost-flowchart-macos-${TAG}.zip` },
    { name: `csharp-gost-flowchart-portable-all-${TAG}.zip`, path: `/tmp/gost-release-build/csharp-gost-flowchart-portable-all-${TAG}.zip` }
  ];

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.path)) {
      throw new Error(`Файл не найден: ${item.path}`);
    }
    const uploaded = await uploadAsset(release.upload_url, item.path, item.name);
    console.log(`  ✔ Загружен: ${item.name} -> ${uploaded.browser_download_url || uploaded.id}`);
  }

  console.log('\n======================================================');
  console.log('  Все архивы успешно добавлены в релиз!');
  console.log(`  Ссылка на релиз: ${release.html_url}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Ошибка публикации релиза:', err);
  process.exit(1);
});
