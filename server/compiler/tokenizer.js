/**
 * Multi-Language Lexical Analyzer / Tokenizer
 * Supports C, C++, Java, JavaScript/TypeScript, and Python
 */

const KEYWORDS = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
  'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
  'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
  'class', 'namespace', 'public', 'private', 'protected', 'virtual', 'override',
  'template', 'typename', 'using', 'new', 'delete', 'bool', 'true', 'false',
  'nullptr', 'this', 'friend', 'inline', 'constexpr', 'static_assert',
  // Java / JS / TS additions
  'let', 'var', 'function', 'async', 'await', 'import', 'export', 'from',
  'package', 'interface', 'implements', 'extends', 'abstract', 'final',
  // Python additions
  'def', 'elif', 'pass', 'lambda', 'global', 'nonlocal', 'in', 'is', 'not', 'and', 'or', 'None'
]);

const TYPE_KEYWORDS = new Set([
  'int', 'char', 'float', 'double', 'void', 'short', 'long', 'signed', 'unsigned',
  'bool', 'boolean', 'string', 'String', 'size_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'byte', 'auto', 'number'
]);

const STORAGE_KEYWORDS = new Set([
  'static', 'extern', 'register', 'auto', 'const', 'volatile', 'constexpr',
  'public', 'private', 'protected', 'readonly'
]);

function tokenize(sourceCode, language = 'c') {
  const tokens = [];
  let index = 0;
  let line = 1;
  let col = 1;
  const len = sourceCode.length;

  while (index < len) {
    const char = sourceCode[index];

    // Handle newlines
    if (char === '\n') {
      index++;
      line++;
      col = 1;
      continue;
    }

    // Handle whitespace
    if (/\s/.test(char)) {
      index++;
      col++;
      continue;
    }

    // Handle Single-line comments (// or # for Python)
    if ((char === '/' && sourceCode[index + 1] === '/') || (language === 'python' && char === '#')) {
      const startCol = col;
      const startIdx = index;
      while (index < len && sourceCode[index] !== '\n') {
        index++;
        col++;
      }
      tokens.push({
        type: 'COMMENT',
        value: sourceCode.slice(startIdx, index),
        line,
        col: startCol
      });
      continue;
    }

    // Handle Multi-line comments (/* ... */)
    if (char === '/' && sourceCode[index + 1] === '*') {
      const startLine = line;
      const startCol = col;
      const startIdx = index;
      index += 2;
      col += 2;
      while (index < len && !(sourceCode[index] === '*' && sourceCode[index + 1] === '/')) {
        if (sourceCode[index] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        index++;
      }
      if (index < len) {
        index += 2;
        col += 2;
      }
      tokens.push({
        type: 'COMMENT',
        value: sourceCode.slice(startIdx, index),
        line: startLine,
        col: startCol
      });
      continue;
    }

    // Handle String literals ("..." or '...')
    if (char === '"' || char === "'") {
      const quote = char;
      const startCol = col;
      const startIdx = index;
      index++;
      col++;
      while (index < len && sourceCode[index] !== quote) {
        if (sourceCode[index] === '\\' && index + 1 < len) {
          index += 2;
          col += 2;
        } else if (sourceCode[index] === '\n') {
          line++;
          col = 1;
          index++;
        } else {
          index++;
          col++;
        }
      }
      if (index < len && sourceCode[index] === quote) {
        index++;
        col++;
      }
      tokens.push({
        type: 'STRING',
        value: sourceCode.slice(startIdx, index),
        line,
        col: startCol
      });
      continue;
    }

    // Handle Numbers (Hex, Binary, Floats, Integers)
    if (/\d/.test(char) || (char === '.' && /\d/.test(sourceCode[index + 1] || ''))) {
      const startCol = col;
      const startIdx = index;
      while (index < len && /[0-9a-fA-FxXbBpPeE._]/.test(sourceCode[index])) {
        index++;
        col++;
      }
      tokens.push({
        type: 'NUMBER',
        value: sourceCode.slice(startIdx, index),
        line,
        col: startCol
      });
      continue;
    }

    // Handle Identifiers & Keywords
    if (/[a-zA-Z_$]/.test(char)) {
      const startCol = col;
      const startIdx = index;
      while (index < len && /[a-zA-Z0-9_$]/.test(sourceCode[index])) {
        index++;
        col++;
      }
      const value = sourceCode.slice(startIdx, index);
      let type = 'IDENTIFIER';
      if (TYPE_KEYWORDS.has(value)) {
        type = 'TYPE';
      } else if (STORAGE_KEYWORDS.has(value)) {
        type = 'STORAGE';
      } else if (KEYWORDS.has(value)) {
        type = 'KEYWORD';
      }

      tokens.push({
        type,
        value,
        line,
        col: startCol
      });
      continue;
    }

    // Multi-character operators
    const twoChars = sourceCode.slice(index, index + 2);
    const threeChars = sourceCode.slice(index, index + 3);
    const multiOps = ['>>=', '<<=', '...', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '->', '::', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>'];

    if (multiOps.includes(threeChars)) {
      tokens.push({ type: 'OPERATOR', value: threeChars, line, col });
      index += 3;
      col += 3;
      continue;
    }
    if (multiOps.includes(twoChars)) {
      tokens.push({ type: 'OPERATOR', value: twoChars, line, col });
      index += 2;
      col += 2;
      continue;
    }

    // Delimiters & Single-char operators
    const delimiters = ['{', '}', '(', ')', '[', ']', ';', ',', ':', '.', '?'];
    const operators = ['+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~'];

    if (delimiters.includes(char)) {
      tokens.push({ type: 'DELIMITER', value: char, line, col });
      index++;
      col++;
      continue;
    }

    if (operators.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, line, col });
      index++;
      col++;
      continue;
    }

    // Preprocessor directive (e.g. #include, #define)
    if (char === '#' && language !== 'python') {
      const startCol = col;
      const startIdx = index;
      while (index < len && sourceCode[index] !== '\n') {
        index++;
        col++;
      }
      tokens.push({
        type: 'PREPROCESSOR',
        value: sourceCode.slice(startIdx, index),
        line,
        col: startCol
      });
      continue;
    }

    // Any other character
    tokens.push({ type: 'UNKNOWN', value: char, line, col });
    index++;
    col++;
  }

  return tokens;
}

module.exports = {
  tokenize,
  KEYWORDS,
  TYPE_KEYWORDS,
  STORAGE_KEYWORDS
};
