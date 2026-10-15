// tests/run-tests.js - Automated test suite for C# GOST 19.701-90 flowchart generator
'use strict';

const fs = require('fs');
const path = require('path');
const CSharpParser = require('../static/js/csharp-parser');
const CFGBuilder = require('../static/js/cfg-builder');
const GOSTLayout = require('../static/js/gost-layout');
const GOSTRenderer = require('../static/js/gost-renderer');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('======================================================');
console.log('  Запуск тестов C# ГОСТ 19.701-90 Flowchart');
console.log('======================================================\n');

const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.cs')).sort();

let passed = 0;
let failed = 0;

files.forEach(file => {
  const filePath = path.join(FIXTURES_DIR, file);
  const code = fs.readFileSync(filePath, 'utf8');

  try {
    // 1. Parse AST
    const ast = CSharpParser.parse(code);
    if (!ast || !ast.statements) {
      throw new Error('AST empty or failed to parse statements');
    }

    // 2. Build CFG
    const cfg = CFGBuilder.buildCFG(ast, { showMethodName: true });
    if (!cfg.nodes || cfg.nodes.length < 2) {
      throw new Error('CFG must have at least Start and End terminals');
    }

    // 3. Layout Diagram
    const model = GOSTLayout.layoutDiagram(cfg);
    if (model.width <= 0 || model.height <= 0) {
      throw new Error(`Invalid model dimensions: ${model.width}x${model.height}`);
    }

    // 4. Verify shapes have non-overflowing dimensions
    model.shapes.forEach((s, idx) => {
      if (s.w <= 0 || s.h <= 0) {
        throw new Error(`Shape #${idx} (${s.type}) has non-positive size: ${s.w}x${s.h}`);
      }
      if (s.x < 0 || s.y < 0) {
        throw new Error(`Shape #${idx} (${s.type}) has negative position: (${s.x}, ${s.y})`);
      }
    });

    // 5. Verify edges are orthogonal (each segment is horizontal or vertical)
    model.edges.forEach((e, idx) => {
      const pts = e.points;
      if (pts.length < 2) {
        throw new Error(`Edge #${idx} has fewer than 2 points`);
      }
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
        const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
        if (dx > 0.5 && dy > 0.5) {
          throw new Error(`Edge #${idx} segment ${i - 1}->${i} is not orthogonal: dx=${dx}, dy=${dy}`);
        }
      }
    });

    // 6. Render SVG
    const svg = GOSTRenderer.renderModelSVG(model);
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      throw new Error('Generated SVG is not a well-formed <svg> document');
    }

    // 7. Verify Visio VSDX generation
    const vsdx = GOSTRenderer.generateVSDXFromModel(model);
    if (vsdx.error || !vsdx.bytes || vsdx.bytes.length < 1000) {
      throw new Error(`VSDX export failed: ${vsdx.error || 'Empty bytes'}`);
    }

    // Save test artifacts
    const baseName = path.basename(file, '.cs');
    fs.writeFileSync(path.join(OUTPUT_DIR, baseName + '.svg'), svg, 'utf8');
    fs.writeFileSync(path.join(OUTPUT_DIR, baseName + '.vsdx'), Buffer.from(vsdx.bytes));

    console.log(`  ✔ [PASS] ${file}`);
    console.log(`           Метод: "${ast.primaryName}" | Фигур: ${model.shapes.length} | Связей: ${model.edges.length} | Разрешение: ${model.width}x${model.height}px | VSDX: ${(vsdx.bytes.length / 1024).toFixed(1)} КБ`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${file}: ${err.message}`);
    failed++;
  }
});

console.log('\n======================================================');
console.log(`  Результаты: ${passed} успешно, ${failed} ошибок из ${files.length} тестов.`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nВсе тесты ГОСТ 19.701-90 пройдены успешно!\n');
}
