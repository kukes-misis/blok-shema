// bot.js - High-Security Telegram Bot & Mini App Companion for «Блок-Схема»
'use strict';

const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const {
  loadEnv,
  RateLimiter,
  validateInput,
  sanitizeSVG,
  redactToken,
  MAX_CODE_LENGTH
} = require('./bot-security');

// Load environment variables from .env
loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TMA_APP_URL = process.env.TMA_APP_URL || 'https://kukes-misis.github.io/blok-shema/';
const PORT = process.env.PORT || 8080;

if (!BOT_TOKEN || BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.error(`
❌ ОШИБКА: Токен Telegram-бота не задан!
Укажите ваш токен в локальном файле .env:
TELEGRAM_BOT_TOKEN=your_token_here
`);
  process.exit(1);
}

// Import GOST Flowchart Core modules
const LangParsers = require('./static/js/lang-parsers');
const CFGBuilder = require('./static/js/cfg-builder');
const GOSTLayout = require('./static/js/gost-layout');
const GOSTRenderer = require('./static/js/gost-renderer');

// Anti-Spam Rate Limiter
const rateLimiter = new RateLimiter({
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 5,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 10000,
  cooldownMs: parseInt(process.env.RATE_LIMIT_COOLDOWN_MS, 10) || 30000
});

// User preferences (language, etc.)
const userSettings = new Map();

