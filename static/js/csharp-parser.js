// csharp-parser.js - AST parser for C# algorithms
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var CSharpLexer = require('./csharp-lexer');
    module.exports = factory(CSharpLexer);
  } else {
    root.CSharpParser = factory(root.CSharpLexer);
  }
})(typeof self !== 'undefined' ? self : this, function (CSharpLexer) {
  'use strict';

  function parse(source) {
    var tokens = CSharpLexer.tokenize(source);
    // Filter out comments from stream, but preserve them if needed
    var stream = tokens.filter(function (t) { return t.type !== 'comment'; });
    var pos = 0;

    function peek(offset) {
      offset = offset || 0;
      var idx = pos + offset;
      return idx < stream.length ? stream[idx] : stream[stream.length - 1];
    }

    function current() {
      return peek(0);
    }

    function advance() {
      var t = current();
      if (t.type !== 'eof') pos++;
      return t;
    }

    function check(type, value) {
      var t = current();
      if (t.type !== type) return false;
      if (value !== undefined && t.value !== value) return false;
      return true;
    }

    function match(type, value) {
      if (check(type, value)) {
        return advance();
      }
      return null;
    }

    function expect(type, value) {
      var t = match(type, value);
      if (!t) {
        var cur = current();
        throw new Error('Expected ' + (value || type) + ' at line ' + cur.line + ':' + cur.col + ' but got ' + cur.value);
      }
      return t;
    }

    // Skip using directives and namespaces
    function skipUsingsAndNamespaces() {
      while (current().type !== 'eof') {
        if (check('keyword', 'using')) {
          while (current().type !== 'eof' && current().value !== ';') {
            advance();
          }
          if (check('punct', ';')) advance();
          continue;
        }
        if (check('keyword', 'namespace')) {
          advance(); // skip 'namespace'
          while (current().type !== 'eof' && current().value !== '{' && current().value !== ';') {
            advance();
          }
          if (check('punct', ';')) {
            advance(); // file-scoped namespace
            continue;
          }
          if (check('punct', '{')) {
            advance();
            continue;
          }
        }
        break;
      }
    }

    // Extract text from tokens slice in original source
    function sliceSource(startToken, endToken) {
      var sLine = startToken.line;
      var eLine = endToken ? endToken.line : startToken.line;
      // Reconstruct clean text from tokens
      // Find start and end indices in stream
      var sIdx = stream.indexOf(startToken);
      var eIdx = endToken ? stream.indexOf(endToken) : sIdx;
      if (sIdx === -1) return startToken.value;
      if (eIdx === -1 || eIdx < sIdx) eIdx = sIdx;
      var parts = [];
      for (var i = sIdx; i <= eIdx; i++) {
        parts.push(stream[i].value);
      }
      return parts.join(' ').replace(/\s*([.,;()[\]{}])\s*/g, function(m, p) {
        if (p === ',' || p === ';') return p + ' ';
        if (p === '.') return '.';
        return p;
      }).trim();
    }

    // Parse methods or top-level statements
    function parseProgram() {
      skipUsingsAndNamespaces();

      var methods = {};
      var topLevelStatements = [];

      while (current().type !== 'eof') {
        // Skip closing braces of namespaces or classes
        if (check('punct', '}')) {
          advance();
          continue;
        }

        // Class, struct, record definition
        if (check('keyword', 'class') || check('keyword', 'struct') || check('keyword', 'record')) {
          advance(); // skip keyword
          if (current().type === 'ident') advance(); // name
          // skip base types, generic params, etc. up to '{'
          while (current().type !== 'eof' && current().value !== '{') {
            advance();
          }
          if (check('punct', '{')) advance();
          continue;
        }

        // Check if this looks like a method signature
        if (isMethodDeclaration()) {
          var method = parseMethod();
          if (method) {
            methods[method.name] = method;
          }
          continue;
        }

        // Otherwise, parse as top-level statement
        try {
          var stmt = parseStatement();
          if (stmt) topLevelStatements.push(stmt);
        } catch (e) {
          advance(); // error recovery
        }
      }

      // If we have methods, find Main or the first method
      var primaryMethod = null;
      var primaryName = 'Main';
      if (methods['Main']) {
        primaryMethod = methods['Main'];
      } else if (Object.keys(methods).length > 0) {
        var firstKey = Object.keys(methods)[0];
        primaryMethod = methods[firstKey];
        primaryName = firstKey;
      }

      return {
        type: 'Program',
        methods: methods,
        primaryMethod: primaryMethod,
        primaryName: primaryMethod ? primaryMethod.name : 'Main',
        topLevelStatements: topLevelStatements,
        statements: (primaryMethod ? primaryMethod.body : topLevelStatements)
      };
    }

    function isMethodDeclaration() {
      var saved = pos;
      // Skip modifiers (public, private, static, async, etc.)
      while (['public', 'private', 'protected', 'internal', 'static', 'async', 'virtual', 'override'].includes(current().value)) {
        advance();
      }
      // Return type
      if (current().type === 'keyword' || current().type === 'ident') {
        advance();
        if (check('punct', '<')) {
          // generics
          var depth = 1;
          advance();
          while (current().type !== 'eof' && depth > 0) {
            if (check('punct', '<')) depth++;
            if (check('punct', '>')) depth--;
            advance();
          }
        }
        if (check('punct', '[')) { // array
          advance();
          if (check('punct', ']')) advance();
        }
      } else {
        pos = saved;
        return false;
      }

      // Method name
      if (current().type !== 'ident') {
        pos = saved;
        return false;
      }
      advance();

      // Parameter list '('
      var isMethod = check('punct', '(');
      pos = saved;
      return isMethod;
    }

    function parseMethod() {
      var startTok = current();
      var modifiers = [];
      while (['public', 'private', 'protected', 'internal', 'static', 'async', 'virtual', 'override'].includes(current().value)) {
        modifiers.push(advance().value);
      }
      // Return type
      var returnType = advance().value;
      if (check('punct', '<')) {
        var depth = 1;
        returnType += advance().value;
        while (current().type !== 'eof' && depth > 0) {
          if (check('punct', '<')) depth++;
          if (check('punct', '>')) depth--;
          returnType += advance().value;
        }
      }
      if (check('punct', '[')) {
        advance(); advance();
        returnType += '[]';
      }

      // Name
      var methodName = expect('ident').value;

      // Params
      expect('punct', '(');
      var params = [];
      while (current().type !== 'eof' && current().value !== ')') {
        var pStart = current();
        while (current().type !== 'eof' && current().value !== ',' && current().value !== ')') {
          advance();
        }
        params.push(sliceSource(pStart, peek(-1)));
        if (check('punct', ',')) advance();
      }
      expect('punct', ')');

      // Body
      var body = [];
      if (check('punct', '{')) {
        body = parseBlock();
      } else if (check('punct', '=>')) {
        // Expression body
        advance();
        var exprStart = current();
        while (current().type !== 'eof' && current().value !== ';') advance();
        var exprText = sliceSource(exprStart, peek(-1));
        if (check('punct', ';')) advance();
        body = [{
          type: 'ReturnStatement',
          expr: exprText,
          rawText: 'return ' + exprText,
          srcLine: exprStart.line
        }];
      }

      return {
        type: 'MethodDeclaration',
        name: methodName,
        returnType: returnType,
        modifiers: modifiers,
        params: params,
        body: body,
        srcLine: startTok.line
      };
    }

    function parseBlock() {
      expect('punct', '{');
      var stmts = [];
      while (current().type !== 'eof' && current().value !== '}') {
        try {
          var s = parseStatement();
          if (s) stmts.push(s);
        } catch (e) {
          advance();
        }
      }
      expect('punct', '}');
      return stmts;
    }

    function parseStatement() {
      if (check('punct', ';')) {
        advance();
        return null;
      }
      if (check('punct', '{')) {
        return {
          type: 'BlockStatement',
          statements: parseBlock(),
          srcLine: current().line
        };
      }

      var tok = current();

      if (tok.type === 'keyword') {
        switch (tok.value) {
          case 'if': return parseIf();
          case 'while': return parseWhile();
          case 'do': return parseDoWhile();
          case 'for': return parseFor();
          case 'foreach': return parseForEach();
          case 'switch': return parseSwitch();
          case 'return': return parseReturn();
          case 'break':
            advance();
            if (check('punct', ';')) advance();
            return { type: 'BreakStatement', rawText: 'break', srcLine: tok.line };
          case 'continue':
            advance();
            if (check('punct', ';')) advance();
            return { type: 'ContinueStatement', rawText: 'continue', srcLine: tok.line };
        }
      }

      // Check for Console input / output or assignments / expressions
      return parseSimpleOrExpressionStatement();
    }

    function parseIf() {
      var startTok = expect('keyword', 'if');
      expect('punct', '(');
      var condStart = current();
      var cond = parseBalancedParens();
      var thenBranch = parseStatementOrBlock();
      var elseBranch = null;

      if (check('keyword', 'else')) {
        advance();
        elseBranch = parseStatementOrBlock();
      }

      return {
        type: 'IfStatement',
        condition: cond,
        thenBranch: thenBranch,
        elseBranch: elseBranch,
        srcLine: startTok.line
      };
    }

    function parseWhile() {
      var startTok = expect('keyword', 'while');
      expect('punct', '(');
      var cond = parseBalancedParens();
      var body = parseStatementOrBlock();

      return {
        type: 'WhileStatement',
        condition: cond,
        body: body,
        srcLine: startTok.line
      };
    }

    function parseDoWhile() {
      var startTok = expect('keyword', 'do');
      var body = parseStatementOrBlock();
      expect('keyword', 'while');
      expect('punct', '(');
      var cond = parseBalancedParens();
      if (check('punct', ';')) advance();

      return {
        type: 'DoWhileStatement',
        condition: cond,
        body: body,
        srcLine: startTok.line
      };
    }

    function parseFor() {
      var startTok = expect('keyword', 'for');
      expect('punct', '(');

      // Header has 3 parts: init; condition; step
      var initStart = current();
      while (current().type !== 'eof' && current().value !== ';') advance();
      var initStr = sliceSource(initStart, peek(-1));
      expect('punct', ';');

      var condStart = current();
      while (current().type !== 'eof' && current().value !== ';') advance();
      var condStr = sliceSource(condStart, peek(-1));
      expect('punct', ';');

      var stepStart = current();
      while (current().type !== 'eof' && current().value !== ')') advance();
      var stepStr = sliceSource(stepStart, peek(-1));
      expect('punct', ')');

      var body = parseStatementOrBlock();

      // Analyze for GOST preparation format (e.g. "i от 1 до n", "x от -4 до 4, шаг 0.5")
      var gostPrep = formatForGostPreparation(initStr, condStr, stepStr);

      return {
        type: 'ForStatement',
        init: initStr,
        condition: condStr,
        step: stepStr,
        gostText: gostPrep.text,
        counterVar: gostPrep.counterVar,
        body: body,
        srcLine: startTok.line
      };
    }

    function formatForGostPreparation(initStr, condStr, stepStr) {
      // e.g. init: "int i = 1" or "i = 1" or "double x = -4.0"
      // cond: "i <= n" or "x <= 4.0" or "i < 10"
      // step: "i++" or "i = i + 1" or "x += 0.5"
      var varMatch = initStr.match(/(?:(?:int|long|double|float|var)\s+)?([a-zA-Z_]\w*)\s*=\s*([^;]+)/);
      var condMatch = condStr.match(/([a-zA-Z_]\w*)\s*(<=|<|>=|>|!=)\s*([^;]+)/);

      if (varMatch && condMatch) {
        var v = varMatch[1].trim();
        var startVal = varMatch[2].trim();
        var op = condMatch[2];
        var endVal = condMatch[3].trim();

        if (op === '<') {
          // i < n -> "i от startVal до n - 1"
          if (/^\d+$/.test(endVal)) {
            endVal = String(parseInt(endVal, 10) - 1);
          } else {
            endVal = endVal + ' - 1';
          }
        }

        var stepDesc = '';
        if (stepStr) {
          var stepMatch = stepStr.match(/\+=\s*([^;]+)/);
          if (stepMatch) {
            var stepVal = stepMatch[1].trim();
            if (stepVal !== '1') stepDesc = ', шаг ' + stepVal;
          } else if (stepStr.includes('--') || stepStr.includes('-=')) {
            stepDesc = ', шаг -1';
          }
        }

        return {
          counterVar: v,
          text: v + ' от ' + startVal + ' до ' + endVal + stepDesc
        };
      }

      // Fallback
      return {
        counterVar: 'i',
        text: (condStr || initStr || 'цикл').trim()
      };
    }

    function parseForEach() {
      var startTok = expect('keyword', 'foreach');
      expect('punct', '(');
      var itemStart = current();
      while (current().type !== 'eof' && current().value !== 'in') advance();
      var itemStr = sliceSource(itemStart, peek(-1)).replace(/^(var|int|string|double|object)\s+/, '');
      expect('keyword', 'in');
      var collStart = current();
      while (current().type !== 'eof' && current().value !== ')') advance();
      var collStr = sliceSource(collStart, peek(-1));
      expect('punct', ')');

      var body = parseStatementOrBlock();

      return {
        type: 'ForEachStatement',
        item: itemStr.trim(),
        collection: collStr.trim(),
        gostText: itemStr.trim() + ' в ' + collStr.trim(),
        body: body,
        srcLine: startTok.line
      };
    }

    function parseSwitch() {
      var startTok = expect('keyword', 'switch');
      expect('punct', '(');
      var expr = parseBalancedParens();
      expect('punct', '{');

      var cases = [];
      while (current().type !== 'eof' && current().value !== '}') {
        if (check('keyword', 'case') || check('keyword', 'default')) {
          var isDefault = check('keyword', 'default');
          advance();
          var val = isDefault ? 'default' : '';
          if (!isDefault) {
            var vStart = current();
            while (current().type !== 'eof' && current().value !== ':') advance();
            val = sliceSource(vStart, peek(-1));
          }
          expect('punct', ':');
          var caseBody = [];
          while (current().type !== 'eof' &&
                 current().value !== 'case' &&
                 current().value !== 'default' &&
                 current().value !== '}') {
            var st = parseStatement();
            if (st) caseBody.push(st);
          }
          cases.push({ val: val, body: caseBody });
        } else {
          advance();
        }
      }
      expect('punct', '}');

      return {
        type: 'SwitchStatement',
        expr: expr,
        cases: cases,
        srcLine: startTok.line
      };
    }

    function parseReturn() {
      var startTok = expect('keyword', 'return');
      var expr = '';
      if (!check('punct', ';')) {
        var eStart = current();
        while (current().type !== 'eof' && current().value !== ';') advance();
        expr = sliceSource(eStart, peek(-1));
      }
      if (check('punct', ';')) advance();

      return {
        type: 'ReturnStatement',
        expr: expr,
        rawText: expr ? 'return ' + expr : 'return',
        srcLine: startTok.line
      };
    }

    function parseBalancedParens() {
      var start = current();
      var depth = 1;
      while (current().type !== 'eof' && depth > 0) {
        if (check('punct', '(')) depth++;
        else if (check('punct', ')')) {
          depth--;
          if (depth === 0) break;
        }
        advance();
      }
      var end = peek(-1);
      var text = sliceSource(start, end);
      expect('punct', ')');
      return text;
    }

    function parseStatementOrBlock() {
      if (check('punct', '{')) {
        return parseBlock();
      }
      var s = parseStatement();
      return s ? [s] : [];
    }

    function parseSimpleOrExpressionStatement() {
      var startTok = current();
      var lineNum = startTok.line;

      // Scan until semicolon ';'
      var tokensInStmt = [];
      while (current().type !== 'eof' && current().value !== ';') {
        tokensInStmt.push(advance());
      }
      if (check('punct', ';')) advance();

      if (tokensInStmt.length === 0) return null;

      var rawText = tokensInStmt.map(function(t){ return t.value; }).join(' ')
        .replace(/\s*([.,;()[\]{}])\s*/g, function(m, p) {
          if (p === ',' || p === ';') return p + ' ';
          if (p === '.') return '.';
          return p;
        }).trim();

      // Check for Console I/O
      // 1. Output: Console.WriteLine(...) or Console.Write(...)
      if (/Console\s*\.\s*(WriteLine|Write)\s*\(/.test(rawText)) {
        var outData = extractConsoleOutputData(rawText);
        return {
          type: 'OutputStatement',
          rawText: rawText,
          gostText: outData.text,
          vars: outData.vars,
          srcLine: lineNum
        };
      }

      // 2. Input: Console.ReadLine() or Parse(Console.ReadLine())
      if (/Console\s*\.\s*(ReadLine|Read|ReadKey)\s*\(/.test(rawText)) {
        var inData = extractConsoleInputData(rawText);
        return {
          type: 'InputStatement',
          rawText: rawText,
          gostText: inData.text,
          varName: inData.varName,
          srcLine: lineNum
        };
      }

      // 3. Method call: e.g. DoSomething(x, y); or MyMethod();
      var callMatch = rawText.match(/^([a-zA-Z_]\w*)\s*\((.*)\)$/);
      if (callMatch && !['if', 'for', 'while', 'switch'].includes(callMatch[1])) {
        return {
          type: 'MethodCallStatement',
          methodName: callMatch[1],
          args: callMatch[2],
          rawText: rawText,
          srcLine: lineNum
        };
      }

      // 4. Clean variable declarations & assignments for process blocks
      var cleanedAssignment = cleanAssignmentText(rawText);

      return {
        type: 'AssignmentStatement',
        rawText: rawText,
        gostText: cleanedAssignment,
        srcLine: lineNum
      };
    }

    // Smart ГОСТ extraction for Console.WriteLine:
    // e.g. Console.WriteLine("Result: " + factorial) -> factorial
    // Console.WriteLine($"Sum: {sum}") -> sum
    // Console.WriteLine(x, y) -> x, y
    // Console.WriteLine("Hello world") -> "Hello world"
    function extractConsoleOutputData(raw) {
      var match = raw.match(/Console\s*\.\s*(?:WriteLine|Write)\s*\((.*)\)/s);
      if (!match) return { text: raw, vars: [] };

      var inside = match[1].trim();
      if (!inside) return { text: '', vars: [] };

      // Case 1: Interpolated string $"... {var1} ... {var2}"
      var interpMatches = [...inside.matchAll(/\{([^}]+)\}/g)];
      if (interpMatches.length > 0) {
        var vars = interpMatches.map(function(m){ return m[1].trim(); });
        return { text: vars.join(', '), vars: vars };
      }

      // Case 2: String concatenation: "Text: " + varName
      var parts = inside.split('+').map(function(p){ return p.trim(); });
      var nonLiterals = parts.filter(function(p){
        return !(/^".*"$/.test(p) || /^'.*'$/.test(p));
      });
      if (nonLiterals.length > 0) {
        return { text: nonLiterals.join(', '), vars: nonLiterals };
      }

      // Case 3: Just literals: "Hello"
      return { text: inside, vars: [] };
    }

    // Smart ГОСТ extraction for Console.ReadLine:
    // int n = int.Parse(Console.ReadLine()); -> n
    // double a = double.Parse(Console.ReadLine()); -> a
    // str = Console.ReadLine(); -> str
    function extractConsoleInputData(raw) {
      // Find LHS variable name
      var match = raw.match(/(?:(?:int|double|float|long|string|char|var|bool)\s+)?([a-zA-Z_]\w*)\s*=/);
      if (match) {
        var v = match[1].trim();
        return { varName: v, text: v };
      }
      return { varName: '', text: 'Ввод' };
    }

    // Strip unnecessary type declarations for clean GOST diagram readability:
    // "int a = 5" -> "a = 5"
    // "double s = 0.0" -> "s = 0.0"
    function cleanAssignmentText(raw) {
      return raw.replace(/^(?:int|double|float|long|string|char|var|bool|decimal|uint|ulong|short|byte)\s+(\[\])?\s*/, '')
                .replace(/^\[.*?\]\s*/, '')
                .trim();
    }

    return parseProgram();
  }

  return {
    parse: parse
  };
});
