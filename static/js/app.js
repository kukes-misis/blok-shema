// app.js - Main controller for C# GOST 19.701-90 flowchart generator
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var code = $('code');
  var gutter = $('gutter');
  var sheet = $('sheet');
  var scroll = $('scroll');
  var errBox = $('errBox');
  var errMsg = $('errMsg');
  var zoomRead = $('zoomRead');
  var zoomIn = $('zoomIn');
  var zoomOut = $('zoomOut');
  var fit = $('fit');
  var gridBtn = $('gridBtn');
  var edToggle = $('edToggle');
  var dlSvg = $('dlSvg');
  var dlPng = $('dlPng');
  var dlVsdx = $('dlVsdx');
  var buildBtn = $('build');
  var lineHl = $('lineHl');
  var methodSelect = $('methodSelect');
  var codeZoomIn = $('codeZoomIn');
  var codeZoomOut = $('codeZoomOut');
  var codeZoomRead = $('codeZoomRead');
  var themeToggle = $('themeToggle');
  var themeIcon = $('themeIcon');
  var themeLabel = $('themeLabel');
  var langSelect = $('langSelect');
  var langBadge = $('langBadge');
  var srcLangLabel = $('srcLangLabel');

  var currentLang = 'csharp';

  var scale = 1.0;
  var natW = 800;
  var natH = 600;
  var gridOn = false;
  var currentModel = null;
  var currentAST = null;
  var selectedMethod = null;

  // Zoom code font size
  var codeFontSize = 13.5;

  // 1. Gutter & Line Highlighting
  function updateGutter() {
    var lines = code.value.split('\n');
    var count = lines.length || 1;
    var str = '';
    for (var i = 1; i <= count; i++) {
      str += (i > 1 ? '\n' : '') + i;
    }
    gutter.textContent = str;
    gutter.scrollTop = code.scrollTop;
  }

  code.addEventListener('scroll', function () {
    gutter.scrollTop = code.scrollTop;
    updateLineHlPosition();
  });

  code.addEventListener('input', function () {
    updateGutter();
  });

  // Tab key indent
  code.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var s = code.selectionStart;
      var en = code.selectionEnd;
      if (s === en) {
        code.value = code.value.slice(0, s) + '    ' + code.value.slice(en);
        code.selectionStart = code.selectionEnd = s + 4;
      } else {
        var before = code.value.slice(0, s);
        var sel = code.value.slice(s, en);
        var after = code.value.slice(en);
        var indented = sel.replace(/^/gm, '    ');
        code.value = before + indented + after;
        code.selectionStart = s;
        code.selectionEnd = en + (indented.length - sel.length);
      }
      updateGutter();
    }
  });

  function showLineHl(lineNum) {
    if (!lineNum || lineNum < 1) {
      lineHl.classList.remove('on');
      return;
    }
    var cs = getComputedStyle(code);
    var lh = parseFloat(cs.lineHeight) || 20;
    var pt = parseFloat(cs.paddingTop) || 16;
    var top = pt + (lineNum - 1) * lh - code.scrollTop;
    lineHl.style.top = top + 'px';
    lineHl.style.height = lh + 'px';
    lineHl.classList.add('on');
  }

  function updateLineHlPosition() {
    var hl = sheet.querySelector('.sh.hl');
    if (hl && hl.dataset.srcline) {
      showLineHl(parseInt(hl.dataset.srcline, 10));
    }
  }

  // 2. Zoom & Canvas
  function applyZoom() {
    var svg = sheet.querySelector('svg');
    if (!svg) return;
    svg.style.width = Math.round(natW * scale) + 'px';
    svg.style.height = Math.round(natH * scale) + 'px';
    zoomRead.value = Math.round(scale * 100) + '%';
  }

  function fitToWindow() {
    var availW = scroll.clientWidth - 70;
    var availH = scroll.clientHeight - 70;
    if (natW <= 0 || natH <= 0) {
      scale = 1.0;
      applyZoom();
      return;
    }
    var s = Math.min(availW / natW, availH / natH);
    if (!isFinite(s) || s <= 0) s = 1.0;
    scale = Math.max(0.2, Math.min(s, 1.4));
    applyZoom();
  }

  zoomIn.addEventListener('click', function () {
    scale = Math.min(4.0, scale * 1.2);
    applyZoom();
  });

  zoomOut.addEventListener('click', function () {
    scale = Math.max(0.2, scale / 1.2);
    applyZoom();
  });

  fit.addEventListener('click', function () {
    fitToWindow();
  });

  zoomRead.addEventListener('change', function () {
    var val = parseFloat(zoomRead.value.replace(/[^\d.]/g, ''));
    if (isFinite(val) && val > 0) {
      scale = Math.max(0.2, Math.min(4.0, val / 100));
      applyZoom();
    }
  });

  // Code zoom
  codeZoomIn.addEventListener('click', function () {
    codeFontSize = Math.min(28, codeFontSize + 1.5);
    applyCodeZoom();
  });
  codeZoomOut.addEventListener('click', function () {
    codeFontSize = Math.max(10, codeFontSize - 1.5);
    applyCodeZoom();
  });
  function applyCodeZoom() {
    code.style.fontSize = codeFontSize + 'px';
    gutter.style.fontSize = codeFontSize + 'px';
    codeZoomRead.value = Math.round((codeFontSize / 13.5) * 100) + '%';
    updateGutter();
  }

  // Grid toggle
  gridBtn.addEventListener('click', function () {
    gridOn = !gridOn;
    gridBtn.classList.toggle('active', gridOn);
    scroll.style.background = gridOn
      ? 'repeating-linear-gradient(0deg, rgba(37,71,255,0.06) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(37,71,255,0.06) 0 1px, transparent 1px 28px)'
      : 'radial-gradient(circle at 1px 1px, rgba(21,21,28,0.10) 1px, transparent 0)';
    scroll.style.backgroundSize = gridOn ? '28px 28px' : '22px 22px';
  });

  // 3. Core Local Flowchart Builder
  function buildFlowchart(autoFit) {
    if (autoFit === undefined) autoFit = false;

    var src = code.value.trim();
    if (!src) {
      showError('Введите исходный код для построения схемы.');
      return;
    }

    errBox.style.display = 'none';
    sheet.style.visibility = 'visible';

    try {
      // 1. Parse AST
      var lang = (langSelect && langSelect.value) ? langSelect.value : currentLang;
      if (window.LangParsers && typeof window.LangParsers.parse === 'function') {
        currentAST = window.LangParsers.parse(src, lang);
      } else {
        currentAST = window.CSharpParser.parse(src);
      }

      // 2. Populate method selector if multiple methods exist
      updateMethodSelector();

      // 3. Prepare active AST statements
      var activeAST = Object.assign({}, currentAST);
      if (selectedMethod && currentAST.methods[selectedMethod]) {
        activeAST.statements = currentAST.methods[selectedMethod].body;
        activeAST.primaryName = selectedMethod;
      }

      // 4. Build Control Flow Graph
      var cfg = window.CFGBuilder.buildCFG(activeAST, { showMethodName: true });

      // 5. Compute layout
      var model = window.GOSTLayout.layoutDiagram(cfg);
      currentModel = model;

      // 6. Render SVG
      var renderer = window.GOSTRenderer || window;
      if (!renderer || typeof renderer.renderModelSVG !== 'function') {
        throw new Error('Модуль GOSTRenderer не загружен. Проверьте подключение скриптов.');
      }
      var svgMarkup = renderer.renderModelSVG(model);
      sheet.innerHTML = svgMarkup;

      natW = model.width;
      natH = model.height;

      var svg = sheet.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
      }

      if (autoFit) {
        fitToWindow();
      } else {
        applyZoom();
      }

      // 7. Bind bidirectional click highlight
      bindHighlightEvents();

      // Flash build button done state
      buildBtn.classList.remove('building');
      buildBtn.classList.remove('fail');
      buildBtn.classList.add('done');
      setTimeout(function () { buildBtn.classList.remove('done'); }, 1500);

      window.BUILT = {
        key: code.value,
        res: {
          svg: svgMarkup,
          width: natW,
          height: natH,
          model: model
        }
      };
    } catch (err) {
      console.error('Ошибка построения схемы:', err);
      showError('Ошибка: ' + (err.message || String(err)));
    }
  }

  function updateMethodSelector() {
    if (!currentAST || !methodSelect) return;
    var methods = Object.keys(currentAST.methods || {});
    methodSelect.innerHTML = '';

    if (methods.length <= 1) {
      methodSelect.style.display = 'none';
      return;
    }

    methodSelect.style.display = 'inline-block';
    methods.forEach(function (m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = 'Метод: ' + m;
      if (m === currentAST.primaryName || (selectedMethod && m === selectedMethod)) {
        opt.selected = true;
      }
      methodSelect.appendChild(opt);
    });

    if (!selectedMethod) selectedMethod = currentAST.primaryName;
  }

  if (methodSelect) {
    methodSelect.addEventListener('change', function () {
      selectedMethod = methodSelect.value;
      buildFlowchart(true);
    });
  }

  function bindHighlightEvents() {
    var svg = sheet.querySelector('svg');
    if (!svg) return;

    var shapes = svg.querySelectorAll('.sh[data-srcline]');
    shapes.forEach(function (sh) {
      sh.addEventListener('click', function (e) {
        e.stopPropagation();
        var line = parseInt(sh.getAttribute('data-srcline'), 10);
        shapes.forEach(function (s) { s.classList.remove('hl'); });
        sh.classList.add('hl');
        showLineHl(line);

        // Scroll code editor to line
        var lines = code.value.split('\n');
        var cs = getComputedStyle(code);
        var lh = parseFloat(cs.lineHeight) || 20;
        code.scrollTop = Math.max(0, (line - 3) * lh);
      });
    });

    svg.addEventListener('click', function () {
      shapes.forEach(function (s) { s.classList.remove('hl'); });
      showLineHl(0);
    });
  }

  function showError(msg) {
    errMsg.textContent = msg;
    errBox.style.display = 'flex';
    sheet.style.visibility = 'hidden';
    buildBtn.classList.remove('building');
    buildBtn.classList.add('fail');
    setTimeout(function () { buildBtn.classList.remove('fail'); }, 1500);
  }

  buildBtn.addEventListener('click', function () {
    buildBtn.classList.add('building');
    setTimeout(function () {
      buildFlowchart(false);
    }, 50);
  });

  // 4. Manual Visual Editor Integration
  edToggle.addEventListener('click', function () {
    if (!currentModel) {
      buildFlowchart(true);
    }

    // Toggle editor
    var edbar = $('edbar');
    if (!edbar) return;

    var isEditing = edToggle.classList.contains('active');
    if (!isEditing) {
      edToggle.classList.add('active');
      edbar.style.display = 'flex';
      renderEditorBar(edbar);
    } else {
      edToggle.classList.remove('active');
      edbar.style.display = 'none';
      edbar.innerHTML = '';
      buildFlowchart(false);
    }
  });

  function renderEditorBar(container) {
    container.innerHTML = `
      <span class="ed-hint">Режим редактирования: перетаскивайте блоки мышью</span>
      <div class="ed-div"></div>
      <button class="ed-btn" id="edAddProcess">+ Процесс</button>
      <button class="ed-btn" id="edAddDecision">+ Решение</button>
      <button class="ed-btn" id="edAddIO">+ Ввод/Вывод</button>
      <button class="ed-btn" id="edAddPrep">+ Подготовка</button>
      <div class="ed-div"></div>
      <button class="ed-btn pri" id="edSaveBtn">✓ Сохранить</button>
      <button class="ed-btn dng" id="edCancelBtn">✕ Выйти</button>
    `;

    $('edSaveBtn').addEventListener('click', function () {
      edToggle.classList.remove('active');
      container.style.display = 'none';
      container.innerHTML = '';
      toast('Правки сохранены', 'Схема зафиксирована');
    });

    $('edCancelBtn').addEventListener('click', function () {
      edToggle.classList.remove('active');
      container.style.display = 'none';
      container.innerHTML = '';
      buildFlowchart(false);
    });

    $('edAddProcess').addEventListener('click', function () {
      addCustomShape('process', 'Новое действие');
    });
    $('edAddDecision').addEventListener('click', function () {
      addCustomShape('decision', 'Условие?');
    });
    $('edAddIO').addEventListener('click', function () {
      addCustomShape('io', 'Ввод x');
    });
    $('edAddPrep').addEventListener('click', function () {
      addCustomShape('prep', 'i от 1 до n');
    });

    enableDraggableShapes();
  }

  function addCustomShape(type, text) {
    if (!currentModel) return;
    var dim = window.GOSTLayout.computeShapeDimensions(type, [text]);
    var newShape = {
      id: 'custom_' + Date.now(),
      type: type,
      x: 100,
      y: 100,
      w: dim.w,
      h: dim.h,
      cx: 100 + dim.w / 2,
      cy: 100 + dim.h / 2,
      lines: [text],
      fontSize: 13,
      lineH: 17,
      skew: dim.skew
    };
    currentModel.shapes.push(newShape);
    var svg = window.GOSTRenderer.renderModelSVG(currentModel);
    sheet.innerHTML = svg;
    applyZoom();
    enableDraggableShapes();
  }

  function enableDraggableShapes() {
    var svg = sheet.querySelector('svg');
    if (!svg) return;

    var shapes = svg.querySelectorAll('.sh');
    shapes.forEach(function (sh) {
      sh.style.cursor = 'move';
      var isDragging = false;
      var startX, startY;

      sh.addEventListener('mousedown', function (e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();

        function onMouseMove(ev) {
          if (!isDragging) return;
          var dx = (ev.clientX - startX) / scale;
          var dy = (ev.clientY - startY) / scale;
          startX = ev.clientX;
          startY = ev.clientY;

          // Move SVG element
          if (sh.tagName.toLowerCase() === 'rect') {
            var curX = parseFloat(sh.getAttribute('x') || 0);
            var curY = parseFloat(sh.getAttribute('y') || 0);
            sh.setAttribute('x', curX + dx);
            sh.setAttribute('y', curY + dy);
          } else if (sh.tagName.toLowerCase() === 'polygon') {
            var pts = sh.getAttribute('points').split(' ').map(function (pair) {
              var xy = pair.split(',');
              return (parseFloat(xy[0]) + dx) + ',' + (parseFloat(xy[1]) + dy);
            }).join(' ');
            sh.setAttribute('points', pts);
          }
        }

        function onMouseUp() {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  // 5. Export handlers
  function currentSvgString() {
    var svg = sheet.querySelector('svg');
    if (!svg) return null;
    var clone = svg.cloneNode(true);
    clone.querySelectorAll('.sh.hl').forEach(function (el) { el.classList.remove('hl'); });
    clone.setAttribute('width', natW);
    clone.setAttribute('height', natH);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + clone.outerHTML;
  }

  function downloadFile(content, fileName, mimeType) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  // Download SVG
  dlSvg.addEventListener('click', function () {
    var svgStr = currentSvgString();
    if (!svgStr) return;
    downloadFile(svgStr, 'flowchart.svg', 'image/svg+xml;charset=utf-8');
    toast('SVG скачан', 'Векторный файл ГОСТ сохранен');
  });

  // Download PNG (High DPI Canvas)
  dlPng.addEventListener('click', function () {
    var svgStr = currentSvgString();
    if (!svgStr) return;

    var dpi = 2.5; // High-res retina rendering
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(natW * dpi);
    canvas.height = Math.round(natH * dpi);
    var ctx = canvas.getContext('2d');

    var img = new Image();
    var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    img.onload = function () {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (pngBlob) {
        downloadFile(pngBlob, 'flowchart.png', 'image/png');
        toast('PNG скачан', 'Высокое разрешение (2.5x) готово');
      }, 'image/png');
    };
    img.src = url;
  });

  // Download VSDX (Microsoft Visio)
  dlVsdx.addEventListener('click', function () {
    if (!currentModel) return;
    var res = window.GOSTRenderer.generateVSDXFromModel(currentModel);
    if (res.error) {
      alert('Ошибка формирования VSDX: ' + res.error);
      return;
    }
    var blob = new Blob([res.bytes], { type: 'application/vnd.ms-visio.drawing' });
    downloadFile(blob, 'flowchart.vsdx', 'application/vnd.ms-visio.drawing');
    toast('VSDX скачан', 'Файл для Microsoft Visio сформирован');
  });

  // 6. Toast Notification Helper
  function toast(title, desc) {
    var box = $('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `
      <div class="tk"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 7.5l3.5 3.5L12 3.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="tmsg"><b>${title}</b><span class="tsub">${desc}</span></div>
    `;
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 2800);
  }

  // 7. Navigation Tabs
  var tabs = document.querySelectorAll('.tab[data-tab]');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      document.querySelectorAll('.tabpage').forEach(function (page) {
        page.classList.remove('active');
      });

      var activePage = $('tab-' + target);
      if (activePage) activePage.classList.add('active');

      if (target === 'examples') {
        renderExamplesGallery();
      } else if (target === 'figures') {
        renderFiguresCatalog();
      } else if (target === 'gen') {
        applyZoom();
      }
    });
  });

  // 8. Render Examples Gallery
  function renderExamplesGallery() {
    var grid = $('exGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var list = window.CS_EXAMPLE_LIST || [];
    var exData = (window.FC_EXAMPLES && window.FC_EXAMPLES.csharp) || {};

    if (list.length === 0 && Object.keys(exData).length > 0) {
      Object.keys(exData).forEach(function (k) {
        list.push({
          id: k,
          title: k.toUpperCase(),
          desc: 'Алгоритм C#',
          code: typeof exData[k] === 'string' ? exData[k] : (exData[k].source || '')
        });
      });
    }

    list.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'ex-card';
      var srcCode = item.code || (exData[item.id] ? (exData[item.id].source || exData[item.id]) : '');
      var preview = srcCode.split('\n').slice(0, 5).join('\n');

      card.innerHTML = `
        <h3>${item.title || item.id}</h3>
        <div class="sub">${item.desc || item.blurb || 'Алгоритм C#'}</div>
        <pre>${preview}</pre>
      `;

      card.addEventListener('click', function () {
        var exLang = item.language || (exData[item.id] ? exData[item.id].language : 'csharp');
        if (exLang && langSelect) {
          langSelect.value = exLang;
          currentLang = exLang;
          var info = LANG_INFO[currentLang] || { name: currentLang, badge: currentLang };
          if (srcLangLabel) srcLangLabel.textContent = info.name;
          if (langBadge) langBadge.textContent = info.badge;
        }
        code.value = srcCode;
        updateGutter();
        $('tabs').querySelector('[data-tab="gen"]').click();
        buildFlowchart(true);
      });

      grid.appendChild(card);
    });
  }

  // 9. Render Figures Catalog
  function renderFiguresCatalog() {
    var container = $('legendBody');
    if (!container) return;
    container.innerHTML = `
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><rect class="sh" x="2" y="5" width="64" height="30" rx="15" ry="15"/></svg></div>
        <div class="leg-txt"><div class="nm">Терминатор (Пуск / Останов)</div><div class="ds">Начало или конец алгоритма, подпрограммы, функции. Радиус скругления равен половине высоты блока.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><rect class="sh" x="2" y="6" width="64" height="28"/></svg></div>
        <div class="leg-txt"><div class="nm">Процесс (Действие)</div><div class="ds">Вычисления, присваивания и обработка данных. Последовательные операции объединяются в один блок.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><polygon class="sh" points="14,6 66,6 54,34 2,34"/></svg></div>
        <div class="leg-txt"><div class="nm">Данные (Ввод / Вывод)</div><div class="ds">Ввод исходных данных и вывод результатов. Применяется для команд ввода (input, cin, scanf, ReadLine) и вывода.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><polygon class="sh" points="34,4 66,20 34,36 2,20"/></svg></div>
        <div class="leg-txt"><div class="nm">Решение (Ветвление)</div><div class="ds">Ромб условия с выходами «Да» (вниз) и «Нет» (вправо). Текст внутри подгоняется под размер блока.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><polygon class="sh" points="14,6 54,6 66,20 54,34 14,34 2,20"/></svg></div>
        <div class="leg-txt"><div class="nm">Подготовка (Цикл for)</div><div class="ds">Шестиугольник для циклов со счетчиком. Содержит переменную цикла и диапазон («i от 1 до n»).</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><rect class="sh" x="2" y="6" width="64" height="28"/><line class="ln" x1="12" y1="6" x2="12" y2="34"/><line class="ln" x1="56" y1="6" x2="56" y2="34"/></svg></div>
        <div class="leg-txt"><div class="nm">Предопределенный процесс</div><div class="ds">Прямоугольник с вертикальными полосами по бокам. Обозначает вызов отдельной функции, метода или модуля.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><polygon class="sh" points="10,6 58,6 66,14 66,34 2,34 2,14"/></svg></div>
        <div class="leg-txt"><div class="nm">Граница цикла (начало)</div><div class="ds">Трапеция со срезанными верхними углами. Обозначает начало составного цикла (while, do-while) по ГОСТ.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><polygon class="sh" points="2,6 66,6 66,26 58,34 10,34 2,26"/></svg></div>
        <div class="leg-txt"><div class="nm">Граница цикла (конец)</div><div class="ds">Трапеция со срезанными нижними углами. Завершение тела цикла по ГОСТ 19.701-90 с проверкой условия.</div></div>
      </div>
      <div class="leg-card">
        <div class="leg-ico"><svg viewBox="0 0 68 40" width="68" height="40"><circle class="sh" cx="34" cy="20" r="14"/></svg></div>
        <div class="leg-txt"><div class="nm">Соединитель</div><div class="ds">Кружок для разрыва линий и перехода на другую страницу или в параллельный столбец схемы.</div></div>
      </div>
    `;
  }

  // 10. Splitter resizing
  var vsplit = $('vsplit');
  if (vsplit) {
    var isResizing = false;
    vsplit.addEventListener('mousedown', function (e) {
      isResizing = true;
      vsplit.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMouseMove(ev) {
        if (!isResizing) return;
        var main = document.querySelector('main');
        var rect = main.getBoundingClientRect();
        var offset = ev.clientX - rect.left;
        var totalW = rect.width;
        var pct = Math.max(25, Math.min(75, (offset / totalW) * 100));
        main.style.gridTemplateColumns = pct + '% 7px 1fr';
      }

      function onMouseUp() {
        isResizing = false;
        vsplit.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        fitToWindow();
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  // Language templates
  var TEMPLATES = {
    csharp: `using System;

class Program
{
    static void Main()
    {
        Console.Write("Enter a: ");
        double a = double.Parse(Console.ReadLine());

        Console.Write("Enter b: ");
        double b = double.Parse(Console.ReadLine());

        Console.Write("Enter c: ");
        double c = double.Parse(Console.ReadLine());

        double max;
        if (a >= b && a >= c)
        {
            max = a;
        }
        else if (b >= c)
        {
            max = b;
        }
        else
        {
            max = c;
        }

        Console.WriteLine("Max: " + max);
    }
}`,

    python: `# Нахождение максимума трех чисел и суммы ряда
a = float(input("Enter a: "))
b = float(input("Enter b: "))
c = float(input("Enter c: "))

if a >= b and a >= c:
    max_val = a
elif b >= c:
    max_val = b
else:
    max_val = c

total = 0
for i in range(1, 11):
    total += i

print("Max:", max_val)
print("Sum 1..10:", total)`,

    cpp: `#include <iostream>
using namespace std;

int main()
{
    double a, b, c;
    cin >> a >> b >> c;

    double max_val;
    if (a >= b && a >= c) {
        max_val = a;
    } else if (b >= c) {
        max_val = b;
    } else {
        max_val = c;
    }

    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum += i;
    }

    cout << "Max: " << max_val << endl;
    cout << "Sum: " << sum << endl;
    return 0;
}`,

    c: `#include <stdio.h>

int main()
{
    int a, b;
    scanf("%d %d", &a, &b);

    int max;
    if (a > b) {
        max = a;
    } else {
        max = b;
    }

    int sum = 0;
    for (int i = 1; i <= 10; i++) {
        sum += i;
    }

    printf("%d\\n", max);
    printf("%d\\n", sum);
    return 0;
}`,

    go: `package main

import "fmt"

func main() {
    var a, b int
    fmt.Scan(&a, &b)

    var max int
    if a > b {
        max = a
    } else {
        max = b
    }

    sum := 0
    for i := 1; i <= 10; i++ {
        sum += i
    }

    fmt.Println(max)
    fmt.Println(sum)
}`
  };

  var userCodes = {
    csharp: TEMPLATES.csharp,
    python: TEMPLATES.python,
    cpp: TEMPLATES.cpp,
    c: TEMPLATES.c,
    go: TEMPLATES.go
  };

  var LANG_INFO = {
    csharp: { name: 'C#', badge: 'C# 13 / .NET' },
    python: { name: 'Python', badge: 'Python 3' },
    cpp: { name: 'C++', badge: 'C++ 20 / ISO' },
    c: { name: 'C', badge: 'C (ANSI / C99)' },
    go: { name: 'Go', badge: 'Go 1.22' }
  };

  if (langSelect) {
    langSelect.addEventListener('change', function () {
      // Save current code
      userCodes[currentLang] = code.value;

      currentLang = langSelect.value;
      var info = LANG_INFO[currentLang] || { name: currentLang, badge: currentLang };

      if (srcLangLabel) srcLangLabel.textContent = info.name;
      if (langBadge) langBadge.textContent = info.badge;

      // Switch editor code
      code.value = userCodes[currentLang] || TEMPLATES[currentLang] || '';
      updateGutter();
      buildFlowchart(true);
      toast('Язык: ' + info.name, 'Шаблон загружен, схема перестроена по ГОСТ');
    });
  }

  // 11. Dark / Light Theme Switching
  function setTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeLabel) themeLabel.textContent = 'Светлая тема';
      localStorage.setItem('gost_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeLabel) themeLabel.textContent = 'Тёмная тема';
      localStorage.setItem('gost_theme', 'light');
    }
  }

  function initTheme() {
    var urlParams = (window.location && window.location.search) ? new URLSearchParams(window.location.search) : null;
    var urlTheme = urlParams ? urlParams.get('theme') : null;
    var saved = urlTheme || localStorage.getItem('gost_theme');
    if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme(true);
    } else {
      setTheme(false);
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(!isDark);
      toast('Тема переключена', !isDark ? 'Тёмная тема оформления включена' : 'Светлая тема оформления включена');
    });
  }

  // Initialize
  initTheme();
  renderFiguresCatalog();
  code.value = TEMPLATES.csharp;
  updateGutter();
  buildFlowchart(true);

  if (window.location && window.location.hash) {
    var hTab = window.location.hash.replace(/^#tab-|^#/, '');
    var matchedTab = document.querySelector('.tab[data-tab="' + hTab + '"]');
    if (matchedTab) {
      matchedTab.click();
    }
  }

  // Expose global app object
  window.app = {
    build: buildFlowchart,
    fit: fitToWindow,
    toast: toast,
    setTheme: setTheme,
    setLanguage: function (lang) {
      if (langSelect && LANG_INFO[lang]) {
        langSelect.value = lang;
        langSelect.dispatchEvent(new Event('change'));
      }
    }
  };

})();