// Helper to delay for animated motion in chat
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Low-level Telegram API client (Zero external dependencies)
function callTelegramAPI(method, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.ok) {
            resolve(json.result);
          } else {
            reject(new Error(`Telegram API [${method}] Error: ${json.description || 'Unknown'}`));
          }
        } catch (err) {
          reject(new Error(`Telegram JSON parse error: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Telegram API timeout on [${method}]`));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Multipart file upload for SVG documents
function sendTelegramDocument(chatId, fileBuffer, fileName, caption, replyMarkup) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const crlf = '\r\n';

    let header = `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="chat_id"${crlf}${crlf}` +
      `${chatId}${crlf}`;

    if (caption) {
      header += `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="caption"${crlf}${crlf}` +
        `${caption}${crlf}`;
      header += `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="parse_mode"${crlf}${crlf}` +
        `HTML${crlf}`;
    }

    if (replyMarkup) {
      header += `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="reply_markup"${crlf}${crlf}` +
        `${JSON.stringify(replyMarkup)}${crlf}`;
    }

    header += `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="document"; filename="${fileName}"${crlf}` +
      `Content-Type: image/svg+xml${crlf}${crlf}`;

    const footer = `${crlf}--${boundary}--${crlf}`;

    const totalLength = Buffer.byteLength(header) + fileBuffer.length + Buffer.byteLength(footer);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendDocument`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      },
      timeout: 45000
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.ok) resolve(json.result);
          else reject(new Error(`SendDocument error: ${json.description}`));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(header);
    req.write(fileBuffer);
    req.write(footer);
    req.end();
  });
}

// Telegram messaging helpers
async function sendMessage(chatId, text, replyMarkup, parseMode = 'HTML') {
  return callTelegramAPI('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
    disable_web_page_preview: true
  });
}

async function editMessage(chatId, messageId, text, replyMarkup, parseMode = 'HTML') {
  try {
    return await callTelegramAPI('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: parseMode,
      reply_markup: replyMarkup,
      disable_web_page_preview: true
    });
  } catch (e) {
    // Ignore error if content is identical
    return null;
  }
}

async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  try {
    return await callTelegramAPI('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    });
  } catch (e) {
    return null;
  }
}

// Common Keyboards
function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '🚀 Открыть Блок-Схема (Mini App)',
          web_app: { url: TMA_APP_URL }
        }
      ],
      [
        { text: '📚 Примеры лабораторных', callback_data: 'menu_examples' },
        { text: '🌐 Язык кода', callback_data: 'menu_lang' }
      ],
      [
        { text: '📐 Стандарт ГОСТ 19.701-90', callback_data: 'menu_gost' },
        { text: 'ℹ️ Помощь', callback_data: 'menu_help' }
      ]
    ]
  };
}

function getLanguageKeyboard(currentLang = 'csharp') {
  const langs = [
    { id: 'csharp', name: 'C# (C-Sharp)', flag: '🟣' },
    { id: 'python', name: 'Python 3', flag: '🐍' },
    { id: 'cpp', name: 'C++ (ISO C++)', flag: '🔵' },
    { id: 'c', name: 'ANSI C', flag: '⚪' },
    { id: 'go', name: 'Go (Golang)', flag: '🩵' }
  ];

  const rows = langs.map(l => [{
    text: (l.id === currentLang ? '✅ ' : '') + `${l.flag} ${l.name}`,
    callback_data: `setlang_${l.id}`
  }]);

  rows.push([{ text: '◀️ В главное меню', callback_data: 'menu_main' }]);
  return { inline_keyboard: rows };
}

function getExamplesKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🐍 Python: Поиск максимума', callback_data: 'ex_py_max' },
        { text: '🟣 C#: Линейный ввод/вывод', callback_data: 'ex_cs_io' }
      ],
      [
        { text: '🔵 C++: Сумма ряда и циклы', callback_data: 'ex_cpp_sum' },
        { text: '🩵 Go: Ветвления if-else', callback_data: 'ex_go_if' }
      ],
      [
        { text: '◀️ В главное меню', callback_data: 'menu_main' }
      ]
    ]
  };
}

// Built-in Examples Code Snippets
const EXAMPLES = {
  ex_py_max: {
    lang: 'python',
    title: 'Python: Поиск максимума в массиве',
    code: `n = int(input())
a = []
for i in range(n):
    val = int(input())
    a.append(val)

max_val = a[0]
for x in a:
    if x > max_val:
        max_val = x

print(max_val)`
  },
  ex_cs_io: {
    lang: 'csharp',
    title: 'C#: Линейные вычисления и формулы',
    code: `using System;

class Program
{
    static void Main()
    {
        Console.Write("Enter a: ");
        double a = double.Parse(Console.ReadLine());
        Console.Write("Enter b: ");
        double b = double.Parse(Console.ReadLine());
        double s = a + b;
        double p = a * b;
        Console.WriteLine($"Сумма = {s}");
        Console.WriteLine($"Произведение = {p}");
    }
}`
  },
  ex_cpp_sum: {
    lang: 'cpp',
    title: 'C++: Сумма натуральных чисел (цикл for)',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cout << "Введите n: ";
    cin >> n;
    long long sum = 0;
    for (int i = 1; i <= n; i++) {
        sum += i;
    }
    cout << "Сумма = " << sum << endl;
    return 0;
}`
  },
  ex_go_if: {
    lang: 'go',
    title: 'Go: Проверка знака и условий',
    code: `package main
import "fmt"

func main() {
    var x int
    fmt.Scan(&x)
    if x > 0 {
        fmt.Println("Положительное")
    } else if x < 0 {
        fmt.Println("Отрицательное")
    } else {
        fmt.Println("Ноль")
    }
}`
  }
};

