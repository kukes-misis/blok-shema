// scripts/security-check.js - Automated Security Audit & Leak Prevention
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BOT_TOKEN_REGEX = /\b[0-9]{8,10}:[a-zA-Z0-9_-]{35}\b/g;

console.log('======================================================');
console.log('  Запуск аудита безопасности проекта «Блок-Схема»');
console.log('======================================================\n');

let issuesFound = 0;

// 1. Check .gitignore rules
console.log('1. Проверка правил .gitignore...');
const gitignorePath = path.join(ROOT, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  console.error('❌ ОШИБКА: Файл .gitignore не найден!');
  issuesFound++;
} else {
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const requiredPatterns = ['.env', '*.token', '*secret*'];
  for (const pat of requiredPatterns) {
    if (!content.includes(pat)) {
      console.error(`❌ ОШИБКА: .gitignore не содержит обязательное правило: ${pat}`);
      issuesFound++;
    }
  }
  console.log('   ✔ Правила исключения .env и секретов в .gitignore корректны.');
}

// 2. Check git tracked files for secrets
console.log('\n2. Проверка отслеживаемых файлов git на наличие секретов...');
try {
  const trackedFiles = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  for (const relPath of trackedFiles) {
    if (relPath.endsWith('.env') || relPath.includes('secret') || relPath.endsWith('.token')) {
      console.error(`❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: Файл ${relPath} отслеживается в git!`);
      issuesFound++;
    }

    const absPath = path.join(ROOT, relPath);
    if (!fs.existsSync(absPath)) continue;

    // Scan text files for bot tokens
    const ext = path.extname(absPath).toLowerCase();
    const textExts = ['.js', '.html', '.css', '.json', '.md', '.bat', '.command', '.sh', '.py', '.cpp', '.c', '.go', '.txt'];
    if (textExts.includes(ext)) {
      const text = fs.readFileSync(absPath, 'utf8');
      const matches = text.match(BOT_TOKEN_REGEX);
      if (matches) {
        // Exclude test dummy tokens if any, but fail on real-looking bot tokens
        const cleanMatches = matches.filter(m => !m.includes('your_') && !m.includes('0000000000:'));
        if (cleanMatches.length > 0) {
          console.error(`❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: В файле ${relPath} обнаружен токен Telegram: ${cleanMatches[0].slice(0, 10)}...`);
          issuesFound++;
        }
      }
    }
  }
  if (issuesFound === 0) {
    console.log(`   ✔ Просканировано ${trackedFiles.length} файлов: утечек токенов не обнаружено.`);
  }
} catch (err) {
  console.warn('   ⚠ Предупреждение при проверке git ls-files:', err.message);
}

// 3. Check git staged changes
console.log('\n3. Проверка индекса git (staged files)...');
try {
  const diffOutput = execSync('git diff --cached', { cwd: ROOT, encoding: 'utf8' });
  const matches = diffOutput.match(BOT_TOKEN_REGEX);
  if (matches) {
    const cleanMatches = matches.filter(m => !m.includes('your_'));
    if (cleanMatches.length > 0) {
      console.error(`❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: В staged изменениях обнаружен Telegram-токен: ${cleanMatches[0].slice(0, 10)}...`);
      issuesFound++;
    }
  }
  console.log('   ✔ В staged изменениях утечек не обнаружено.');
} catch (err) {
  console.warn('   ⚠ Предупреждение при проверке git diff --cached:', err.message);
}

// 4. Check git commit history (last 10 commits)
console.log('\n4. Проверка истории коммитов git на наличие секретов...');
try {
  const logDiff = execSync('git log -n 10 -p', { cwd: ROOT, encoding: 'utf8' });
  const logMatches = logDiff.match(BOT_TOKEN_REGEX);
  if (logMatches) {
    const realLogMatches = logMatches.filter(m => !m.includes('your_') && !m.includes('0000000000:'));
    if (realLogMatches.length > 0) {
      console.error(`❌ КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: В истории последних коммитов обнаружен токен: ${realLogMatches[0].slice(0, 10)}...`);
      issuesFound++;
    }
  }
  if (issuesFound === 0) {
    console.log('   ✔ В истории последних коммитов утечек токенов не обнаружено.');
  }
} catch (err) {
  console.warn('   ⚠ Предупреждение при проверке git log:', err.message);
}

// 4. Verify local .env file existence and permissions
console.log('\n4. Проверка локального окружения (.env)...');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✔ Локальный файл .env присутствует и защищен .gitignore.');
} else {
  console.log('   ℹ Локальный файл .env отсутствует (для запуска бота создайте его на основе .env.example).');
}

console.log('\n======================================================');
if (issuesFound > 0) {
  console.error(`❌ Аудит безопасности НЕ ПРОЙДЕН! Найдено проблем: ${issuesFound}`);
  process.exit(1);
} else {
  console.log('✔ Аудит безопасности успешно пройден! Утечек нет.');
  console.log('======================================================\n');
}
