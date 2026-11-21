const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { TableExporter } = require('../public/js/export');

describe('Multi-Format Export Regression Tests', () => {

  const sampleSymbols = [
    {
      name: 'counter',
      kind: 'variable',
      type: 'int',
      scopeId: 'scope_0',
      scopeName: 'Global Scope',
      scopeLevel: 0,
      offset: '+0x0000',
      offsetBytes: 0,
      size: 4,
      line: 1,
      col: 5,
      references: [{ line: 5, col: 10 }]
    },
    {
      name: 'processData',
      kind: 'function',
      type: 'void (Function)',
      scopeId: 'scope_0',
      scopeName: 'Global Scope',
      scopeLevel: 0,
      offset: 'TEXT_SEGMENT',
      offsetBytes: 0,
      size: 8,
      line: 3,
      col: 6,
      references: []
    }
  ];

  const sampleScopes = [
    { id: 'scope_0', name: 'Global Scope', level: 0, parentId: null, startLine: 1, endLine: 20 }
  ];

  const sampleDiagnostics = [
    { severity: 'warning', message: 'Test warning', line: 1, col: 5 }
  ];

  it('should generate well-structured JSON parseable by JSON.parse', () => {
    const jsonStr = TableExporter.toJson(sampleSymbols, sampleScopes, sampleDiagnostics, { title: 'JSON Test', language: 'c' });
    const parsed = JSON.parse(jsonStr);
    assert.strictEqual(parsed.metadata.totalSymbols, 2);
    assert.strictEqual(parsed.symbols.length, 2);
    assert.strictEqual(parsed.scopes.length, 1);
    assert.strictEqual(parsed.diagnostics.length, 1);
  });

  it('should generate CSV with correct column headers and records', () => {
    const csv = TableExporter.toCsv(sampleSymbols);
    const lines = csv.trim().split('\n');
    assert.strictEqual(lines.length, 3); // 1 header + 2 rows
    assert.ok(lines[0].includes('Name,Kind,Type,Scope_Level'));
    assert.ok(lines[1].includes('"counter","variable","int"'));
    assert.ok(lines[2].includes('"processData","function"'));
  });

  it('should generate valid GitHub Flavored Markdown table', () => {
    const md = TableExporter.toMarkdown(sampleSymbols);
    assert.ok(md.includes('# Symbol Table Report'));
    assert.ok(md.includes('| # | Identifier | Kind | Data Type | Scope | Offset | Size | Line:Col | References | Status |'));
    assert.ok(md.includes('`counter`'));
    assert.ok(md.includes('`processData`'));
  });

  it('should generate valid LaTeX booktabs table syntax', () => {
    const tex = TableExporter.toLatex(sampleSymbols);
    assert.ok(tex.includes('\\begin{table}'));
    assert.ok(tex.includes('\\begin{tabular}'));
    assert.ok(tex.includes('\\texttt{counter}'));
    assert.ok(tex.includes('\\texttt{processData}'));
    assert.ok(tex.includes('\\end{tabular}'));
    assert.ok(tex.includes('\\end{table}'));
  });

});
