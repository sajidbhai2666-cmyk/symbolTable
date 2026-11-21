const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tokenize } = require('../server/compiler/tokenizer');
const { calculateTypeSize, assignMemoryLayout, buildCompilerHashTable } = require('../server/compiler/memoryLayout');
const { SymbolTableGenerator, analyzeSourceCode } = require('../server/compiler/symbolTable');

describe('Compiler Core Regression Tests', () => {

  describe('1. Lexer & Tokenizer', () => {
    it('should tokenize keywords, types, identifiers, numbers, and operators', () => {
      const code = 'const int maxItems = 100;\nfloat ratio = 3.14;';
      const tokens = tokenize(code, 'c');
      
      const constTok = tokens.find(t => t.value === 'const');
      const intTok = tokens.find(t => t.value === 'int');
      const idTok = tokens.find(t => t.value === 'maxItems');
      const numTok = tokens.find(t => t.value === '100');

      assert.ok(constTok, 'const token should exist');
      assert.strictEqual(constTok.type, 'STORAGE');
      assert.ok(intTok, 'int token should exist');
      assert.strictEqual(intTok.type, 'TYPE');
      assert.ok(idTok, 'maxItems token should exist');
      assert.strictEqual(idTok.type, 'IDENTIFIER');
      assert.ok(numTok, '100 token should exist');
      assert.strictEqual(numTok.type, 'NUMBER');
    });

    it('should handle multi-character operators correctly', () => {
      const code = 'a += 5; b == c; d->field; x++; y <<= 2;';
      const tokens = tokenize(code, 'c');
      const opValues = tokens.filter(t => t.type === 'OPERATOR').map(t => t.value);

      assert.ok(opValues.includes('+='), '+= operator tokenized');
      assert.ok(opValues.includes('=='), '== operator tokenized');
      assert.ok(opValues.includes('->'), '-> operator tokenized');
      assert.ok(opValues.includes('++'), '++ operator tokenized');
      assert.ok(opValues.includes('<<='), '<<= operator tokenized');
    });

    it('should correctly ignore single-line and multi-line comments', () => {
      const code = `
        // Single line comment
        int a = 1;
        /* Multi-line comment
           spanning lines */
        int b = 2;
      `;
      const tokens = tokenize(code, 'c');
      const identifiers = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
      assert.deepStrictEqual(identifiers, ['a', 'b']);
    });

    it('should handle string literals with escape sequences', () => {
      const code = 'char* str = "Hello \\"World\\"\\n";';
      const tokens = tokenize(code, 'c');
      const strToken = tokens.find(t => t.type === 'STRING');
      assert.ok(strToken);
      assert.strictEqual(strToken.value, '"Hello \\"World\\"\\n"');
    });
  });

  describe('2. Memory Sizing & Alignment', () => {
    it('should accurately calculate primitive type sizes', () => {
      assert.strictEqual(calculateTypeSize('char'), 1);
      assert.strictEqual(calculateTypeSize('short'), 2);
      assert.strictEqual(calculateTypeSize('int'), 4);
      assert.strictEqual(calculateTypeSize('float'), 4);
      assert.strictEqual(calculateTypeSize('double'), 8);
      assert.strictEqual(calculateTypeSize('long long'), 8);
      assert.strictEqual(calculateTypeSize('int*'), 8, 'Pointers must be 8 bytes on 64-bit target');
      assert.strictEqual(calculateTypeSize('char*'), 8, 'Char pointer must be 8 bytes');
    });

    it('should calculate array memory sizes accurately', () => {
      assert.strictEqual(calculateTypeSize('int[10]'), 40);
      assert.strictEqual(calculateTypeSize('double[5]'), 40);
      assert.strictEqual(calculateTypeSize('char[64]'), 64);
    });

    it('should assign correct data segment and stack frame offsets', () => {
      const symbols = [
        { name: 'global1', kind: 'variable', type: 'int', scopeLevel: 0, scopeId: 'scope_0' },
        { name: 'global2', kind: 'variable', type: 'double', scopeLevel: 0, scopeId: 'scope_0' },
        { name: 'paramA', kind: 'parameter', type: 'int', scopeLevel: 1, scopeId: 'scope_1' },
        { name: 'local1', kind: 'variable', type: 'int', scopeLevel: 1, scopeId: 'scope_1' },
        { name: 'local2', kind: 'variable', type: 'int', scopeLevel: 1, scopeId: 'scope_1' }
      ];

      assignMemoryLayout(symbols, []);

      // Globals in .data/.bss
      assert.strictEqual(symbols[0].offset, '+0x0000 (.data/.bss)');
      assert.strictEqual(symbols[0].offsetBytes, 0);
      assert.strictEqual(symbols[1].offset, '+0x0004 (.data/.bss)');
      assert.strictEqual(symbols[1].offsetBytes, 4);

      // Parameter in register RDI
      assert.ok(symbols[2].offset.includes('RDI'), 'First parameter should use RDI register');

      // Local variables on stack
      assert.strictEqual(symbols[3].offset, '[rbp - 4]');
      assert.strictEqual(symbols[3].offsetBytes, -4);
      assert.strictEqual(symbols[4].offset, '[rbp - 8]');
      assert.strictEqual(symbols[4].offsetBytes, -8);
    });
  });

  describe('3. Compiler Hash Table Simulation', () => {
    it('should deterministically distribute symbols into 16 buckets', () => {
      const symbols = [
        { name: 'alpha', kind: 'variable', type: 'int', scopeName: 'Global', line: 1, col: 1 },
        { name: 'beta', kind: 'variable', type: 'int', scopeName: 'Global', line: 2, col: 1 },
        { name: 'gamma', kind: 'variable', type: 'int', scopeName: 'Global', line: 3, col: 1 },
        { name: 'delta', kind: 'variable', type: 'int', scopeName: 'Global', line: 4, col: 1 }
      ];

      const buckets = buildCompilerHashTable(symbols, 16);
      assert.strictEqual(buckets.length, 16);

      const totalEntriesInBuckets = buckets.reduce((acc, b) => acc + b.entries.length, 0);
      assert.strictEqual(totalEntriesInBuckets, 4);

      for (const b of buckets) {
        for (const e of b.entries) {
          assert.ok(e.symbolName);
          assert.ok(e.hashCode.startsWith('0x'));
        }
      }
    });
  });

});
