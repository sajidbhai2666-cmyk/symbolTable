const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSourceCode } = require('../server/compiler/symbolTable');

describe('Semantic Diagnostics & Scope Hierarchy Regression Tests', () => {

  it('should detect duplicate declaration in the same scope (Semantic Error)', () => {
    const code = `
      int count = 10;
      int count = 20;
    `;
    const result = analyzeSourceCode(code, 'c');
    const redecl = result.symbols.find(s => s.name === 'count' && s.isRedeclaration);
    assert.ok(redecl, 'Second declaration should be marked as redeclaration');

    const err = result.diagnostics.find(d => d.severity === 'error' && d.message.includes("Redeclaration of 'count'"));
    assert.ok(err, 'Should produce a semantic error diagnostic');
  });

  it('should detect variable shadowing in nested scopes (Semantic Warning)', () => {
    const code = `
      int x = 100;
      void test() {
        int x = 50;
      }
    `;
    const result = analyzeSourceCode(code, 'c');
    const shadowedSym = result.symbols.find(s => s.name === 'x' && s.isShadowed);
    assert.ok(shadowedSym, 'Inner variable x should be marked shadowed');

    const warn = result.diagnostics.find(d => d.severity === 'warning' && d.message.includes("shadows outer declaration"));
    assert.ok(warn, 'Should produce a variable shadowing warning');
  });

  it('should detect use of undeclared identifier (Semantic Error)', () => {
    const code = `
      void run() {
        int a = 1;
        missingVar = a + 5;
      }
    `;
    const result = analyzeSourceCode(code, 'c');
    const err = result.diagnostics.find(d => d.severity === 'error' && d.message.includes("Use of undeclared identifier 'missingVar'"));
    assert.ok(err, 'Should flag undeclared identifier usage');
  });

  it('should NOT flag standard builtins (e.g. printf, malloc, console) as undeclared', () => {
    const code = `
      void run() {
        int a = 1;
        printf("Value: %d", a);
      }
    `;
    const result = analyzeSourceCode(code, 'c');
    const err = result.diagnostics.find(d => d.message.includes('printf'));
    assert.strictEqual(err, undefined, 'Standard library function printf must not be flagged as undeclared');
  });

  it('should flag declared but unused identifiers as unused notices', () => {
    const code = `
      int unusedGlobal = 42;
      void compute() {
        int unusedLocal = 10;
      }
    `;
    const result = analyzeSourceCode(code, 'c');
    const unusedG = result.symbols.find(s => s.name === 'unusedGlobal');
    const unusedL = result.symbols.find(s => s.name === 'unusedLocal');

    assert.ok(unusedG && unusedG.isUnused, 'unusedGlobal should be marked isUnused');
    assert.ok(unusedL && unusedL.isUnused, 'unusedLocal should be marked isUnused');
  });

  it('should correctly build hierarchical parent-child scopes across 3 levels', () => {
    const code = `
      int g = 0; // Level 0
      void func() { // Level 1
        int a = 1;
        { // Level 2
          int b = 2;
          for (int i = 0; i < 5; i++) { // Level 3
            int c = 3;
          }
        }
      }
    `;
    const result = analyzeSourceCode(code, 'c');
    const scopes = result.scopes;

    assert.ok(scopes.length >= 4, 'Should create at least 4 scopes (Global, Function, Block, For)');
    const root = scopes.find(s => s.level === 0);
    const fnScope = scopes.find(s => s.level === 1);
    const blockScope = scopes.find(s => s.level === 2);
    const loopScope = scopes.find(s => s.level === 3);

    assert.ok(root, 'Root scope level 0 exists');
    assert.ok(fnScope, 'Function scope level 1 exists');
    assert.ok(blockScope, 'Block scope level 2 exists');
    assert.ok(loopScope, 'Loop scope level 3 exists');
    assert.strictEqual(fnScope.parentId, root.id);
    assert.strictEqual(blockScope.parentId, fnScope.id);
  });

});
