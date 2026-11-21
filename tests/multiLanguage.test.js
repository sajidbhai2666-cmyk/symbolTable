const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSourceCode } = require('../server/compiler/symbolTable');

describe('Multi-Language Parsing Regression Tests', () => {

  describe('C / C++ Syntax', () => {
    it('should parse C structs and typedefs', () => {
      const code = `
        struct Vector3 {
          float x;
          float y;
          float z;
        };
        typedef struct Vector3 Vec3;
        Vec3 myVec;
      `;
      const res = analyzeSourceCode(code, 'c');
      const structSym = res.symbols.find(s => s.name === 'Vector3');
      const typedefSym = res.symbols.find(s => s.name === 'Vec3');
      const varSym = res.symbols.find(s => s.name === 'myVec');

      assert.ok(structSym, 'Struct symbol Vector3 should be recognized');
      assert.strictEqual(structSym.kind, 'struct');
      assert.ok(typedefSym, 'Typedef symbol Vec3 should be recognized');
      assert.strictEqual(typedefSym.kind, 'typedef');
      assert.ok(varSym, 'Variable myVec of type Vec3 should be recognized');
    });

    it('should parse C++ class with methods and fields', () => {
      const code = `
        class Account {
        private:
          double balance;
        public:
          void deposit(double amount) {
            balance += amount;
          }
        };
      `;
      const res = analyzeSourceCode(code, 'cpp');
      const classSym = res.symbols.find(s => s.name === 'Account');
      const methodSym = res.symbols.find(s => s.name === 'deposit');
      const paramSym = res.symbols.find(s => s.name === 'amount');

      assert.ok(classSym, 'Class Account should be recognized');
      assert.strictEqual(classSym.kind, 'class');
      assert.ok(methodSym, 'Method deposit should be recognized');
      assert.strictEqual(methodSym.kind, 'function');
      assert.ok(paramSym, 'Parameter amount should be recognized');
      assert.strictEqual(paramSym.kind, 'parameter');
    });
  });

  describe('JavaScript Syntax', () => {
    it('should parse JS const, let, var, and functions', () => {
      const code = `
        const API_KEY = "xyz123";
        let counter = 0;
        function update(delta) {
          let step = delta * 2;
          return counter + step;
        }
      `;
      const res = analyzeSourceCode(code, 'javascript');
      const constSym = res.symbols.find(s => s.name === 'API_KEY');
      const letSym = res.symbols.find(s => s.name === 'counter');
      const fnSym = res.symbols.find(s => s.name === 'update');
      const paramSym = res.symbols.find(s => s.name === 'delta');

      assert.ok(constSym, 'const API_KEY should be recognized');
      assert.strictEqual(constSym.isConstant, true);
      assert.ok(letSym, 'let counter should be recognized');
      assert.ok(fnSym, 'function update should be recognized');
      assert.strictEqual(fnSym.kind, 'function');
      assert.ok(paramSym, 'parameter delta should be recognized');
    });
  });

  describe('Python Syntax', () => {
    it('should parse Python functions, classes, parameters, and assignments', () => {
      const code = `
# Python symbol table test
global_flag = True

class ModelEvaluator:
    def evaluate(dataset, threshold):
        score = 95
        return score
      `;
      const res = analyzeSourceCode(code, 'python');
      const globSym = res.symbols.find(s => s.name === 'global_flag');
      const classSym = res.symbols.find(s => s.name === 'ModelEvaluator');
      const fnSym = res.symbols.find(s => s.name === 'evaluate');
      const p1 = res.symbols.find(s => s.name === 'dataset');
      const p2 = res.symbols.find(s => s.name === 'threshold');
      const localSym = res.symbols.find(s => s.name === 'score');

      assert.ok(globSym, 'global_flag should be recognized');
      assert.ok(classSym, 'Class ModelEvaluator should be recognized');
      assert.strictEqual(classSym.kind, 'class');
      assert.ok(fnSym, 'def evaluate should be recognized');
      assert.strictEqual(fnSym.kind, 'function');
      assert.ok(p1, 'dataset parameter recognized');
      assert.ok(p2, 'threshold parameter recognized');
      assert.ok(localSym, 'score variable recognized');
    });
  });

});
