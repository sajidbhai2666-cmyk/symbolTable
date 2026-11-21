/**
 * Symbol Table Generator & Semantic Scope Analyzer
 * Constructs lexical scope tree, builds symbol table records, resolves references,
 * detects shadowing, duplicate declarations, and undeclared identifiers.
 */

const { tokenize, KEYWORDS, TYPE_KEYWORDS, STORAGE_KEYWORDS } = require('./tokenizer');
const { assignMemoryLayout, buildCompilerHashTable } = require('./memoryLayout');

class Scope {
  constructor(id, name, level, parent = null, startLine = 1) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.parent = parent;
    this.children = [];
    this.startLine = startLine;
    this.endLine = 9999;
    this.symbols = new Map(); // name -> Symbol
  }

  /**
   * Lexical lookup: search in current scope, then recursively in parents
   */
  lookup(name) {
    if (this.symbols.has(name)) {
      return this.symbols.get(name);
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return null;
  }

  /**
   * Check if name is defined in *this specific* scope
   */
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
    this.references = []; // { name, line, col, scopeId, kind }
    this.structScopeIds = new Set(); // scope IDs that belong to struct/class/union bodies
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
    // Tag struct/class/union members so they can be exempted from "unused" checks
    // (members are accessed via '.' or '->' which intentionally skips reference tracking)
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
    // Skip struct/class members (accessed via '.' or '->'), typedefs, structs,
    // classes, and enums used as type specifiers — these are referenced
    // implicitly through member access or type usage in declarations.
    const structLikeKinds = new Set(['struct', 'class', 'enum', 'union', 'interface']);
    for (const sym of this.symbols) {
      if (sym.kind === 'function' || sym.name === 'main') continue;

      // Struct/class members are accessed via dot/arrow notation which is
      // deliberately skipped by recordIdentifierReference(). Don't flag them.
      if (sym.isMember) continue;

      // Struct/class/enum/typedef declarations serve as type definitions;
      // they are referenced when used as type specifiers in other declarations.
      // The type-reference tracking in parseDeclaration already records these.
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

  /**
   * Parser for C / C++ / Java / JavaScript
   */
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
        // Find previous context if any (e.g. if/while/for or bare block)
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
    // Check if token value is a known struct/class/typedef
    if (token.type === 'IDENTIFIER') {
      const existing = this.currentScope.lookup(token.value);
      if (existing && ['struct', 'class', 'typedef', 'enum'].includes(existing.kind)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse struct or class declaration
   */
  parseClassOrStruct() {
    const kindToken = this.next(); // 'struct', 'class', 'enum'
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

    // Enter class/struct scope if '{' follows
    if (this.peek() && this.peek().value === '{') {
      this.next();
      const structScope = this.enterScope(`${kindToken.value}: ${name}`, kindToken.line);
      this.structScopeIds.add(structScope.id);
    }
  }

  /**
   * Parse typedef
   */
  parseTypedef() {
    const typedefToken = this.next(); // 'typedef'
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

      // Record references for any identifiers used in the original type
      // e.g. "typedef struct Point Point2D" → reference to "Point"
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

  /**
   * Parse variable or function declarations
   */
  parseDeclaration() {
    let storageClass = 'auto';
    let isConst = false;
    const typeParts = [];

    // Collect qualifiers & types
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
        // In JS/TS, or with let/var/const, or if not followed by another identifier/pointer, this token is the identifier, not a type!
        const nextT = this.peek(1);
        const isFollowedById = nextT && (nextT.type === 'IDENTIFIER' || nextT.value === '*' || nextT.value === '&');
        const isJs = this.language === 'javascript' || this.language === 'js';
        if (isJs || ['let', 'var'].includes(storageClass) || !isFollowedById) {
          break;
        }
        // User defined type name — record it as a reference so it doesn't appear unused
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

    // Now expect identifier name
    const idToken = this.peek();
    if (!idToken || idToken.type !== 'IDENTIFIER') {
      if (idToken) this.next();
      return;
    }

    const name = idToken.value;
    const idLine = idToken.line;
    const idCol = idToken.col;
    this.next();

    // Check if pointer suffix e.g. int *ptr
    let fullType = typeStr;

    // Check if array e.g. int arr[10]
    if (this.peek() && this.peek().value === '[') {
      let arrayDims = '';
      while (this.peek() && (this.peek().value === '[' || this.peek().type === 'NUMBER' || this.peek().type === 'IDENTIFIER' || this.peek().value === ']')) {
        arrayDims += this.next().value;
        if (arrayDims.endsWith(']')) break;
      }
      fullType = `${fullType}${arrayDims}`;
    }

    // Check if FUNCTION: name followed by '('
    if (this.peek() && this.peek().value === '(') {
      this.next(); // eat '('

      // Function symbol
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

      // Create function scope
      const fnScope = this.enterScope(`Function: ${name}()`, idLine);

      // Parse parameters inside '(' ... ')'
      this.parseParameters();

      // Check if function declaration with body '{' or prototype ';'
      if (this.peek() && this.peek().value === '{') {
        this.next(); // eat '{'
        // body starts
      } else if (this.peek() && this.peek().value === ';') {
        this.next(); // eat ';'
        this.exitScope(idLine);
      }
      return;
    }

    // Otherwise, it is a VARIABLE or CONSTANT
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

    // Check for multiple declarators: e.g. int a = 5, b = 10, c;
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
        this.next(); // eat ','
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

  /**
   * Parse function parameters: (int a, double b, char* c)
   */
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
          // Could be param type or param name
          const peekAhead = this.peek(1);
          if (peekAhead && (peekAhead.value === ',' || peekAhead.value === ')')) {
            // It's the parameter name!
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
            // User-defined type used as parameter type — record reference
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

  /**
   * Parse control flow constructs: for, while, if
   */
  parseControlFlow() {
    const kwToken = this.next(); // 'for', 'while', 'if'
    // Look for ( ... ) condition
    if (this.peek() && this.peek().value === '(') {
      this.next();
      let depth = 1;
      while (this.tokenIndex < this.tokens.length && depth > 0) {
        const t = this.peek();
        if (!t) break;
        if (t.value === '(') depth++;
        if (t.value === ')') depth--;

        // Inside for loop header e.g. for (int i = 0; ...)
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

  /**
   * Parser for Python (def, class, variable assignment)
   */
  parsePython() {
    let currentIndent = 0;
    while (this.tokenIndex < this.tokens.length) {
      const token = this.peek();
      if (!token) break;

      if (token.type === 'COMMENT') {
        this.next();
        continue;
      }

      // Python function: def foo(a, b):
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
          // Parse params inside ( ... )
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

      // Python class: class Foo:
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

      // Python assignment: x = 10
      if (token.type === 'IDENTIFIER') {
        const nextTok = this.peek(1);
        if (nextTok && ['=', '+=', '-=', '*=', '/='].includes(nextTok.value)) {
          // If not declared yet in current scope, add symbol
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
    // Check if preceded by '.' or '->' (member field access, not bare scope variable!)
    const idx = this.tokens.indexOf(token);
    if (idx > 0) {
      const prev = this.tokens[idx - 1];
      if (prev && (prev.value === '.' || prev.value === '->')) {
        return; // Member property access
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
      // Find matching scope from id
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
        // Undeclared identifier error (skip common standard libraries like printf, cout, console, etc.)
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

module.exports = {
  SymbolTableGenerator,
  analyzeSourceCode
};
