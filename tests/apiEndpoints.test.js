const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const { app } = require('../server/index');

/**
 * Lightweight in-memory HTTP caller for Express (no socket needed)
 */
function dispatch(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = Readable.from(payload ? [Buffer.from(payload)] : []);
    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload)
    };
    req.socket = { remoteAddress: '127.0.0.1' };

    const res = new EventEmitter();
    let resBody = '';
    res.statusCode = 200;
    res._headers = {};

    res.setHeader = (k, v) => { res._headers[k] = v; };
    res.getHeader = (k) => res._headers[k];
    res.writeHead = (code) => { res.statusCode = code; };
    res.status = function(code) { this.statusCode = code; return this; };
    res.json = function(data) {
      resolve({ status: this.statusCode, body: data });
    };
    res.send = function(data) {
      if (typeof data === 'object') {
        resolve({ status: this.statusCode, body: data });
      } else {
        resolve({ status: this.statusCode, text: data });
      }
    };
    res.end = function(chunk) {
      if (chunk) resBody += chunk;
      try {
        resolve({ status: this.statusCode, body: JSON.parse(resBody) });
      } catch {
        resolve({ status: this.statusCode, text: resBody });
      }
    };

    app.handle(req, res);
  });
}

describe('REST API Endpoints Regression Tests', () => {

  it('POST /api/analyze should parse code and return symbol table', async () => {
    const res = await dispatch('POST', '/api/analyze', {
      code: 'int delta = 5;\nvoid run() { int sum = delta + 1; }',
      language: 'c'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.analysis.symbols));
    assert.strictEqual(res.body.analysis.symbols.length, 3);
    assert.ok(res.body.analysis.scopes.length >= 2);
    assert.ok(Array.isArray(res.body.analysis.hashTable));
    assert.strictEqual(res.body.analysis.hashTable.length, 16);
  });

  it('POST /api/analyze should return 400 if code parameter is missing', async () => {
    const res = await dispatch('POST', '/api/analyze', {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Source code string is required');
  });

  it('POST /api/analyze should return 400 if code parameter is not a string', async () => {
    const res = await dispatch('POST', '/api/analyze', { code: 12345 });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Source code string is required');
  });

  it('POST /api/analyze should handle complex multi-scope code with semantic diagnostics', async () => {
    const code = `
      int a = 10;
      int a = 20; // redeclaration error
      void test() {
        int a = 30; // shadowing warning
        undeclaredVar = 40; // undeclared error
      }
    `;
    const res = await dispatch('POST', '/api/analyze', { code, language: 'c' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.analysis.diagnostics.length >= 2);
    const hasRedecl = res.body.analysis.diagnostics.some(d => d.message.includes('Redeclaration'));
    const hasShadow = res.body.analysis.diagnostics.some(d => d.message.includes('shadows'));
    const hasUndecl = res.body.analysis.diagnostics.some(d => d.message.includes('undeclared'));
    assert.ok(hasRedecl, 'should have redeclaration diagnostic');
    assert.ok(hasShadow, 'should have shadow diagnostic');
    assert.ok(hasUndecl, 'should have undeclared diagnostic');
  });

});
