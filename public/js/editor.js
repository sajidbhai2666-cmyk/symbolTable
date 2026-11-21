/**
 * Monaco Editor Manager
 * Manages Monaco editor instance, syntax themes, markers/squiggles, and bidirectional highlighting.
 */

class EditorManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.editor = null;
    this.monaco = null;
    this.currentLanguage = options.language || 'c';
    this.currentTheme = options.theme || 'vs-dark';
    this.currentDecorations = [];
    this.onChangeCallback = options.onChange || null;
    this.onCursorCallback = options.onCursor || null;
  }

  async init(initialCode = '') {
    return new Promise((resolve) => {
      if (window.monaco) {
        this.setupEditor(window.monaco, initialCode);
        return resolve(this);
      }

      // Check if require.js from Monaco loader is available
      if (typeof window.require !== 'undefined' && window.require.config) {
        window.require.config({
          paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
        });

        window.require(['vs/editor/editor.main'], (monaco) => {
          this.setupEditor(monaco, initialCode);
          resolve(this);
        });
      } else {
        // Fallback simple textarea editor if CDN fails
        console.warn('Monaco loader not found, using fallback editor');
        this.setupFallbackEditor(initialCode);
        resolve(this);
      }
    });
  }

  setupEditor(monaco, initialCode) {
    this.monaco = monaco;

    // Define custom compiler dark theme
    monaco.editor.defineTheme('compiler-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'operator', foreground: 'D4D4D4' }
      ],
      colors: {
        'editor.background': '#13161f',
        'editor.foreground': '#d4d4d4',
        'editorCursor.foreground': '#38bdf8',
        'editor.lineHighlightBackground': '#1e2433',
        'editorLineNumber.foreground': '#64748b',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editor.selectionBackground': '#264f78'
      }
    });

    this.editor = monaco.editor.create(this.container, {
      value: initialCode,
      language: this.mapLanguage(this.currentLanguage),
      theme: 'compiler-dark',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      minimap: { enabled: true, side: 'right' },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      bracketPairColorization: { enabled: true },
      wordWrap: 'on',
      tabSize: 4,
      smoothScrolling: true
    });

    // Event listener for content changes
    let debounceTimer = null;
    this.editor.onDidChangeModelContent(() => {
      if (this.onChangeCallback) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.onChangeCallback(this.getValue());
        }, 600);
      }
    });

    // Event listener for cursor movements
    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorCallback) {
        this.onCursorCallback(e.position.lineNumber, e.position.column);
      }
    });
  }

  setupFallbackEditor(initialCode) {
    this.container.innerHTML = `
      <textarea id="fallback-editor-textarea" style="
        width: 100%; height: 100%; background: #13161f; color: #d4d4d4;
        font-family: monospace; font-size: 14px; border: none; padding: 12px;
        box-sizing: border-box; resize: none; outline: none; line-height: 1.5;
      ">${initialCode}</textarea>
    `;
    const textarea = document.getElementById('fallback-editor-textarea');
    textarea.addEventListener('input', () => {
      if (this.onChangeCallback) {
        this.onChangeCallback(textarea.value);
      }
    });
  }

  mapLanguage(lang) {
    switch (lang.toLowerCase()) {
      case 'c': return 'c';
      case 'cpp':
      case 'c++': return 'cpp';
      case 'java': return 'java';
      case 'javascript':
      case 'js': return 'javascript';
      case 'python':
      case 'py': return 'python';
      default: return 'c';
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.editor && this.monaco) {
      const model = this.editor.getModel();
      if (model) {
        this.monaco.editor.setModelLanguage(model, this.mapLanguage(lang));
      }
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    if (this.monaco) {
      this.monaco.editor.setTheme(theme);
    }
  }

  getValue() {
    if (this.editor) {
      return this.editor.getValue();
    }
    const textarea = document.getElementById('fallback-editor-textarea');
    return textarea ? textarea.value : '';
  }

  setValue(code) {
    if (this.editor) {
      this.editor.setValue(code);
    } else {
      const textarea = document.getElementById('fallback-editor-textarea');
      if (textarea) textarea.value = code;
    }
  }

  /**
   * Jump to line and column, highlight token, and focus editor
   */
  jumpTo(line, col = 1, length = 1) {
    if (!this.editor || !this.monaco) {
      const textarea = document.getElementById('fallback-editor-textarea');
      if (textarea) textarea.focus();
      return;
    }

    this.editor.revealPositionInCenter({ lineNumber: line, column: col }, 0);
    this.editor.setPosition({ lineNumber: line, column: col });
    this.editor.focus();

    // Add temporary pulse highlight decoration
    this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, [
      {
        range: new this.monaco.Range(line, col, line, col + Math.max(length, 1)),
        options: {
          inlineClassName: 'monaco-token-highlight',
          isWholeLine: false,
          overviewRuler: {
            color: '#38bdf8',
            position: this.monaco.editor.OverviewRulerLane.Full
          }
        }
      },
      {
        range: new this.monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-line-highlight'
        }
      }
    ]);
  }

  /**
   * Highlight an entire scope block
   */
  highlightScope(startLine, endLine) {
    if (!this.editor || !this.monaco) return;
    const safeEndLine = Math.min(endLine || startLine, this.editor.getModel().getLineCount());

    this.editor.revealRangeInCenter({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: safeEndLine,
      endColumn: 100
    });

    this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, [
      {
        range: new this.monaco.Range(startLine, 1, safeEndLine, 100),
        options: {
          isWholeLine: true,
          className: 'monaco-scope-block-highlight'
        }
      }
    ]);
  }

  /**
   * Set compiler squiggles / markers directly in Monaco
   */
  setDiagnostics(diagnostics = []) {
    if (!this.editor || !this.monaco) return;
    const model = this.editor.getModel();
    if (!model) return;

    const markers = diagnostics.map(d => ({
      severity: d.severity === 'error'
        ? this.monaco.MarkerSeverity.Error
        : (d.severity === 'warning' ? this.monaco.MarkerSeverity.Warning : this.monaco.MarkerSeverity.Info),
      message: d.message,
      startLineNumber: d.line || 1,
      startColumn: d.col || 1,
      endLineNumber: d.line || 1,
      endColumn: (d.col || 1) + 15
    }));

    this.monaco.editor.setModelMarkers(model, 'symbol-table-compiler', markers);
  }

  formatCode() {
    if (this.editor) {
      this.editor.getAction('editor.action.formatDocument')?.run();
    }
  }
}

window.EditorManager = EditorManager;
