#!/usr/bin/env node
// cli.js - Command-line interface for C# GOST 19.701-90 flowchart generator
'use strict';

const fs = require('fs');
const path = require('path');
const LangParsers = require('./static/js/lang-parsers');
const CFGBuilder = require('./static/js/cfg-builder');
const GOSTLayout = require('./static/js/gost-layout');
const GOSTRenderer = require('./static/js/gost-renderer');

function printUsage() {
  console.log(`
Использование: gost-flowchart [опции]

Опции:
  -i, --input <путь>      Входной файл с кодом (.cs, .py, .cpp, .c, .go) (обязательно)
  -o, --output <путь>     Выходной файл (.svg или .vsdx) (по умолчанию: <имя>.svg)
  -l, --lang <язык>       Язык программирования: csharp, python, cpp, c, go (по умолчанию: определяется по расширению)
  -m, --method <имя>      Имя метода/функции для визуализации (по умолчанию: Main или первый найденный)
  -f, --format <тип>      Формат: svg, vsdx, json (по умолчанию определяется по расширению -o)
  -h, --help              Показать эту справку

Примеры:
  node cli.js -i Program.cs -o Program.svg
  node cli.js -i algorithm.py -o algorithm.svg
  node cli.js -i solution.cpp -o solution.vsdx
  node cli.js -i main.go -o main.svg
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    method: null,
    format: null,
    lang: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-i' || arg === '--input') {
      options.input = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg === '-l' || arg === '--lang') {
      options.lang = args[++i].toLowerCase();
    } else if (arg === '-m' || arg === '--method') {
      options.method = args[++i];
    } else if (arg === '-f' || arg === '--format') {
      options.format = args[++i].toLowerCase();
    } else if (!options.input && !arg.startsWith('-')) {
      options.input = arg;
    }
  }

  return options;
}

function main() {
  const options = parseArgs();

  if (!options.input) {
    console.error('Ошибка: не указан входной файл. Используйте -i <файл>');
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(options.input)) {
    console.error(`Ошибка: файл "${options.input}" не найден.`);
    process.exit(1);
  }

  const code = fs.readFileSync(options.input, 'utf8');

  // Detect language
  let lang = options.lang;
  if (!lang) {
    const ext = path.extname(options.input).toLowerCase();
    if (ext === '.py') lang = 'python';
    else if (ext === '.cpp' || ext === '.cc' || ext === '.cxx' || ext === '.hpp') lang = 'cpp';
    else if (ext === '.c' || ext === '.h') lang = 'c';
    else if (ext === '.go') lang = 'go';
    else lang = 'csharp';
  }

  // Parse AST
  let ast;
  try {
    ast = LangParsers.parse(code, lang);
  } catch (err) {
    console.error(`Ошибка парсинга (${lang}): ${err.message}`);
    process.exit(1);
  }

  // Choose method
  let targetMethod = ast.primaryMethod;
  let targetName = ast.primaryName;

  if (options.method) {
    if (ast.methods[options.method]) {
      targetMethod = ast.methods[options.method];
      targetName = options.method;
      ast.statements = targetMethod.body;
      ast.primaryName = targetName;
    } else {
      console.warn(`Предупреждение: метод "${options.method}" не найден. Доступные: ${Object.keys(ast.methods).join(', ')}`);
    }
  }

  console.log(`Визуализация метода: "${targetName}" (${ast.statements.length} инструкций)...`);

  // Build CFG
  const cfg = CFGBuilder.buildCFG(ast, { showMethodName: true });

  // Layout diagram
  const model = GOSTLayout.layoutDiagram(cfg);

  // Determine output format & path
  let outPath = options.output;
  if (!outPath) {
    const ext = path.extname(options.input);
    const base = path.basename(options.input, ext);
    outPath = path.join(path.dirname(options.input), base + '.svg');
  }

  let format = options.format;
  if (!format) {
    if (outPath.endsWith('.vsdx')) format = 'vsdx';
    else if (outPath.endsWith('.json')) format = 'json';
    else format = 'svg';
  }

  if (format === 'vsdx') {
    const vsdx = GOSTRenderer.generateVSDXFromModel(model);
    if (vsdx.error) {
      console.error(`Ошибка генерации VSDX: ${vsdx.error}`);
      process.exit(1);
    }
    fs.writeFileSync(outPath, Buffer.from(vsdx.bytes));
    console.log(`✔ Схема успешно экспортирована в Visio: ${outPath} (${(vsdx.bytes.length / 1024).toFixed(1)} КБ)`);
  } else if (format === 'json') {
    fs.writeFileSync(outPath, JSON.stringify(model, null, 2), 'utf8');
    console.log(`✔ Модель сохранена в JSON: ${outPath}`);
  } else {
    const svg = GOSTRenderer.renderModelSVG(model);
    fs.writeFileSync(outPath, svg, 'utf8');
    console.log(`✔ Схема успешно построена по ГОСТ 19.701-90: ${outPath}`);
  }

  console.log(`   Фигур: ${model.shapes.length}, Связей: ${model.edges.length}, Размер: ${model.width}x${model.height}px`);
}

main();
