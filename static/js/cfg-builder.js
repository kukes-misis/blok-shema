// cfg-builder.js - Builds a structured Control Flow Graph for GOST 19.701-90 flowchart generation
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CFGBuilder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var idCounter = 1;
  function nextId() {
    return 'node_' + (idCounter++);
  }

  function buildCFG(ast, options) {
    idCounter = 1;
    options = options || {};
    var methodName = ast.primaryName || 'Main';

    var rootNodes = [];
    var entryNode = {
      id: nextId(),
      type: 'terminal',
      text: 'Начало',
      subText: (options.showMethodName !== false && methodName !== 'Main') ? methodName : null,
      lines: (options.showMethodName !== false && methodName && methodName !== 'Main') ? ['Начало', methodName] : ['Начало'],
      srcLine: ast.primaryMethod ? ast.primaryMethod.srcLine : 1
    };
    rootNodes.push(entryNode);

    var bodyStatements = ast.statements || [];
    var processedNodes = transformStatements(bodyStatements, options);

    rootNodes = rootNodes.concat(processedNodes);

    var exitNode = {
      id: nextId(),
      type: 'terminal',
      text: 'Конец',
      subText: (options.showMethodName !== false && methodName !== 'Main') ? methodName : null,
      lines: (options.showMethodName !== false && methodName && methodName !== 'Main') ? ['Конец', methodName] : ['Конец'],
      srcLine: (bodyStatements.length > 0) ? bodyStatements[bodyStatements.length - 1].srcLine : 1
    };
    rootNodes.push(exitNode);

    return {
      methodName: methodName,
      nodes: rootNodes
    };
  }

  function transformStatements(statements, options) {
    var result = [];
    var pendingAssignments = [];

    function flushAssignments() {
      if (pendingAssignments.length === 0) return;
      // Group consecutive assignments into a single process block (up to 4 lines)
      while (pendingAssignments.length > 0) {
        var chunk = pendingAssignments.splice(0, 4);
        var lines = chunk.map(function (a) { return a.gostText || a.rawText; });
        result.push({
          id: nextId(),
          type: 'process',
          text: lines.join('\n'),
          lines: lines,
          srcLine: chunk[0].srcLine
        });
      }
    }

    for (var i = 0; i < statements.length; i++) {
      var stmt = statements[i];
      if (!stmt) continue;

      if (stmt.type === 'AssignmentStatement') {
        pendingAssignments.push(stmt);
        continue;
      }

      // Any non-assignment flushes pending assignments
      flushAssignments();

      if (stmt.type === 'InputStatement') {
        var inText = stmt.gostText || stmt.varName || 'Ввод';
        result.push({
          id: nextId(),
          type: 'io',
          ioType: 'input',
          text: inText,
          lines: [inText],
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'OutputStatement') {
        var outText = stmt.gostText || 'Вывод';
        // If output has multiple variables or lines
        var outLines = outText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        if (outLines.length === 0) outLines = [outText];
        result.push({
          id: nextId(),
          type: 'io',
          ioType: 'output',
          text: outLines.join('\n'),
          lines: outLines,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'MethodCallStatement') {
        var callText = stmt.methodName + '(' + (stmt.args || '') + ')';
        result.push({
          id: nextId(),
          type: 'predef',
          text: callText,
          lines: [callText],
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'IfStatement') {
        var thenNodes = transformStatements(stmt.thenBranch || [], options);
        var elseNodes = stmt.elseBranch ? transformStatements(stmt.elseBranch, options) : null;

        var condText = cleanConditionText(stmt.condition);
        result.push({
          id: nextId(),
          type: 'if',
          condition: condText,
          lines: wrapTextLines(condText, 26),
          thenBranch: thenNodes,
          elseBranch: elseNodes,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'ForStatement') {
        var forBody = transformStatements(stmt.body || [], options);
        var prepText = stmt.gostText || (stmt.condition || 'цикл');
        result.push({
          id: nextId(),
          type: 'for',
          counterVar: stmt.counterVar || 'i',
          text: prepText,
          lines: wrapTextLines(prepText, 24),
          body: forBody,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'WhileStatement') {
        var whileBody = transformStatements(stmt.body || [], options);
        var wCond = cleanConditionText(stmt.condition);
        result.push({
          id: nextId(),
          type: 'while',
          condition: wCond,
          lines: wrapTextLines(wCond, 26),
          body: whileBody,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'DoWhileStatement') {
        var doBody = transformStatements(stmt.body || [], options);
        var doCond = cleanConditionText(stmt.condition);
        result.push({
          id: nextId(),
          type: 'dowhile',
          condition: doCond,
          lines: wrapTextLines(doCond, 26),
          body: doBody,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'ForEachStatement') {
        var feBody = transformStatements(stmt.body || [], options);
        var feText = stmt.gostText || (stmt.item + ' в ' + stmt.collection);
        result.push({
          id: nextId(),
          type: 'foreach',
          text: feText,
          lines: wrapTextLines(feText, 24),
          body: feBody,
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'ReturnStatement') {
        var retText = stmt.expr ? 'Выход: ' + stmt.expr : 'Выход';
        result.push({
          id: nextId(),
          type: 'process',
          text: retText,
          lines: [retText],
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'BreakStatement' || stmt.type === 'ContinueStatement') {
        result.push({
          id: nextId(),
          type: 'process',
          text: stmt.rawText,
          lines: [stmt.rawText],
          srcLine: stmt.srcLine
        });
      } else if (stmt.type === 'BlockStatement') {
        var inner = transformStatements(stmt.statements || [], options);
        result = result.concat(inner);
      }
    }

    flushAssignments();
    return result;
  }

  function cleanConditionText(cond) {
    if (!cond) return '';
    return cond.replace(/\s+/g, ' ')
               .replace(/&&/g, 'и')
               .replace(/\|\|/g, 'или')
               .trim();
  }

  function wrapTextLines(str, maxLen) {
    maxLen = maxLen || 26;
    if (str.length <= maxLen) return [str];
    var words = str.split(' ');
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!cur) {
        cur = w;
      } else if ((cur + ' ' + w).length <= maxLen) {
        cur += ' ' + w;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  return {
    buildCFG: buildCFG,
    wrapTextLines: wrapTextLines
  };
});
