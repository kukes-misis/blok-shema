// csharp-lexer.js - Tokenizer for C# source code
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CSharpLexer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEYWORDS = new Set([
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
    'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
    'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
    'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
    'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
    'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
    'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'var',
    'virtual', 'void', 'volatile', 'while'
  ]);

  function tokenize(source) {
    var tokens = [];
    var i = 0;
    var len = source.length;
    var line = 1;
    var col = 1;

    function peek(n) {
      n = n || 0;
      return i + n < len ? source[i + n] : '';
    }

    function advance() {
      var ch = source[i++];
      if (ch === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      return ch;
    }

    while (i < len) {
      var ch = source[i];

      // Whitespace
      if (/\s/.test(ch)) {
        advance();
        continue;
      }

      var tokLine = line;
      var tokCol = col;

      // Comments
      if (ch === '/' && peek(1) === '/') {
        // Line comment
        var startIdx = i;
        while (i < len && source[i] !== '\n') {
          advance();
        }
        tokens.push({
          type: 'comment',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      if (ch === '/' && peek(1) === '*') {
        // Block comment
        var startIdx = i;
        advance(); advance();
        while (i < len && !(source[i] === '*' && peek(1) === '/')) {
          advance();
        }
        if (i < len) { advance(); advance(); }
        tokens.push({
          type: 'comment',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Preprocessor directive (#region, #pragma, etc.)
      if (ch === '#') {
        var startIdx = i;
        while (i < len && source[i] !== '\n') {
          advance();
        }
        continue;
      }

      // Interpolated or verbatim string ($"...", @"...", $@"...", @$"...")
      if ((ch === '$' || ch === '@') && (peek(1) === '"' || ((peek(1) === '$' || peek(1) === '@') && peek(2) === '"'))) {
        var startIdx = i;
        var isVerbatim = false;
        while (source[i] === '$' || source[i] === '@') {
          if (source[i] === '@') isVerbatim = true;
          advance();
        }
        advance(); // skip initial quote
        while (i < len) {
          if (source[i] === '"') {
            if (isVerbatim && peek(1) === '"') {
              advance(); advance();
              continue;
            }
            advance();
            break;
          }
          if (!isVerbatim && source[i] === '\\') {
            advance();
            if (i < len) advance();
            continue;
          }
          advance();
        }
        tokens.push({
          type: 'string',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Regular String literal
      if (ch === '"') {
        var startIdx = i;
        advance();
        while (i < len) {
          if (source[i] === '"') {
            advance();
            break;
          }
          if (source[i] === '\\') {
            advance();
            if (i < len) advance();
            continue;
          }
          if (source[i] === '\n') {
            break; // Unterminated string
          }
          advance();
        }
        tokens.push({
          type: 'string',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Character literal
      if (ch === "'") {
        var startIdx = i;
        advance();
        while (i < len) {
          if (source[i] === "'") {
            advance();
            break;
          }
          if (source[i] === '\\') {
            advance();
            if (i < len) advance();
            continue;
          }
          if (source[i] === '\n') break;
          advance();
        }
        tokens.push({
          type: 'char',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Numbers
      if (/\d/.test(ch) || (ch === '.' && /\d/.test(peek(1)))) {
        var startIdx = i;
        if (ch === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
          advance(); advance();
          while (i < len && /[0-9a-fA-F_]/.test(source[i])) advance();
        } else if (ch === '0' && (peek(1) === 'b' || peek(1) === 'B')) {
          advance(); advance();
          while (i < len && /[01_]/.test(source[i])) advance();
        } else {
          while (i < len && /[\d_]/.test(source[i])) advance();
          if (source[i] === '.' && /\d/.test(peek(1))) {
            advance();
            while (i < len && /[\d_]/.test(source[i])) advance();
          }
          if (source[i] === 'e' || source[i] === 'E') {
            advance();
            if (source[i] === '+' || source[i] === '-') advance();
            while (i < len && /[\d_]/.test(source[i])) advance();
          }
        }
        // Suffix (f, d, m, u, l, ul, lu, etc.)
        while (i < len && /[fFmMyYlLdDuU]/.test(source[i])) advance();

        tokens.push({
          type: 'number',
          value: source.slice(startIdx, i),
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Identifiers & Keywords
      if (/[a-zA-Z_\u0080-\uFFFF]/.test(ch)) {
        var startIdx = i;
        while (i < len && /[a-zA-Z0-9_\u0080-\uFFFF]/.test(source[i])) {
          advance();
        }
        var word = source.slice(startIdx, i);
        var type = KEYWORDS.has(word) ? 'keyword' : 'ident';
        tokens.push({
          type: type,
          value: word,
          line: tokLine,
          col: tokCol
        });
        continue;
      }

      // Multi-character operators
      var two = ch + peek(1);
      var three = two + peek(2);

      if (three === '<<=' || three === '>>=' || three === '??=' || three === '=>') {
        advance(); advance();
        if (three.length === 3) advance();
        tokens.push({ type: 'punct', value: three, line: tokLine, col: tokCol });
        continue;
      }

      if (two === '==' || two === '!=' || two === '<=' || two === '>=' ||
          two === '&&' || two === '||' || two === '++' || two === '--' ||
          two === '+=' || two === '-=' || two === '*=' || two === '/=' ||
          two === '%=' || two === '&=' || two === '|=' || two === '^=' ||
          two === '??' || two === '->' || two === '::') {
        advance(); advance();
        tokens.push({ type: 'punct', value: two, line: tokLine, col: tokCol });
        continue;
      }

      // Single-character punctuation
      advance();
      tokens.push({
        type: 'punct',
        value: ch,
        line: tokLine,
        col: tokCol
      });
    }

    tokens.push({ type: 'eof', value: '', line: line, col: col });
    return tokens;
  }

  return {
    tokenize: tokenize
  };
});
