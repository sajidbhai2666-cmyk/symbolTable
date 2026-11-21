/**
 * Standalone Client-Side Compiler & Semantic Scope Analyzer
 * Runs directly in the browser (Zero backend / Zero database required).
 * Provides lexical tokenization, hierarchical scope construction, symbol table generation,
 * System V AMD64 ABI memory layout simulation, and 16-bucket hash table simulation.
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. Lexical Analyzer / Tokenizer
  // =========================================================================

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

  // =========================================================================
  // 2. Memory Sizing, AMD64 Layout & Hash Simulator
  // =========================================================================

  const BASE_TYPE_SIZES = {
    'void': 0,
    'char': 1,
    'signed char': 1,
    'unsigned char': 1,
    'bool': 1,
    'boolean': 1,
    'int8_t': 1,
    'uint8_t': 1,
    'byte': 1,
    'short': 2,
    'unsigned short': 2,
    'int16_t': 2,
    'uint16_t': 2,
    'int': 4,
    'unsigned int': 4,
    'signed': 4,
    'unsigned': 4,
    'float': 4,
    'int32_t': 4,
    'uint32_t': 4,
    'long': 8, // 64-bit LP64 target
    'unsigned long': 8,
    'long long': 8,
    'unsigned long long': 8,
    'double': 8,
    'int64_t': 8,
    'uint64_t': 8,
    'size_t': 8,
    'pointer': 8, // 64-bit pointers
    'auto': 4,
    'number': 8,
    'string': 16 // string object descriptor
  };

  function calculateTypeSize(typeName, structDefinitions = {}) {
    if (!typeName) return 4;
    const clean = typeName.trim();

    // Pointer types (ends with * or includes *) are always pointer size (8 bytes on 64-bit)
    if (clean.endsWith('*') || clean.includes('*')) {
      return 8;
    }

    // Array types: e.g. int[10] or int arr[10]
    const arrayMatch = clean.match(/^(.*?)\[(\d+)\]$/);
    if (arrayMatch) {
      const elemType = arrayMatch[1].trim();
      const count = parseInt(arrayMatch[2], 10);
      const elemSize = calculateTypeSize(elemType, structDefinitions);
      return elemSize * count;
    }

    // Custom Struct / Class
    if (structDefinitions[clean]) {
      return structDefinitions[clean].totalSize || 16;
    }

    // Base types
    const lower = clean.toLowerCase();
    for (const [key, size] of Object.entries(BASE_TYPE_SIZES)) {
      if (lower === key || lower.startsWith(key + ' ') || lower.endsWith(' ' + key)) {
        return size;
      }
    }

    // Default fallback for unknown complex type
    return 4;
  }

  function assignMemoryLayout(symbols, scopes) {
    let globalDataOffset = 0;
    const functionStackFrames = new Map();
    const paramRegisters = ['RDI', 'RSI', 'RDX', 'RCX', 'R8', 'R9'];

    for (const sym of symbols) {
      sym.size = calculateTypeSize(sym.type);

      // Global symbols
      if (sym.scopeLevel === 0) {
        if (sym.kind === 'function') {
          sym.offset = 'TEXT_SEGMENT (Function Entry)';
          sym.offsetBytes = 0;
        } else if (sym.kind === 'class' || sym.kind === 'struct' || sym.kind === 'typedef') {
          sym.offset = 'TYPE_DEF';
          sym.offsetBytes = 0;
        } else {
          sym.offset = `+0x${globalDataOffset.toString(16).padStart(4, '0').toUpperCase()} (.data/.bss)`;
          sym.offsetBytes = globalDataOffset;
          globalDataOffset += Math.max(sym.size, 4); // align to at least 4 bytes
        }
        continue;
      }

      // Struct / Class Member Fields
      if (sym.scopeName && (sym.scopeName.startsWith('struct:') || sym.scopeName.startsWith('class:'))) {
        const scopeKey = sym.scopeId;
        let currentOffset = functionStackFrames.get(scopeKey) || 0;
        sym.offset = `Member: +0x${currentOffset.toString(16).padStart(4, '0').toUpperCase()}`;
        sym.offsetBytes = currentOffset;
        currentOffset += sym.size;
        functionStackFrames.set(scopeKey, currentOffset);
        continue;
      }

      // Parameters
      if (sym.kind === 'parameter') {
        const scopeKey = sym.scopeId;
        if (!functionStackFrames.has(scopeKey + '_param_idx')) {
          functionStackFrames.set(scopeKey + '_param_idx', 0);
        }
        const paramIdx = functionStackFrames.get(scopeKey + '_param_idx');
        if (paramIdx < paramRegisters.length) {
          sym.offset = `Reg: %${paramRegisters[paramIdx]} (Param #${paramIdx + 1})`;
          sym.offsetBytes = paramIdx;
        } else {
          const stackOffset = 16 + (paramIdx - paramRegisters.length) * 8;
          sym.offset = `[rbp + ${stackOffset}]`;
          sym.offsetBytes = stackOffset;
        }
        functionStackFrames.set(scopeKey + '_param_idx', paramIdx + 1);
        continue;
      }

      // Local variables in function or block scopes
      if (sym.kind === 'variable' || sym.kind === 'constant') {
        const scopeKey = sym.scopeId;
        let currentOffset = functionStackFrames.get(scopeKey) || 0;
        currentOffset += Math.max(sym.size, 4); // align stack allocation
        functionStackFrames.set(scopeKey, currentOffset);

        sym.offset = `[rbp - ${currentOffset}]`;
        sym.offsetBytes = -currentOffset;
        continue;
      }

      sym.offset = 'N/A';
      sym.offsetBytes = null;
    }

    return symbols;
  }

  function buildCompilerHashTable(symbols, tableSize = 16) {
    const buckets = Array.from({ length: tableSize }, (_, i) => ({
      bucketIndex: i,
      entries: []
    }));

    for (const sym of symbols) {
      let hash = 0;
      const name = sym.name;
      for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      }
      const bucketIndex = hash % tableSize;

      buckets[bucketIndex].entries.push({
        symbolName: sym.name,
        kind: sym.kind,
        type: sym.type,
        scopeName: sym.scopeName,
        line: sym.line,
        col: sym.col,
        hashCode: `0x${hash.toString(16).toUpperCase()}`
      });
    }

    return buckets;
  }

  // =========================================================================
  // 3. Hierarchical Scope Tree & Symbol Table Generator
  // =========================================================================

  class Scope {
    constructor(id, name, level, parent = null, startLine = 1) {
      this.id = id;
      this.name = name;
      this.level = level;
      this.parent = parent;
      this.children = [];
      this.startLine = startLine;
      this.endLine = 9999;
      this.symbols = new Map();
    }

    lookup(name) {
      if (this.symbols.has(name)) {
        return this.symbols.get(name);
      }
      if (this.parent) {
        return this.parent.lookup(name);
      }
      return null;
    }

    hasLocal(name) {
      return this.symbols.has(name);
    }
  }

  class SymbolTableGenerator {
    constructor(sourceCode, language = 'c') {
      this.sourceCode = sourceCode;
      this.language = language;
      this.tokens = tokenize(sourceCode, language);
      this.tokenIndex = 0;

      this.scopeCount = 0;
      this.rootScope = new Scope('scope_0', 'Global Scope', 0, null, 1);
      this.currentScope = this.rootScope;
      this.allScopes = [this.rootScope];

      this.symbols = [];
      this.diagnostics = [];
      this.references = [];
      this.structScopeIds = new Set();
    }

    peek(offset = 0) {
      const idx = this.tokenIndex + offset;
      return idx < this.tokens.length ? this.tokens[idx] : null;
    }

    next() {
      return this.tokenIndex < this.tokens.length ? this.tokens[this.tokenIndex++] : null;
    }

    enterScope(name, startLine) {
      this.scopeCount++;
      const newScope = new Scope(
        `scope_${this.scopeCount}`,
        name,
        this.currentScope.level + 1,
        this.currentScope,
        startLine
      );
      this.currentScope.children.push(newScope);
      this.allScopes.push(newScope);
      this.currentScope = newScope;
      return newScope;
    }

    exitScope(endLine) {
      if (this.currentScope.parent) {
        this.currentScope.endLine = endLine;
        this.currentScope = this.currentScope.parent;
      }
    }

    addSymbol(sym) {
      if (this.structScopeIds.has(this.currentScope.id) && sym.kind !== 'function') {
        sym.isMember = true;
      }

      // 1. Check for duplicate declaration in the same scope
      if (this.currentScope.hasLocal(sym.name)) {
        const prev = this.currentScope.symbols.get(sym.name);
        sym.isRedeclaration = true;
        this.diagnostics.push({
          severity: 'error',
          message: `Semantic Error: Redeclaration of '${sym.name}' in '${this.currentScope.name}' (previously declared at line ${prev.line}, col ${prev.col})`,
          line: sym.line,
          col: sym.col
        });
      }

      // 2. Check for variable shadowing in an outer scope
      if (!sym.isRedeclaration && this.currentScope.parent) {
        const outerSym = this.currentScope.parent.lookup(sym.name);
        if (outerSym) {
          sym.isShadowed = true;
          sym.shadows = `${outerSym.name} (${outerSym.scopeName} at L${outerSym.line})`;
          this.diagnostics.push({
            severity: 'warning',
            message: `Semantic Warning: '${sym.name}' shadows outer declaration in '${outerSym.scopeName}' (line ${outerSym.line})`,
            line: sym.line,
            col: sym.col
          });
        }
      }

      this.currentScope.symbols.set(sym.name, sym);
      this.symbols.push(sym);
    }

    parse() {
      if (this.language === 'python') {
        this.parsePython();
      } else {
        this.parseCStyle();
      }

      // Match references to symbols
      this.resolveReferences();

      // Mark unused symbols
      const structLikeKinds = new Set(['struct', 'class', 'enum', 'union', 'interface']);
      for (const sym of this.symbols) {
        if (sym.kind === 'function' || sym.name === 'main') continue;
        if (sym.isMember) continue;
        if (structLikeKinds.has(sym.kind) || sym.kind === 'typedef') continue;

        const refCount = sym.references ? sym.references.length : 0;
        if (refCount === 0 && !sym.isRedeclaration) {
          sym.isUnused = true;
          this.diagnostics.push({
            severity: 'warning',
            message: `Notice: '${sym.name}' declared at line ${sym.line} is never referenced`,
            line: sym.line,
            col: sym.col
          });
        }
      }

      // Assign memory layout and stack offsets
      assignMemoryLayout(this.symbols, this.allScopes);

      // Compute compiler hash table with buckets
      const hashTable = buildCompilerHashTable(this.symbols, 16);

      return {
        symbols: this.symbols,
        scopes: this.allScopes.map(s => ({
          id: s.id,
          name: s.name,
          level: s.level,
          parentId: s.parent ? s.parent.id : null,
          startLine: s.startLine,
          endLine: s.endLine,
          symbolCount: s.symbols.size
        })),
        diagnostics: this.diagnostics,
        hashTable
      };
    }

    parseCStyle() {
      while (this.tokenIndex < this.tokens.length) {
        const token = this.peek();
        if (!token) break;

        // Skip comments & preprocessors
        if (token.type === 'COMMENT' || token.type === 'PREPROCESSOR') {
          this.next();
          continue;
        }

        // Block Scope Opening {
        if (token.type === 'DELIMITER' && token.value === '{') {
          const blockName = `Block (L${token.line})`;
          this.enterScope(blockName, token.line);
          this.next();
          continue;
        }

        // Block Scope Closing }
        if (token.type === 'DELIMITER' && token.value === '}') {
          this.exitScope(token.line);
          this.next();
          continue;
        }

        // Class / Struct / Interface / Enum
        if (token.type === 'KEYWORD' && ['class', 'struct', 'interface', 'enum', 'union'].includes(token.value)) {
          this.parseClassOrStruct();
          continue;
        }

        // Typedef
        if (token.type === 'KEYWORD' && token.value === 'typedef') {
          this.parseTypedef();
          continue;
        }

        // Function or Variable declaration or statement
        if (this.isTypeOrStorage(token)) {
          this.parseDeclaration();
          continue;
        }

        // Control flow constructs: for, if, while, switch
        if (token.type === 'KEYWORD' && ['for', 'while', 'if', 'switch'].includes(token.value)) {
          this.parseControlFlow();
          continue;
        }

        // Identifier reference / assignment / function call
        if (token.type === 'IDENTIFIER') {
          this.recordIdentifierReference(token);
          this.next();
          continue;
        }

        this.next();
      }
    }

    isTypeOrStorage(token) {
      if (!token) return false;
      if (token.type === 'TYPE' || token.type === 'STORAGE') return true;
      if (token.type === 'KEYWORD' && ['const', 'let', 'var', 'function', 'struct', 'class', 'auto'].includes(token.value)) return true;
      if (token.type === 'IDENTIFIER') {
        const existing = this.currentScope.lookup(token.value);
        if (existing && ['struct', 'class', 'typedef', 'enum'].includes(existing.kind)) {
          return true;
        }
      }
      return false;
    }

    parseClassOrStruct() {
      const kindToken = this.next();
      const nameToken = this.peek();

      let name = `Anonymous_${kindToken.value}_L${kindToken.line}`;
      if (nameToken && nameToken.type === 'IDENTIFIER') {
        name = nameToken.value;
        this.next();
      }

      const sym = {
        name,
        kind: kindToken.value,
        type: `${kindToken.value} ${name}`,
        scopeId: this.currentScope.id,
        scopeName: this.currentScope.name,
        scopeLevel: this.currentScope.level,
        line: kindToken.line,
        col: kindToken.col,
        storageClass: 'public',
        references: []
      };
      this.addSymbol(sym);

      if (this.peek() && this.peek().value === '{') {
        this.next();
        const structScope = this.enterScope(`${kindToken.value}: ${name}`, kindToken.line);
        this.structScopeIds.add(structScope.id);
      }
    }

    parseTypedef() {
      const typedefToken = this.next();
      const typeTokens = [];
      while (this.tokenIndex < this.tokens.length) {
        const t = this.peek();
        if (!t || t.value === ';') break;
        typeTokens.push(this.next());
      }
      if (this.peek() && this.peek().value === ';') this.next();

      if (typeTokens.length >= 2) {
        const aliasToken = typeTokens[typeTokens.length - 1];
        const origType = typeTokens.slice(0, -1).map(x => x.value).join(' ');

        for (const tt of typeTokens.slice(0, -1)) {
          if (tt.type === 'IDENTIFIER') {
            this.references.push({
              name: tt.value,
              line: tt.line,
              col: tt.col,
              scopeId: this.currentScope.id
            });
          }
        }

        if (aliasToken.type === 'IDENTIFIER') {
          this.addSymbol({
            name: aliasToken.value,
            kind: 'typedef',
            type: origType,
            scopeId: this.currentScope.id,
            scopeName: this.currentScope.name,
            scopeLevel: this.currentScope.level,
            line: aliasToken.line,
            col: aliasToken.col,
            references: []
          });
        }
      }
    }

    parseDeclaration() {
      let storageClass = 'auto';
      let isConst = false;
      const typeParts = [];

      while (this.tokenIndex < this.tokens.length) {
        const t = this.peek();
        if (!t) break;
        if (t.type === 'STORAGE' || (t.type === 'KEYWORD' && ['static', 'extern', 'register', 'const', 'volatile', 'public', 'private', 'protected', 'let', 'var'].includes(t.value))) {
          if (t.value === 'const') isConst = true;
          storageClass = t.value;
          this.next();
        } else if (t.type === 'TYPE' || t.value === '*' || t.value === '&' || (t.type === 'KEYWORD' && ['unsigned', 'signed', 'long', 'short', 'struct', 'class', 'auto', 'function'].includes(t.value))) {
          typeParts.push(t.value);
          this.next();
        } else if (t.type === 'IDENTIFIER' && typeParts.length === 0) {
          const nextT = this.peek(1);
          const isFollowedById = nextT && (nextT.type === 'IDENTIFIER' || nextT.value === '*' || nextT.value === '&');
          const isJs = this.language === 'javascript' || this.language === 'js';
          if (isJs || ['let', 'var'].includes(storageClass) || !isFollowedById) {
            break;
          }
          this.references.push({
            name: t.value,
            line: t.line,
            col: t.col,
            scopeId: this.currentScope.id
          });
          typeParts.push(t.value);
          this.next();
        } else {
          break;
        }
      }

      const typeStr = typeParts.join(' ') || 'auto';

      const idToken = this.peek();
      if (!idToken || idToken.type !== 'IDENTIFIER') {
        if (idToken) this.next();
        return;
      }

      const name = idToken.value;
      const idLine = idToken.line;
      const idCol = idToken.col;
      this.next();

      let fullType = typeStr;

      // Array dimensions e.g. int arr[10]
      if (this.peek() && this.peek().value === '[') {
        let arrayDims = '';
        while (this.peek() && (this.peek().value === '[' || this.peek().type === 'NUMBER' || this.peek().type === 'IDENTIFIER' || this.peek().value === ']')) {
          arrayDims += this.next().value;
          if (arrayDims.endsWith(']')) break;
        }
        fullType = `${fullType}${arrayDims}`;
      }

      // Function definition: identifier followed by '('
      if (this.peek() && this.peek().value === '(') {
        this.next();

        const fnSymbol = {
          name,
          kind: 'function',
          type: `${fullType} (Function)`,
          scopeId: this.currentScope.id,
          scopeName: this.currentScope.name,
          scopeLevel: this.currentScope.level,
          line: idLine,
          col: idCol,
          storageClass,
          isConstant: isConst,
          references: []
        };
        this.addSymbol(fnSymbol);

        const fnScope = this.enterScope(`Function: ${name}()`, idLine);
        this.parseParameters();

        if (this.peek() && this.peek().value === '{') {
          this.next();
        } else if (this.peek() && this.peek().value === ';') {
          this.next();
          this.exitScope(idLine);
        }
        return;
      }

      // Variable or constant symbol
      const varSymbol = {
        name,
        kind: isConst ? 'constant' : 'variable',
        type: fullType,
        scopeId: this.currentScope.id,
        scopeName: this.currentScope.name,
        scopeLevel: this.currentScope.level,
        line: idLine,
        col: idCol,
        storageClass,
        isConstant: isConst,
        references: []
      };
      this.addSymbol(varSymbol);

      // Multiple declarators: e.g. int a = 5, b = 10;
      let parenDepth = 0;
      while (this.peek() && (this.peek().value !== ';' || parenDepth > 0)) {
        const nextTok = this.peek();
        if (!nextTok) break;

        if (nextTok.value === '(' || nextTok.value === '[' || nextTok.value === '{') {
          parenDepth++;
          this.next();
          continue;
        }
        if (nextTok.value === ')' || nextTok.value === ']' || nextTok.value === '}') {
          if (parenDepth > 0) parenDepth--;
          this.next();
          continue;
        }

        if (nextTok.value === ',' && parenDepth === 0) {
          this.next();
          const nextId = this.peek();
          if (nextId && nextId.type === 'IDENTIFIER') {
            this.next();
            this.addSymbol({
              name: nextId.value,
              kind: isConst ? 'constant' : 'variable',
              type: fullType,
              scopeId: this.currentScope.id,
              scopeName: this.currentScope.name,
              scopeLevel: this.currentScope.level,
              line: nextId.line,
              col: nextId.col,
              storageClass,
              isConstant: isConst,
              references: []
            });
          }
        } else {
          if (nextTok.type === 'IDENTIFIER') {
            this.recordIdentifierReference(nextTok);
          }
          this.next();
        }
      }
      if (this.peek() && this.peek().value === ';') {
        this.next();
      }
    }

    parseParameters() {
      while (this.tokenIndex < this.tokens.length) {
        const t = this.peek();
        if (!t || t.value === ')') {
          if (t && t.value === ')') this.next();
          break;
        }

        if (t.value === ',') {
          this.next();
          continue;
        }

        const paramTypeParts = [];
        while (this.tokenIndex < this.tokens.length) {
          const pt = this.peek();
          if (!pt || pt.value === ',' || pt.value === ')') break;
          if (pt.type === 'TYPE' || pt.value === '*' || pt.value === '&' || (pt.type === 'KEYWORD' && ['unsigned', 'signed', 'const'].includes(pt.value))) {
            paramTypeParts.push(pt.value);
            this.next();
          } else if (pt.type === 'IDENTIFIER') {
            const peekAhead = this.peek(1);
            if (peekAhead && (peekAhead.value === ',' || peekAhead.value === ')')) {
              const paramName = pt.value;
              this.next();
              this.addSymbol({
                name: paramName,
                kind: 'parameter',
                type: paramTypeParts.join(' ') || 'auto',
                scopeId: this.currentScope.id,
                scopeName: this.currentScope.name,
                scopeLevel: this.currentScope.level,
                line: pt.line,
                col: pt.col,
                storageClass: 'register',
                references: []
              });
              break;
            } else {
              this.references.push({
                name: pt.value,
                line: pt.line,
                col: pt.col,
                scopeId: this.currentScope.id
              });
              paramTypeParts.push(pt.value);
              this.next();
            }
          } else {
            this.next();
          }
        }
      }
    }

    parseControlFlow() {
      const kwToken = this.next();
      if (this.peek() && this.peek().value === '(') {
        this.next();
        let depth = 1;
        while (this.tokenIndex < this.tokens.length && depth > 0) {
          const t = this.peek();
          if (!t) break;
          if (t.value === '(') depth++;
          if (t.value === ')') depth--;

          if (kwToken.value === 'for' && this.isTypeOrStorage(t)) {
            this.parseDeclaration();
            continue;
          }

          if (t.type === 'IDENTIFIER') {
            this.recordIdentifierReference(t);
          }
          this.next();
        }
      }
    }

    parsePython() {
      while (this.tokenIndex < this.tokens.length) {
        const token = this.peek();
        if (!token) break;

        if (token.type === 'COMMENT') {
          this.next();
          continue;
        }

        // def foo(a, b):
        if (token.type === 'KEYWORD' && token.value === 'def') {
          this.next();
          const fnNameToken = this.next();
          if (fnNameToken && fnNameToken.type === 'IDENTIFIER') {
            this.addSymbol({
              name: fnNameToken.value,
              kind: 'function',
              type: 'function',
              scopeId: this.currentScope.id,
              scopeName: this.currentScope.name,
              scopeLevel: this.currentScope.level,
              line: fnNameToken.line,
              col: fnNameToken.col,
              references: []
            });
            const fnScope = this.enterScope(`def ${fnNameToken.value}()`, fnNameToken.line);
            if (this.peek() && this.peek().value === '(') {
              this.next();
              while (this.peek() && this.peek().value !== ')') {
                const p = this.next();
                if (p.type === 'IDENTIFIER') {
                  this.addSymbol({
                    name: p.value,
                    kind: 'parameter',
                    type: 'Any',
                    scopeId: fnScope.id,
                    scopeName: fnScope.name,
                    scopeLevel: fnScope.level,
                    line: p.line,
                    col: p.col,
                    references: []
                  });
                }
              }
              if (this.peek() && this.peek().value === ')') this.next();
            }
          }
          continue;
        }

        // class Foo:
        if (token.type === 'KEYWORD' && token.value === 'class') {
          this.next();
          const clsNameToken = this.next();
          if (clsNameToken && clsNameToken.type === 'IDENTIFIER') {
            this.addSymbol({
              name: clsNameToken.value,
              kind: 'class',
              type: 'class',
              scopeId: this.currentScope.id,
              scopeName: this.currentScope.name,
              scopeLevel: this.currentScope.level,
              line: clsNameToken.line,
              col: clsNameToken.col,
              references: []
            });
            this.enterScope(`class ${clsNameToken.value}`, clsNameToken.line);
          }
          continue;
        }

        // x = 10
        if (token.type === 'IDENTIFIER') {
          const nextTok = this.peek(1);
          if (nextTok && ['=', '+=', '-=', '*=', '/='].includes(nextTok.value)) {
            if (!this.currentScope.hasLocal(token.value)) {
              this.addSymbol({
                name: token.value,
                kind: 'variable',
                type: 'Any',
                scopeId: this.currentScope.id,
                scopeName: this.currentScope.name,
                scopeLevel: this.currentScope.level,
                line: token.line,
                col: token.col,
                references: []
              });
            }
          } else {
            this.recordIdentifierReference(token);
          }
          this.next();
          continue;
        }

        this.next();
      }
    }

    recordIdentifierReference(token) {
      if (!token || KEYWORDS.has(token.value) || TYPE_KEYWORDS.has(token.value)) return;
      const idx = this.tokens.indexOf(token);
      if (idx > 0) {
        const prev = this.tokens[idx - 1];
        if (prev && (prev.value === '.' || prev.value === '->')) {
          return;
        }
      }
      this.references.push({
        name: token.value,
        line: token.line,
        col: token.col,
        scopeId: this.currentScope.id
      });
    }

    resolveReferences() {
      for (const ref of this.references) {
        const refScope = this.allScopes.find(s => s.id === ref.scopeId) || this.rootScope;
        const targetSymbol = refScope.lookup(ref.name);

        if (targetSymbol) {
          if (!targetSymbol.references) targetSymbol.references = [];
          targetSymbol.references.push({
            line: ref.line,
            col: ref.col,
            scopeName: refScope.name
          });
        } else {
          const standardBuiltins = new Set([
            'printf', 'scanf', 'malloc', 'free', 'memcpy', 'memset', 'strlen', 'strcpy',
            'cout', 'cin', 'endl', 'vector', 'map', 'string', 'iostream',
            'console', 'Math', 'window', 'document', 'process', 'require',
            'System', 'out', 'println', 'print', 'range', 'len', 'int', 'str'
          ]);

          if (!standardBuiltins.has(ref.name)) {
            this.diagnostics.push({
              severity: 'error',
              message: `Semantic Error: Use of undeclared identifier '${ref.name}'`,
              line: ref.line,
              col: ref.col
            });
          }
        }
      }
    }
  }

  function analyzeSourceCode(sourceCode, language = 'c') {
    const generator = new SymbolTableGenerator(sourceCode, language);
    return generator.parse();
  }

  const CompilerEngine = {
    tokenize,
    calculateTypeSize,
    assignMemoryLayout,
    buildCompilerHashTable,
    Scope,
    SymbolTableGenerator,
    analyzeSourceCode,
    KEYWORDS,
    TYPE_KEYWORDS,
    STORAGE_KEYWORDS
  };

  // Expose to window/global in browser
  if (typeof global !== 'undefined') {
    global.Compiler = CompilerEngine;
    global.analyzeSourceCode = analyzeSourceCode;
  }

  // CommonJS export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompilerEngine;
  }

})(typeof window !== 'undefined' ? window : globalThis);
