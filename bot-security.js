// bot-security.js - Multi-layered Security, Anti-Spam & Foolproof Guard
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Zero-dependency .env loader
function loadEnv(filePath) {
  const target = filePath || path.join(__dirname, '.env');
  if (!fs.existsSync(target)) return;
  try {
    const content = fs.readFileSync(target, 'utf8');
    const lines = content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('⚠ Предупреждение при чтении .env:', err.message);
  }
}

// 2. Sliding Window Rate Limiter
class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 5;       // max requests in window
    this.windowMs = options.windowMs || 10000;         // 10 seconds window
    this.cooldownMs = options.cooldownMs || 30000;     // 30 seconds cooldown on violation
    this.banThreshold = options.banThreshold || 15;    // violations before 1-hour ban
    this.banDurationMs = options.banDurationMs || 3600000; // 1 hour

    this.clients = new Map();
    this.banned = new Map();

    // Auto-clean old records every 2 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 120000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  check(clientId) {
    const id = String(clientId);
    const now = Date.now();

    // 1. Check ban status
    const banUntil = this.banned.get(id);
    if (banUntil) {
      if (now < banUntil) {
        const remainingMin = Math.ceil((banUntil - now) / 60000);
        return {
          allowed: false,
          banned: true,
          retryAfterSec: Math.ceil((banUntil - now) / 1000),
          message: `⛔ Доступ временно заблокирован за частый спам. Повторите через ${remainingMin} мин.`
        };
      }
      this.banned.delete(id);
    }

    // 2. Client record
    let record = this.clients.get(id);
    if (!record) {
      record = { timestamps: [], violations: 0, cooldownUntil: 0 };
      this.clients.set(id, record);
    }

    // Check cooldown
    if (record.cooldownUntil && now < record.cooldownUntil) {
      const waitSec = Math.ceil((record.cooldownUntil - now) / 1000);
      return {
        allowed: false,
        cooldown: true,
        retryAfterSec: waitSec,
        message: `⏳ Слишком много запросов. Пожалуйста, подождите ${waitSec} сек.`
      };
    }

    // Purge timestamps older than windowMs
    record.timestamps = record.timestamps.filter(ts => now - ts < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      record.violations++;
      record.cooldownUntil = now + this.cooldownMs;

      if (record.violations >= this.banThreshold) {
        this.banned.set(id, now + this.banDurationMs);
        return {
          allowed: false,
          banned: true,
          retryAfterSec: Math.ceil(this.banDurationMs / 1000),
          message: '⛔ Превышен лимит предупреждений. Аккаунт временно заблокирован на 1 час.'
        };
      }

      const waitSec = Math.ceil(this.cooldownMs / 1000);
      return {
        allowed: false,
        cooldown: true,
        retryAfterSec: waitSec,
        message: `⚠️ Вы отправляете сообщения слишком быстро (макс. ${this.maxRequests} за 10 сек). Подождите ${waitSec} сек.`
      };
    }

    record.timestamps.push(now);
    return { allowed: true };
  }

  cleanup() {
    const now = Date.now();
    for (const [id, rec] of this.clients.entries()) {
      if (now - (rec.timestamps[rec.timestamps.length - 1] || 0) > 300000 && !rec.cooldownUntil) {
        this.clients.delete(id);
      }
    }
    for (const [id, banUntil] of this.banned.entries()) {
      if (now >= banUntil) this.banned.delete(id);
    }
  }
}

// 3. Input Validation & Foolproof Heuristics ("Защита от дурака")
const MAX_CODE_LENGTH = 25000;

