/**
 * Symbol Table Exporter
 * Generates JSON, CSV, Markdown, and LaTeX tables.
 */

class TableExporter {
  static downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static toJson(symbols, scopes, diagnostics, metadata = {}) {
    return JSON.stringify({
      metadata: {
        title: metadata.title || 'Symbol Table Analysis',
        language: metadata.language || 'c',
        timestamp: new Date().toISOString(),
        totalSymbols: symbols.length,
        totalScopes: scopes.length,
        diagnosticsCount: diagnostics.length
      },
      scopes,
      symbols,
      diagnostics
    }, null, 2);
  }

  static toCsv(symbols) {
    const headers = ['Index', 'Name', 'Kind', 'Type', 'Scope_Level', 'Scope_Name', 'Memory_Offset', 'Size_Bytes', 'Line', 'Col', 'References_Count', 'Status'];
    const rows = symbols.map((s, idx) => {
      let status = 'Valid';
      if (s.isRedeclaration) status = 'Duplicate';
      else if (s.isShadowed) status = 'Shadowed';
      else if (s.isUnused) status = 'Unused';

      return [
        idx + 1,
        `"${s.name}"`,
        `"${s.kind}"`,
        `"${s.type}"`,
        s.scopeLevel,
        `"${s.scopeName}"`,
        `"${s.offset || 'N/A'}"`,
        s.size || 0,
        s.line,
        s.col,
        s.references ? s.references.length : 0,
        `"${status}"`
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  static toMarkdown(symbols) {
    let md = `# Symbol Table Report\n\n`;
    md += `| # | Identifier | Kind | Data Type | Scope | Offset | Size | Line:Col | References | Status |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|\n`;

    symbols.forEach((s, i) => {
      let status = 'Valid';
      if (s.isRedeclaration) status = 'Duplicate';
      else if (s.isShadowed) status = 'Shadowed';
      else if (s.isUnused) status = 'Unused';

      md += `| ${i + 1} | \`${s.name}\` | ${s.kind} | \`${s.type}\` | L${s.scopeLevel}: ${s.scopeName} | \`${s.offset || 'N/A'}\` | ${s.size || '-'} | L${s.line}:${s.col} | ${s.references ? s.references.length : 0} | ${status} |\n`;
    });

    return md;
  }

  static toLatex(symbols) {
    let tex = `% Symbol Table LaTeX export\n`;
    tex += `\\begin{table}[h!]\n\\centering\n`;
    tex += `\\begin{tabular}{rllllcr}\n\\toprule\n`;
    tex += `\\textbf{\\#} & \\textbf{Identifier} & \\textbf{Kind} & \\textbf{Type} & \\textbf{Scope} & \\textbf{Offset} & \\textbf{Line} \\\\\n\\midrule\n`;

    symbols.forEach((s, i) => {
      const cleanName = s.name.replace(/_/g, '\\_');
      const cleanType = (s.type || '').replace(/_/g, '\\_').replace(/\*/g, '$\\ast$');
      const cleanScope = s.scopeName.replace(/_/g, '\\_');
      const cleanOffset = (s.offset || 'N/A').replace(/_/g, '\\_').replace(/\[/g, '$[').replace(/\]/g, '$]');
      tex += `${i + 1} & \\texttt{${cleanName}} & ${s.kind} & \\texttt{${cleanType}} & L${s.scopeLevel} & ${cleanOffset} & ${s.line} \\\\\n`;
    });

    tex += `\\bottomrule\n\\end{tabular}\n`;
    tex += `\\caption{Generated Compiler Symbol Table}\n\\label{tab:symbol_table}\n\\end{table}\n`;
    return tex;
  }
}

if (typeof window !== 'undefined') {
  window.TableExporter = TableExporter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TableExporter };
}
