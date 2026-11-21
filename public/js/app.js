/**
 * Main Application Controller
 * Orchestrates Monaco Editor, Compiler API, Visualizer, and Multi-Format Exports.
 */

class Application {
  constructor() {
    this.editorManager = null;
    this.visualizer = null;
    this.currentLanguage = 'c';
    this.currentAnalysis = null;
    this.isAnalyzing = false;
  }

  async init() {
    // 1. Initialize Monaco Editor
    this.editorManager = new EditorManager('monaco-editor-container', {
      language: this.currentLanguage,
      onChange: (code) => this.runAnalysis(code),
      onCursor: (line, col) => this.updateCursorStatus(line, col)
    });

    // Initial code sample
    const initialCode = CODE_SAMPLES.c_comprehensive.code;
    await this.editorManager.init(initialCode);

    // 2. Initialize Visualizer
    this.visualizer = new Visualizer(this.editorManager);

    // 3. Setup UI Event Listeners
    this.setupListeners();
    this.setupSplitPanes();

    // 4. Run initial analysis
    await this.runAnalysis(initialCode);
  }

  setupListeners() {
    // Generate Button
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
      btnGenerate.addEventListener('click', () => {
        const code = this.editorManager.getValue();
        this.runAnalysis(code);
      });
    }

    // Export Modal Button
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.openExportModal());
    }

    // Language Selector
    const langSelect = document.getElementById('select-language');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        this.currentLanguage = e.target.value;
        this.editorManager.setLanguage(this.currentLanguage);
        this.runAnalysis(this.editorManager.getValue());
      });
    }

    // Sample Presets Selector
    const sampleSelect = document.getElementById('select-samples');
    if (sampleSelect) {
      sampleSelect.addEventListener('change', (e) => {
        const sampleKey = e.target.value;
        if (CODE_SAMPLES[sampleKey]) {
          const sample = CODE_SAMPLES[sampleKey];
          this.editorManager.setValue(sample.code);
          this.currentLanguage = sample.language;
          if (langSelect) langSelect.value = sample.language;
          this.editorManager.setLanguage(sample.language);
          this.runAnalysis(sample.code);
        }
      });
    }

    // Search input in Symbol Table
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.visualizer.setSearchQuery(e.target.value);
      });
    }

    // Filter Chips in Symbol Table
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        this.visualizer.setFilterKind(filter);
      });
    });

    // View Tabs (Table, Scope Tree, Hash Buckets, Memory Layout)
    const tabBtns = document.querySelectorAll('.view-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Diagnostics toggle panel
    const btnToggleDiag = document.getElementById('btn-toggle-diagnostics');
    const diagDrawer = document.getElementById('diagnostics-drawer');
    if (btnToggleDiag && diagDrawer) {
      btnToggleDiag.addEventListener('click', () => {
        diagDrawer.classList.toggle('collapsed');
      });
    }

    // Format Code Button
    const btnFormat = document.getElementById('btn-format-code');
    if (btnFormat) {
      btnFormat.addEventListener('click', () => this.editorManager.formatCode());
    }

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.runAnalysis(this.editorManager.getValue());
      }
    });

    // Modal Close buttons
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
        }
      });
    });

    // Export Options in Modal
    this.setupExportActions();

    // Mobile / Responsive Workspace View Switcher
    const btnShowEditor = document.getElementById('btn-show-editor');
    const btnShowVisualizer = document.getElementById('btn-show-visualizer');
    const workspace = document.getElementById('workspace');

    if (btnShowEditor && btnShowVisualizer && workspace) {
      btnShowEditor.addEventListener('click', () => {
        btnShowEditor.classList.add('active');
        btnShowVisualizer.classList.remove('active');
        workspace.classList.remove('show-visualizer');
        workspace.classList.add('show-editor');
        if (this.editorManager?.editor) {
          setTimeout(() => this.editorManager.editor.layout(), 60);
        }
      });

      btnShowVisualizer.addEventListener('click', () => {
        btnShowVisualizer.classList.add('active');
        btnShowEditor.classList.remove('active');
        workspace.classList.remove('show-editor');
        workspace.classList.add('show-visualizer');
      });
    }

    // Auto resize Monaco on window dimension change
    window.addEventListener('resize', () => {
      if (this.editorManager?.editor) {
        this.editorManager.editor.layout();
      }
    });
  }

  setupSplitPanes() {
    const divider = document.getElementById('pane-divider');
    const leftPane = document.getElementById('left-editor-pane');
    const rightPane = document.getElementById('right-visualizer-pane');
    if (!divider || !leftPane || !rightPane) return;

    let isDragging = false;

    divider.addEventListener('mousedown', () => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerRect = divider.parentElement.getBoundingClientRect();
      const offset = e.clientX - containerRect.left;
      const percentage = (offset / containerRect.width) * 100;

      if (percentage > 20 && percentage < 80) {
        leftPane.style.flex = `0 0 ${percentage}%`;
        rightPane.style.flex = `0 0 ${100 - percentage}%`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  async runAnalysis(code) {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const statusEl = document.getElementById('status-msg');
    if (statusEl) statusEl.textContent = 'Parsing & generating symbol table...';

    try {
      let analysis = null;

      // 1. Client-side compilation engine (Instant, works offline, works on Live Server, file://, and GitHub Pages)
      if (typeof window.analyzeSourceCode === 'function') {
        analysis = window.analyzeSourceCode(code, this.currentLanguage);
      } else {
        // 2. Fallback to Express backend if client script is absent
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            language: this.currentLanguage
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          throw new Error(`API returned HTTP ${response.status} (${contentType || 'non-JSON'})`);
        }

        const res = await response.json();
        if (res.success) {
          analysis = res.analysis;
        } else {
          throw new Error(res.error || 'Analysis failed');
        }
      }

      if (analysis) {
        this.currentAnalysis = analysis;

        // Update Monaco squiggles/markers
        this.editorManager.setDiagnostics(analysis.diagnostics);

        // Update Visualizer
        this.visualizer.updateData(analysis);

        // Populate scope filter dropdown
        this.updateScopeFilterDropdown(analysis.scopes);

        if (statusEl) {
          const count = analysis.symbols.length;
          const scopes = analysis.scopes.length;
          statusEl.textContent = `Generated: ${count} symbols across ${scopes} scopes.`;
        }
      }
    } catch (err) {
      console.warn('Backend fetch failed, attempting client-side fallback:', err);
      if (typeof window.analyzeSourceCode === 'function') {
        try {
          const analysis = window.analyzeSourceCode(code, this.currentLanguage);
          this.currentAnalysis = analysis;
          this.editorManager.setDiagnostics(analysis.diagnostics);
          this.visualizer.updateData(analysis);
          this.updateScopeFilterDropdown(analysis.scopes);
          if (statusEl) {
            statusEl.textContent = `Generated: ${analysis.symbols.length} symbols across ${analysis.scopes.length} scopes.`;
          }
          return;
        } catch (clientErr) {
          console.error('Client fallback error:', clientErr);
        }
      }
      if (statusEl) statusEl.textContent = `Analysis notice: ${err.message}`;
    } finally {
      this.isAnalyzing = false;
    }
  }

  updateScopeFilterDropdown(scopes) {
    const select = document.getElementById('filter-scope-select');
    if (!select) return;

    select.innerHTML = '<option value="ALL">All Scopes</option>' +
      scopes.map(sc => `<option value="${sc.id}">L${sc.level}: ${sc.name}</option>`).join('');

    select.onchange = (e) => {
      this.visualizer.setScopeFilter(e.target.value);
    };
  }

  openExportModal() {
    const modal = document.getElementById('modal-export');
    if (modal) modal.classList.add('open');
  }

  setupExportActions() {
    const btnJson = document.getElementById('btn-export-json');
    const btnCsv = document.getElementById('btn-export-csv');
    const btnMd = document.getElementById('btn-export-md');
    const btnTex = document.getElementById('btn-export-tex');

    if (btnJson) {
      btnJson.addEventListener('click', () => {
        if (!this.currentAnalysis) return;
        const json = TableExporter.toJson(
          this.currentAnalysis.symbols,
          this.currentAnalysis.scopes,
          this.currentAnalysis.diagnostics,
          { language: this.currentLanguage }
        );
        TableExporter.downloadFile('symbol_table.json', json, 'application/json');
      });
    }

    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        if (!this.currentAnalysis) return;
        const csv = TableExporter.toCsv(this.currentAnalysis.symbols);
        TableExporter.downloadFile('symbol_table.csv', csv, 'text/csv');
      });
    }

    if (btnMd) {
      btnMd.addEventListener('click', () => {
        if (!this.currentAnalysis) return;
        const md = TableExporter.toMarkdown(this.currentAnalysis.symbols);
        TableExporter.downloadFile('symbol_table.md', md, 'text/markdown');
      });
    }

    if (btnTex) {
      btnTex.addEventListener('click', () => {
        if (!this.currentAnalysis) return;
        const tex = TableExporter.toLatex(this.currentAnalysis.symbols);
        TableExporter.downloadFile('symbol_table.tex', tex, 'application/x-tex');
      });
    }
  }

  onSymbolRowClick(line, col) {
    if (window.innerWidth <= 860) {
      const btnShowEditor = document.getElementById('btn-show-editor');
      const btnShowVisualizer = document.getElementById('btn-show-visualizer');
      const workspace = document.getElementById('workspace');
      if (btnShowEditor && btnShowVisualizer && workspace) {
        btnShowEditor.classList.add('active');
        btnShowVisualizer.classList.remove('active');
        workspace.classList.remove('show-visualizer');
        workspace.classList.add('show-editor');
      }
    }
    if (this.editorManager) {
      this.editorManager.jumpTo(line, col);
    }
  }

  onScopeClick(scopeId, startLine, endLine) {
    if (window.innerWidth <= 860) {
      const btnShowEditor = document.getElementById('btn-show-editor');
      const btnShowVisualizer = document.getElementById('btn-show-visualizer');
      const workspace = document.getElementById('workspace');
      if (btnShowEditor && btnShowVisualizer && workspace) {
        btnShowEditor.classList.add('active');
        btnShowVisualizer.classList.remove('active');
        workspace.classList.remove('show-visualizer');
        workspace.classList.add('show-editor');
      }
    }
    if (this.editorManager) {
      this.editorManager.highlightScope(startLine, endLine);
    }
  }

  updateCursorStatus(line, col) {
    const el = document.getElementById('cursor-pos');
    if (el) el.textContent = `Ln ${line}, Col ${col}`;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Instantiate and expose globally
window.addEventListener('DOMContentLoaded', () => {
  window.app = new Application();
  window.app.init();
});
