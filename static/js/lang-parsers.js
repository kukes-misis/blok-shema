// lang-parsers.js - Multi-language parser for C#, Python, C, C++, and Go
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var CSharpParser = require('./csharp-parser');
    module.exports = factory(CSharpParser);
  } else {
    root.LangParsers = factory(root.CSharpParser);
  }
})(typeof self !== 'undefined' ? self : this, function (CSharpParser) {
  'use strict';

  // ==========================================
  // 1. PYTHON PARSER
  // ==========================================
  var PythonParser = {
    parse: function (source) {
      var lines = source.split(/\r?\n/);
      var rootStmts = [];
      var functions = {};
      var curFunc = null;

      function getIndent(line) {
        var m = line.match(/^([ \t]*)/);
        return m ? m[1].replace(/\t/g, '    ').length : 0;
      }

      function parseSuite(startIdx, minIndent) {
        var stmts = [];
        var i = startIdx;

        while (i < lines.length) {
          var raw = lines[i];
          var trimmed = raw.trim();

          // Skip empty or comment lines
          if (!trimmed || trimmed.startsWith('#')) {
            i++;
            continue;
          }

          var indent = getIndent(raw);
          if (indent < minIndent) {
            break;
          }

          var lineNum = i + 1;

          // Function definition: def name(...):
          var defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*:/);
          if (defMatch) {
            var fName = defMatch[1];
            var fParams = defMatch[2];
            var fBodyRes = parseSuite(i + 1, indent + 1);
            functions[fName] = {
              type: 'MethodDeclaration',
              name: fName,
              params: fParams,
              body: fBodyRes.stmts,
              srcLine: lineNum
            };
            i = fBodyRes.nextIdx;
            continue;
          }

          // If / Elif / Else
          if (trimmed.startsWith('if ')) {
            var ifCond = trimmed.replace(/^if\s+/, '').replace(/:$/, '').trim();
            var thenRes = parseSuite(i + 1, indent + 1);
            i = thenRes.nextIdx;

            // Check for elif or else at same indent
            var elseStmts = [];
            while (i < lines.length) {
              var nRaw = lines[i];
              var nTrim = nRaw.trim();
              if (!nTrim || nTrim.startsWith('#')) { i++; continue; }
              var nIndent = getIndent(nRaw);
              if (nIndent !== indent) break;

              if (nTrim.startsWith('elif ')) {
                var elifCond = nTrim.replace(/^elif\s+/, '').replace(/:$/, '').trim();
                var elifRes = parseSuite(i + 1, indent + 1);
                i = elifRes.nextIdx;
                elseStmts.push({
                  type: 'IfStatement',
                  condition: elifCond,
                  thenBranch: elifRes.stmts,
                  elseBranch: [],
                  srcLine: i
                });
                break;
              } else if (nTrim.startsWith('else:')) {
                var elseRes = parseSuite(i + 1, indent + 1);
                i = elseRes.nextIdx;
                elseStmts = elseRes.stmts;
                break;
              } else {
                break;
              }
            }

            stmts.push({
              type: 'IfStatement',
              condition: ifCond,
              thenBranch: thenRes.stmts,
              elseBranch: elseStmts.length > 0 ? elseStmts : null,
              srcLine: lineNum
            });
            continue;
          }

          // While loop: while cond:
          if (trimmed.startsWith('while ')) {
            var whileCond = trimmed.replace(/^while\s+/, '').replace(/:$/, '').trim();
            var whileRes = parseSuite(i + 1, indent + 1);
            stmts.push({
              type: 'WhileStatement',
              condition: whileCond,
              body: whileRes.stmts,
              srcLine: lineNum
            });
            i = whileRes.nextIdx;
            continue;
          }

          // For loop: for i in range(...) or for x in items:
          var forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+(.*?):$/);
          if (forMatch) {
            var loopVar = forMatch[1];
            var iterExpr = forMatch[2].trim();
            var forRes = parseSuite(i + 1, indent + 1);

            // Translate range(a, b) into GOST preparation text: "i от a до b-1"
            var gostText = loopVar + ' в ' + iterExpr;
            var rangeMatch = iterExpr.match(/^range\((.*)\)$/);
            if (rangeMatch) {
              var rArgs = rangeMatch[1].split(',').map(function (s) { return s.trim(); });
              if (rArgs.length === 1) {
                gostText = loopVar + ' от 0 до ' + (isNaN(rArgs[0]) ? rArgs[0] + ' - 1' : parseInt(rArgs[0], 10) - 1);
              } else if (rArgs.length === 2) {
                var endVal = isNaN(rArgs[1]) ? rArgs[1] + ' - 1' : parseInt(rArgs[1], 10) - 1;
                gostText = loopVar + ' от ' + rArgs[0] + ' до ' + endVal;
              } else if (rArgs.length === 3) {
                var endVal = isNaN(rArgs[1]) ? rArgs[1] + ' - 1' : parseInt(rArgs[1], 10) - 1;
                gostText = loopVar + ' от ' + rArgs[0] + ' до ' + endVal + ', шаг ' + rArgs[2];
              }
            }

            stmts.push({
              type: 'ForStatement',
              counterVar: loopVar,
              init: loopVar + ' = 0',
              condition: iterExpr,
              step: '1',
              gostText: gostText,
              body: forRes.stmts,
              srcLine: lineNum
            });
            i = forRes.nextIdx;
            continue;
          }

          // Return statement
          if (trimmed.startsWith('return')) {
            var retExpr = trimmed.replace(/^return\s*/, '');
            stmts.push({
              type: 'ReturnStatement',
              expr: retExpr,
              rawText: trimmed,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Break / Continue
          if (trimmed === 'break' || trimmed === 'continue') {
            stmts.push({
              type: trimmed === 'break' ? 'BreakStatement' : 'ContinueStatement',
              rawText: trimmed,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Output: print(...)
          var printMatch = trimmed.match(/^print\((.*)\)$/s);
          if (printMatch) {
            var inside = printMatch[1].trim();
            var outText = inside;

            // Strip string literals if variables present: e.g. print("Max:", m) -> m
            var parts = inside.split(',').map(function (p) { return p.trim(); });
            var nonLiterals = parts.filter(function (p) {
              return !(/^['"].*['"]$/.test(p) || /^f['"].*['"]$/.test(p));
            });
            if (nonLiterals.length > 0) {
              outText = nonLiterals.join(', ');
            } else if (inside.startsWith('f"') || inside.startsWith("f'")) {
              var interp = [...inside.matchAll(/\{([^}]+)\}/g)].map(function(m){ return m[1].trim(); });
              if (interp.length > 0) outText = interp.join(', ');
            }

            stmts.push({
              type: 'OutputStatement',
              rawText: trimmed,
              gostText: outText,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Input: x = input(...) or x = int(input(...)) or x = float(input(...))
          if (trimmed.includes('input(')) {
            var inMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
            var varName = inMatch ? inMatch[1].trim() : 'Ввод';
            stmts.push({
              type: 'InputStatement',
              rawText: trimmed,
              gostText: varName,
              varName: varName,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Regular assignment or expression: a = 5, s += x, func()
          var assignMatch = trimmed.match(/^([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s*(=|\+=|-=|\*=|\/=)\s*(.*)/);
          if (assignMatch) {
            stmts.push({
              type: 'AssignmentStatement',
              rawText: trimmed,
              gostText: trimmed,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Method call: func(args)
          var callMatch = trimmed.match(/^([a-zA-Z_]\w*)\((.*)\)$/);
          if (callMatch) {
            stmts.push({
              type: 'MethodCallStatement',
              methodName: callMatch[1],
              args: callMatch[2],
              rawText: trimmed,
              srcLine: lineNum
            });
            i++;
            continue;
          }

          // Default fallback statement
          stmts.push({
            type: 'AssignmentStatement',
            rawText: trimmed,
            gostText: trimmed,
            srcLine: lineNum
          });
          i++;
        }

        return { stmts: stmts, nextIdx: i };
      }

      var res = parseSuite(0, 0);
      rootStmts = res.stmts;

      var primaryName = 'Основная программа';
      var primaryMethod = null;
      if (functions['main']) {
        primaryMethod = functions['main'];
        primaryName = 'main';
      } else if (Object.keys(functions).length > 0 && rootStmts.length === 0) {
        var first = Object.keys(functions)[0];
        primaryMethod = functions[first];
        primaryName = first;
      }

      return {
        type: 'Program',
        language: 'python',
        methods: functions,
        primaryMethod: primaryMethod,
        primaryName: primaryName,
        statements: primaryMethod ? primaryMethod.body : rootStmts
      };
    }
  };

  // ==========================================
  // 2. C / C++ PARSER
  // ==========================================
  var CppParser = {
    parse: function (source, isCpp) {
      var preprocessed = source
        // Remove preprocessor directives like #include, #define
        .replace(/^\s*#\s*(?:include|define|pragma|ifndef|ifdef|endif).*$/gm, '')
        .replace(/\busing\s+namespace\s+std\s*;/g, '')
        // C scanf with one or more variables: scanf("%d %d", &a, &b);
        .replace(/scanf\s*\(\s*"[^"]*"\s*,\s*([^)]+)\)\s*;/g, function (m, args) {
          var vars = args.split(',').map(function (s) {
            return s.replace(/&/g, '').trim();
          }).filter(Boolean);
          return vars.map(function (v) {
            return v + ' = Console.ReadLine();';
          }).join(' ');
        })
        // C printf with or without args
        .replace(/printf\s*\(\s*"([^"]*)"\s*(?:,\s*([^)]+))?\)\s*;/g, function (m, fmt, args) {
          if (args) {
            var vars = args.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            return 'Console.WriteLine(' + vars.join(' + ", " + ') + ');';
          }
          var clean = fmt.replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\t/g, '').trim();
          return 'Console.WriteLine("' + clean + '");';
        })
        // C++ getline(cin, str)
        .replace(/(?:std::)?getline\s*\(\s*(?:std::)?cin\s*,\s*([a-zA-Z_]\w*)\s*\)\s*;/g, '$1 = Console.ReadLine();')
        // C++ std::cin / cin >> a >> b >> c;
        .replace(/(?:std::)?cin\s*>>\s*([^;]+);/g, function (m, expr) {
          var vars = expr.split('>>').map(function (p) { return p.trim(); }).filter(Boolean);
          return vars.map(function (v) { return v + ' = Console.ReadLine();'; }).join(' ');
        })
        // C++ std::cout / cout << ...
        .replace(/(?:std::)?cout\s*<<\s*([^;]+);/g, function (m, expr) {
          var clean = expr.replace(/(?:std::)?endl/g, '').replace(/<<\s*"\s*\\n\s*"/g, '').trim();
          var parts = clean.split('<<').map(function (p) { return p.trim(); }).filter(Boolean);
          var vars = parts.filter(function (p) { return !/^".*"$/.test(p); });
          var target = vars.length > 0 ? vars.join(' + ') : (parts[0] || '""');
          return 'Console.WriteLine(' + target + ');';
        });

      var ast = CSharpParser.parse(preprocessed);
      ast.language = isCpp ? 'cpp' : 'c';
      return ast;
    }
  };

  // ==========================================
  // 3. GO (GOLANG) PARSER
  // ==========================================
  var GoParser = {
    parse: function (source) {
      // 1. Go Automatic Semicolon Insertion (ASI) on lines
      var lines = source.split(/\r?\n/);
      var out = [];
      for (var k = 0; k < lines.length; k++) {
        var raw = lines[k];
        var line = raw.trim();
        if (!line || line.startsWith('//') || line.startsWith('package ') || line.startsWith('import ')) {
          continue;
        }
        // If line does not end with opening bracket, comma, or semicolon, add semicolon
        if (!/[{}(,;]$/.test(line)) {
          raw = raw + ';';
        }
        out.push(raw);
      }
      var preprocessed = out.join('\n')
        // 2. Remove package & import declarations
        .replace(/^\s*package\s+\w+.*$/gm, '')
        .replace(/^\s*import\s*\([\s\S]*?\)/gm, '')
        .replace(/^\s*import\s+"[^"]+".*$/gm, '')
        // 3. Go declarations: var a, b int -> int a; int b;
        .replace(/\bvar\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s+(int|int64|float64|float32|string|bool)\s*;/g, function(m, vars, type) {
          return vars.split(',').map(function(v){ return type + ' ' + v.trim() + ';'; }).join(' ');
        })
        .replace(/\bvar\s+([a-zA-Z_]\w*)\s+(int|int64|float64|float32|string|bool)\s*;/g, '$2 $1;')
        // 4. Go standard for loop: for i := 1; i <= n; i++ { -> for (int i = 1; i <= n; i++) {
        .replace(/\bfor\s+([a-zA-Z_]\w*)\s*:=\s*([^;]+);\s*([^;]+);\s*([^{]+)\s*\{/g, 'for (int $1 = $2; $3; $4) {')
        .replace(/\bfor\s+([a-zA-Z_]\w*\s*=[^;]+);\s*([^;]+);\s*([^{]+)\s*\{/g, 'for ($1; $2; $3) {')
        // 5. Go short assignment: a := 5 -> var a = 5
        .replace(/([a-zA-Z_]\w*)\s*:=\s*/g, 'var $1 = ')
        // 6. Go input: fmt.Scan(&a, &b) -> a = Console.ReadLine(); b = Console.ReadLine();
        .replace(/fmt\s*\.\s*(?:Scan|Scanln|Scanf)\s*\((.*?)\)\s*;?/g, function(m, args) {
          var vars = args.split(',').map(function(a){ return a.replace(/&/g, '').trim(); }).filter(Boolean);
          return vars.map(function(v){ return v + ' = Console.ReadLine();'; }).join(' ');
        })
        // 7. Go output: fmt.Println(...) / fmt.Printf(...)
        .replace(/fmt\s*\.\s*(?:Println|Print|Printf)\s*\((.*?)\)\s*;?/g, 'Console.WriteLine($1);')
        // 8. Go if statement: if cond { -> if (cond) {
        .replace(/\bif\s+([^{;]+)\s*\{/g, function(m, cond) {
          var c = cond.trim();
          if (c.startsWith('(') && c.endsWith(')')) return 'if ' + c + ' {';
          return 'if (' + c + ') {';
        })
        // 9. Go for-as-while: for condition { -> while (condition) {
        .replace(/\bfor\s+([^{;]+)\s*\{/g, function (m, cond) {
          var c = cond.trim();
          if (c.includes(';')) return m; // Standard for loop
          return 'while (' + c + ') {';
        })
        // 10. Go func name() -> void name()
        .replace(/\bfunc\s+([a-zA-Z_]\w*)\s*\((.*?)\)\s*(?:[a-zA-Z_]\w*)?\s*\{/g, 'void $1($2) {');

      var ast = CSharpParser.parse(preprocessed);
      ast.language = 'go';
      return ast;
    }
  };

  // ==========================================
  // UNIFIED PARSER ROUTER
  // ==========================================
  function parseCode(source, lang) {
    lang = (lang || 'csharp').toLowerCase();
    switch (lang) {
      case 'python':
      case 'py':
        return PythonParser.parse(source);

      case 'c':
        return CppParser.parse(source, false);

      case 'cpp':
      case 'c++':
        return CppParser.parse(source, true);

      case 'go':
      case 'golang':
        return GoParser.parse(source);

      case 'csharp':
      case 'cs':
      default:
        var ast = CSharpParser.parse(source);
        ast.language = 'csharp';
        return ast;
    }
  }

  return {
    parse: parseCode,
    PythonParser: PythonParser,
    CppParser: CppParser,
    GoParser: GoParser,
    CSharpParser: CSharpParser
  };
});