function validateInput(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return {
      valid: false,
      isCode: false,
      reason: 'Сообщение пустое или не содержит текста.'
    };
  }

  const trimmed = text.trim();

  // Length check (protection against huge payloads / ReDoS)
  if (trimmed.length > MAX_CODE_LENGTH) {
    return {
      valid: false,
      isCode: false,
      reason: `Превышен максимальный размер фрагмента (${(trimmed.length / 1024).toFixed(1)} КБ). Допустимо до ${MAX_CODE_LENGTH / 1024} КБ.`
    };
  }

  // Conversational text detection (greetings, chit-chat, plain words without code symbols)
  const conversationalRegex = /^(привет|ку|хай|здравствуй|здравствуйте|как дела|хеллоу|hello|hi|hey|помоги|помощь|что ты умеешь|спасибо|спс|отлично|круто|ок|тест|test)[\s!?.…)]*$/i;
  if (conversationalRegex.test(trimmed)) {
    return {
      valid: false,
      isCode: false,
      conversational: true,
      reason: 'Обнаружено текстовое сообщение вместо исходного кода.'
    };
  }

  // Code indicators heuristic
  const codeIndicators = [
    /;\s*$/,                // Semicolon at line end
    /\{[\s\S]*\}/,          // Curly braces
    /\b(def|class|import|from|return|if|elif|else|while|for|in|int|float|void|static|public|private|namespace|using|package|func|var)\b/,
    /\b(print|println|printf|scanf|cin|cout|Console\.Write|fmt\.Print)\b/,
    /(=|\+=|-=|\*=|\/=|==|!=|<=|>=)/
  ];

  let indicatorCount = 0;
  for (const regex of codeIndicators) {
    if (regex.test(trimmed)) indicatorCount++;
  }

  // Detect language hint
  let detectedLang = 'csharp';
  if (/\b(def|elif|import\s+\w+|print\s*\(|:\s*$)/m.test(trimmed) && !trimmed.includes('{')) {
    detectedLang = 'python';
  } else if (/\b(package\s+\w+|func\s+\w+|fmt\.)/.test(trimmed)) {
    detectedLang = 'go';
  } else if (/\b(#include\s*<iostream>|std::|cout\s*<<|cin\s*>>)/.test(trimmed)) {
    detectedLang = 'cpp';
  } else if (/\b(#include\s*<stdio\.h>|printf\s*\(|scanf\s*\()/.test(trimmed) && !trimmed.includes('cout')) {
    detectedLang = 'c';
  } else if (/\b(using\s+System|Console\.|namespace\s+\w+)/.test(trimmed)) {
    detectedLang = 'csharp';
  }

  // If input has no code indicators at all, treat as conversational
  if (indicatorCount === 0 && trimmed.split(/\s+/).length < 4) {
    return {
      valid: false,
      isCode: false,
      conversational: true,
      reason: 'Сообщение не похоже на программный код.'
    };
  }

  return {
    valid: true,
    isCode: true,
    detectedLang: detectedLang,
    code: trimmed
  };
}

// 4. SVG Sanitizer (Prevent XSS injections via diagram text)
function sanitizeSVG(svgString) {
  if (typeof svgString !== 'string') return '';
  return svgString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

// 5. Telegram Mini App initData Validator (HMAC-SHA256)
function verifyTelegramInitData(initDataString, botToken) {
  if (!initDataString || !botToken) return null;

  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckArr = [];
    Array.from(params.keys()).sort().forEach(key => {
      dataCheckArr.push(`${key}=${params.get(key)}`);
    });
    const dataCheckString = dataCheckArr.join('\n');

    // HMAC with 'WebAppData' key
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    return {
      valid: true,
      user: user,
      authDate: params.get('auth_date'),
      queryId: params.get('query_id')
    };
  } catch (err) {
    return null;
  }
}

// 6. Safe Token Redactor for Logs
function redactToken(str) {
  if (!str) return '';
  return String(str).replace(/([0-9]{8,10}:)[a-zA-Z0-9_-]{35}/g, '$1***');
}

module.exports = {
  loadEnv,
  RateLimiter,
  validateInput,
  sanitizeSVG,
  verifyTelegramInitData,
  redactToken,
  MAX_CODE_LENGTH
};