// Process user code with Motion Design progress in chat
async function handleUserCode(chatId, codeText, forcedLang = null) {
  const userId = chatId;

  // 1. Rate Limiting Check (Anti-Flood Protection)
  const rlCheck = rateLimiter.check(userId);
  if (!rlCheck.allowed) {
    await sendMessage(chatId, rlCheck.message, getMainKeyboard());
    return;
  }

  // 2. Validate input ("Защита от дурака" & size checks)
  const validation = validateInput(codeText);
  if (!validation.valid) {
    if (validation.conversational) {
      await sendMessage(
        chatId,
        `👋 <b>Здравствуйте!</b>\n\n` +
        `Я робот-чертёжник комплекса <b>«Блок-Схема»</b>. Я строю идеальные блок-схемы по ГОСТ 19.701-90.\n\n` +
        `💡 <i>Просто отправьте мне в чат фрагмент кода вашей программы</i> на <b>Python, C++, C#, C или Go</b>, и я мгновенно сгенерирую схему!\n\n` +
        `Либо воспользуйтесь готовыми примерами и интерактивным Mini App:`,
        getMainKeyboard()
      );
      return;
    }
    await sendMessage(chatId, `⚠️ <b>Ошибка ввода:</b>\n${validation.reason}`, getMainKeyboard());
    return;
  }

  const lang = forcedLang || userSettings.get(userId) || validation.detectedLang || 'csharp';
  const langNames = { csharp: 'C#', python: 'Python', cpp: 'C++', c: 'C', go: 'Go' };

  // 3. Motion Design: Animated Drafting Steps in Telegram
  const startMsg = await sendMessage(
    chatId,
    `📐 <b>[ ▱ ▱ ▱ ▱ ▱ ]</b> Чтение алгоритма (<code>${langNames[lang] || lang}</code>)...`
  );
  const msgId = startMsg ? startMsg.message_id : null;

  try {
    const t0 = Date.now();

    // Motion Step 1: Lexing & Parsing
    if (msgId) {
      await sleep(180);
      await editMessage(
        chatId,
        msgId,
        `⚡ <b>[ ▰ ▰ ▱ ▱ ▱ ]</b> Синтаксический анализ и построение графа потока...`
      );
    }

    const ast = LangParsers.parse(validation.code, lang);
    const cfg = CFGBuilder.buildCFG(ast, { showMethodName: true });

    // Motion Step 2: GOST 19.701-90 Layout
    if (msgId) {
      await sleep(180);
      await editMessage(
        chatId,
        msgId,
        `📐 <b>[ ▰ ▰ ▰ ▰ ▱ ]</b> Ортогональная раскладка по ГОСТ 19.701-90...`
      );
    }

    const model = GOSTLayout.layoutDiagram(cfg);
    const rawSvg = GOSTRenderer.renderModelSVG(model);
    const cleanSvg = sanitizeSVG(rawSvg);

    const elapsed = Date.now() - t0;
    const numBlocks = (model.blocks || []).length;
    const numEdges = (model.edges || []).length;

    // Motion Step 3: Finished!
    if (msgId) {
      await editMessage(
        chatId,
        msgId,
        `✨ <b>[ ▰ ▰ ▰ ▰ ▰ ]</b> Блок-схема успешно построена за <b>${elapsed} мс</b>!`
      );
    }

    // 4. Send SVG file document
    const svgBuffer = Buffer.from(cleanSvg, 'utf8');
    const fileName = `flowchart_gost_${lang}_${Date.now()}.svg`;

    const caption =
      `📐 <b>Блок-схема по ГОСТ 19.701-90</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔹 <b>Язык:</b> <code>${langNames[lang] || lang}</code>\n` +
      `🔹 <b>Фигур по ГОСТ:</b> ${numBlocks}\n` +
      `🔹 <b>Связей потока:</b> ${numEdges}\n` +
      `🔹 <b>Разрешение:</b> ${Math.round(model.width)} × ${Math.round(model.height)} px\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 <i>Откройте Mini App для интерактивного редактирования и экспорта в Visio VSDX / PNG Retina!</i>`;

    const actionKeyboard = {
      inline_keyboard: [
        [
          { text: '🚀 Открыть в Mini App', web_app: { url: TMA_APP_URL } }
        ],
        [
          { text: '📚 Другие примеры', callback_data: 'menu_examples' },
          { text: '🌐 Сменить язык', callback_data: 'menu_lang' }
        ]
      ]
    };

    await sendTelegramDocument(chatId, svgBuffer, fileName, caption, actionKeyboard);

  } catch (err) {
    console.error('Ошибка построения схемы:', err.message);
    const errMsg =
      `❌ <b>Не удалось построить блок-схему:</b>\n\n` +
      `<code>${err.message.slice(0, 300)}</code>\n\n` +
      `💡 <b>Совет:</b> проверьте парность скобок или попробуйте выбрать другой язык в меню ниже.`;

    if (msgId) {
      await editMessage(chatId, msgId, errMsg, getLanguageKeyboard(lang));
    } else {
      await sendMessage(chatId, errMsg, getLanguageKeyboard(lang));
    }
  }
}

// Handle incoming Telegram message
async function handleMessage(msg) {
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Command handlers
  if (text === '/start') {
    const welcome =
      `👋 <b>Добро пожаловать в «Блок-Схема ГОСТ»!</b>\n\n` +
      `Я официальный бот инженерного комплекса для автоматического создания блок-схем алгоритмов по <b>ГОСТ 19.701-90 (ИСО 5807-85)</b>.\n\n` +
      `✨ <b>Что умеет комплекс:</b>\n` +
      `• <b>5 языков:</b> Python, C++, C#, ANSI C, Go\n` +
      `• <b>Строгий ГОСТ:</b> пуск/останов ($r = h/2$), ромб conditions, шестиугольник для <code>for</code>, ортогональные каналы обхода\n` +
      `• <b>Telegram Mini App:</b> полноценный редактор прямо внутри Telegram!\n` +
      `• <b>Экспорт:</b> SVG, PNG ($2.5\\times$ Retina) и Microsoft Visio (.VSDX)\n\n` +
      `👇 <i>Отправьте код в этот чат или запустите Mini App по кнопке:</i>`;

    await sendMessage(chatId, welcome, getMainKeyboard());
    return;
  }

  if (text === '/help' || text === '/gost') {
    const help =
      `📖 <b>Справка и правила ГОСТ 19.701-90:</b>\n\n` +
      `1️⃣ <b>Линии и стрелки (ГОСТ п. 3.2.2):</b>\n` +
      `• Линии сверху вниз и слева направо идут <b>БЕЗ стрелок</b>.\n` +
      `• Стрелки ставятся <b>ТОЛЬКО</b> на линиях обратной связи (возврат цикла снизу вверх) и против потока.\n\n` +
      `2️⃣ <b>Фигуры:</b>\n` +
      `• <b>Пуск / Останов:</b> овал с радиусом скругления $r = h/2$.\n` +
      `• <b>Процесс:</b> прямоугольник для вычислений и присваиваний.\n` +
      `• <b>Данные:</b> параллелограмм со скосом граней для ввода/вывода.\n` +
      `• <b>Решение:</b> ромб с выходами «Да» (вниз) и «Нет» (вправо).\n` +
      `• <b>Подготовка:</b> вытянутый шестиугольник для циклов со счетчиком <code>for</code>.\n\n` +
      `💡 <i>Отправьте в чат фрагмент кода, чтобы получить готовую схему!</i>`;

    await sendMessage(chatId, help, getMainKeyboard());
    return;
  }

  if (text === '/lang') {
    const curLang = userSettings.get(chatId) || 'csharp';
    await sendMessage(chatId, `🌐 <b>Выберите рабочий язык программирования:</b>`, getLanguageKeyboard(curLang));
    return;
  }

  if (text === '/examples') {
    await sendMessage(chatId, `📚 <b>Примеры готовых алгоритмов для лабораторных:</b>`, getExamplesKeyboard());
    return;
  }

  // Treat as code input
  await handleUserCode(chatId, text);
}

// Handle callback queries from inline buttons
async function handleCallback(cq) {
  if (!cq || !cq.message) return;
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const data = cq.data || '';

  await answerCallbackQuery(cq.id);

  if (data === 'menu_main') {
    await editMessage(
      chatId,
      messageId,
      `📐 <b>Главное меню «Блок-Схема ГОСТ»:</b>\n\nВыберите действие или отправьте фрагмент кода:`,
      getMainKeyboard()
    );
    return;
  }

  if (data === 'menu_lang') {
    const cur = userSettings.get(chatId) || 'csharp';
    await editMessage(
      chatId,
      messageId,
      `🌐 <b>Выберите язык программирования по умолчанию:</b>`,
      getLanguageKeyboard(cur)
    );
    return;
  }

  if (data === 'menu_examples') {
    await editMessage(
      chatId,
      messageId,
      `📚 <b>Выберите пример алгоритма для генерации блок-схемы:</b>`,
      getExamplesKeyboard()
    );
    return;
  }

  if (data === 'menu_help' || data === 'menu_gost') {
    await editMessage(
      chatId,
      messageId,
      `📖 <b>Стандарт ГОСТ 19.701-90 (ИСО 5807-85):</b>\n\n` +
      `• Стрелки ставятся только на линиях снизу вверх (возврат цикла);\n` +
      `• Символ «Подготовка» (шестиугольник) используется для циклов со счетчиком;\n` +
      `• Все размеры блоков автоматически масштабируются без вылета текста;\n` +
      `• Ортогональная раскладка исключает лишние пересечения.`,
      {
        inline_keyboard: [
          [{ text: '🚀 Открыть Mini App', web_app: { url: TMA_APP_URL } }],
          [{ text: '◀️ В главное меню', callback_data: 'menu_main' }]
        ]
      }
    );
    return;
  }

  if (data.startsWith('setlang_')) {
    const lang = data.replace('setlang_', '');
    userSettings.set(chatId, lang);
    const langNames = { csharp: 'C#', python: 'Python', cpp: 'C++', c: 'ANSI C', go: 'Go' };
    await editMessage(
      chatId,
      messageId,
      `✅ Язык по умолчанию установлен на <b>${langNames[lang] || lang}</b>.\n\nТеперь отправьте фрагмент кода программы!`,
      getMainKeyboard()
    );
    return;
  }

  if (EXAMPLES[data]) {
    const ex = EXAMPLES[data];
    userSettings.set(chatId, ex.lang);
    await editMessage(
      chatId,
      messageId,
      `🔄 <b>Загружен пример:</b> <i>${ex.title}</i>\nЗапуск построения блок-схемы...`,
      null
    );
    await handleUserCode(chatId, ex.code, ex.lang);
    return;
  }
}

// Long Polling Loop with Resilient Reconnects
let isRunning = true;
let lastUpdateId = 0;

async function pollUpdates() {
  console.log(`
======================================================
  🤖 Бот @blok_shema_misis_bot запущен!
======================================================
  Токен:               ${redactToken(BOT_TOKEN)}
  Mini App URL:        ${TMA_APP_URL}
  Защита от спама:     Включена (RateLimiter)
  Защита от дурака:    Включена (Auto-detect & heuristics)
======================================================
`);

  // Clear pending webhook if any
  try {
    await callTelegramAPI('deleteWebhook', { drop_pending_updates: false });
  } catch (e) {
    // Ignore
  }

  while (isRunning) {
    try {
      const updates = await callTelegramAPI('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 20,
        allowed_updates: ['message', 'callback_query']
      });

      if (Array.isArray(updates) && updates.length > 0) {
        for (const update of updates) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);

          if (update.message) {
            handleMessage(update.message).catch(err => {
              console.error('Ошибка обработки сообщения:', err.message);
            });
          } else if (update.callback_query) {
            handleCallback(update.callback_query).catch(err => {
              console.error('Ошибка обработки callback:', err.message);
            });
          }
        }
      }
    } catch (err) {
      if (!isRunning) break;
      console.warn('⚠ Сетевая задержка Long Polling, повтор через 3с:', err.message);
      await sleep(3000);
    }
  }
}

// Handle termination signals cleanly
process.on('SIGINT', () => {
  console.log('\nОстановка Telegram-бота...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nОстановка Telegram-бота по сигналу SIGTERM...');
  isRunning = false;
  process.exit(0);
});

// Run directly if invoked as main module
if (require.main === module) {
  pollUpdates().catch(err => {
    console.error('Критическая ошибка запуска бота:', err);
    process.exit(1);
  });
}

module.exports = {
  pollUpdates,
  handleUserCode,
  handleMessage
};
