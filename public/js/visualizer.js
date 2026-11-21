/**
 * Symbol Table Multi-View Visualizer
 * Renders Tabular View, Scope Tree, Compiler Hash Buckets, and Memory Stack Frames.
 */

class Visualizer {
  constructor(editorManager) {
    this.editorManager = editorManager;
    this.symbols = [];
    this.scopes = [];
    this.diagnostics = [];
    this.hashTable = [];
    this.activeFilterKind = 'ALL';
    this.searchQuery = '';
    this.activeScopeFilter = 'ALL';
  }

  updateData(data) {
    this.symbols = data.symbols || [];
    this.scopes = data.scopes || [];
    this.diagnostics = data.diagnostics || [];
    this.hashTable = data.hashTable || [];

    this.renderDiagnostics();
    this.renderSymbolTable();
    this.renderScopeTree();
    this.renderHashTable();
    this.renderMemoryLayout();
    this.updateCounters();
  }

  updateCounters() {
    const symCountEl = document.getElementById('stat-total-symbols');
    const mobileCountEl = document.getElementById('mobile-stat-symbols');
    const scopeCountEl = document.getElementById('stat-total-scopes');
    const symCountFooter = document.getElementById('stat-total-symbols-footer');
    const scopeCountFooter = document.getElementById('stat-total-scopes-footer');
    const errCountEl = document.getElementById('stat-total-errors');
    const warnCountEl = document.getElementById('stat-total-warnings');

    const errors = this.diagnostics.filter(d => d.severity === 'error').length;
    const warnings = this.diagnostics.filter(d => d.severity === 'warning').length;

    if (symCountEl) symCountEl.textContent = this.symbols.length;
    if (mobileCountEl) mobileCountEl.textContent = this.symbols.length;
    if (scopeCountEl) scopeCountEl.textContent = this.scopes.length;
    if (symCountFooter) symCountFooter.textContent = this.symbols.length;
    if (scopeCountFooter) scopeCountFooter.textContent = this.scopes.length;
    if (errCountEl) {
      errCountEl.textContent = errors;
      errCountEl.className = errors > 0 ? 'badge badge-error' : 'badge badge-success';
    }
    if (warnCountEl) {
      warnCountEl.textContent = warnings;
      warnCountEl.className = warnings > 0 ? 'badge badge-warning' : 'badge badge-neutral';
    }
  }

  /**
   * Render Tabular View
   */
  renderSymbolTable() {
    const tbody = document.getElementById('symbol-table-body');
    if (!tbody) return;

    // Filter symbols
    const filtered = this.symbols.filter(s => {
      // Kind filter
      if (this.activeFilterKind !== 'ALL') {
        if (this.activeFilterKind === 'VARIABLE' && s.kind !== 'variable') return false;
        if (this.activeFilterKind === 'FUNCTION' && s.kind !== 'function') return false;
        if (this.activeFilterKind === 'PARAMETER' && s.kind !== 'parameter') return false;
        if (this.activeFilterKind === 'CONSTANT' && s.kind !== 'constant' && !s.isConstant) return false;
        if (this.activeFilterKind === 'STRUCT' && !['struct', 'class', 'typedef', 'enum'].includes(s.kind)) return false;
      }

      // Scope filter
      if (this.activeScopeFilter !== 'ALL' && s.scopeId !== this.activeScopeFilter) {
        return false;
      }

      // Search query
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchType = (s.type || '').toLowerCase().includes(q);
        const matchKind = (s.kind || '').toLowerCase().includes(q);
        const matchScope = (s.scopeName || '').toLowerCase().includes(q);
        if (!matchName && !matchType && !matchKind && !matchScope) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state">
            <div class="empty-content">
              <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p>No symbols match your filter criteria.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((s, idx) => {
      const kindClass = this.getKindBadgeClass(s.kind);
      const statusBadge = this.getStatusBadge(s);
      const refsCount = s.references ? s.references.length : 0;

      return `
        <tr class="symbol-row ${s.isRedeclaration ? 'row-error' : ''} ${s.isShadowed ? 'row-shadowed' : ''}" 
            data-line="${s.line}" data-col="${s.col}" onclick="window.app.onSymbolRowClick(${s.line}, ${s.col})">
          <td class="col-idx">${idx + 1}</td>
          <td class="col-name">
            <span class="symbol-name-tag font-mono font-bold">${this.escapeHtml(s.name)}</span>
          </td>
          <td class="col-kind">
            <span class="kind-badge ${kindClass}">${s.kind}</span>
          </td>
          <td class="col-type">
            <code class="type-code">${this.escapeHtml(s.type || 'auto')}</code>
          </td>
          <td class="col-scope">
            <span class="scope-pill scope-level-${Math.min(s.scopeLevel, 4)}">
              L${s.scopeLevel}: ${this.escapeHtml(s.scopeName)}
            </span>
          </td>
          <td class="col-offset">
            <span class="offset-tag font-mono">${this.escapeHtml(s.offset || 'N/A')}</span>
          </td>
          <td class="col-size">
            <span class="size-tag">${s.size != null ? s.size + ' B' : '-'}</span>
          </td>
          <td class="col-pos">
            <button class="btn-jump font-mono" title="Jump to Line ${s.line}" onclick="event.stopPropagation(); window.app.onSymbolRowClick(${s.line}, ${s.col})">
              L${s.line}:${s.col}
            </button>
          </td>
          <td class="col-refs">
            <span class="refs-badge ${refsCount > 0 ? 'has-refs' : 'no-refs'}" title="${refsCount} references found in code">
              ${refsCount} refs
            </span>
          </td>
          <td class="col-status">
            ${statusBadge}
          </td>
        </tr>
      `;
    }).join('');
  }

  getKindBadgeClass(kind) {
    switch (kind) {
      case 'function': return 'kind-function';
      case 'variable': return 'kind-variable';
      case 'parameter': return 'kind-parameter';
      case 'constant': return 'kind-constant';
      case 'struct':
      case 'class': return 'kind-struct';
      case 'typedef': return 'kind-typedef';
      default: return 'kind-default';
    }
  }

  getStatusBadge(s) {
    if (s.isRedeclaration) {
      return '<span class="status-badge status-error" title="Redeclaration error in same scope">⚠️ Duplicate</span>';
    }
    if (s.isShadowed) {
      return `<span class="status-badge status-shadowed" title="Shadows outer: ${this.escapeHtml(s.shadows || '')}">🌑 Shadowed</span>`;
    }
    if (s.isUnused) {
      return '<span class="status-badge status-unused" title="Declared but never used">💤 Unused</span>';
    }
    return '<span class="status-badge status-valid">✓ Valid</span>';
  }

  /**
   * Render Scope Tree Hierarchy
   */
  renderScopeTree() {
    const container = document.getElementById('scope-tree-container');
    if (!container) return;

    if (this.scopes.length === 0) {
      container.innerHTML = '<div class="empty-state">No scopes detected.</div>';
      return;
    }

    // Build hierarchy tree
    const scopeMap = new Map();
    this.scopes.forEach(sc => scopeMap.set(sc.id, { ...sc, children: [] }));

    let root = null;
    this.scopes.forEach(sc => {
      const node = scopeMap.get(sc.id);
      if (sc.parentId && scopeMap.has(sc.parentId)) {
        scopeMap.get(sc.parentId).children.push(node);
      } else {
        root = node;
      }
    });

    const renderNodeHtml = (node) => {
      // Find symbols belonging to this scope
      const scopeSymbols = this.symbols.filter(s => s.scopeId === node.id);

      return `
        <div class="scope-node scope-depth-${Math.min(node.level, 4)}" onclick="window.app.onScopeClick('${node.id}', ${node.startLine}, ${node.endLine})">
          <div class="scope-card-header">
            <div class="scope-title">
              <span class="scope-id font-mono">${node.id}</span>
              <span class="scope-level-badge">Level ${node.level}</span>
              <strong class="scope-name">${this.escapeHtml(node.name)}</strong>
            </div>
            <span class="scope-range font-mono">Lines ${node.startLine}–${node.endLine || 'End'}</span>
          </div>
          
          <div class="scope-symbols-container">
            ${scopeSymbols.length > 0 ? scopeSymbols.map(s => `
              <span class="scope-sym-chip ${this.getKindBadgeClass(s.kind)}" 
                    onclick="event.stopPropagation(); window.app.onSymbolRowClick(${s.line}, ${s.col})">
                <span class="chip-kind">${s.kind[0].toUpperCase()}</span>
                <span class="chip-name font-mono">${this.escapeHtml(s.name)}</span>
                <span class="chip-type">${this.escapeHtml(s.type)}</span>
              </span>
            `).join('') : '<span class="no-symbols-note">No local declarations</span>'}
          </div>

          ${node.children.length > 0 ? `
            <div class="scope-children-branch">
              ${node.children.map(renderNodeHtml).join('')}
            </div>
          ` : ''}
        </div>
      `;
    };

    container.innerHTML = `
      <div class="scope-tree-wrapper">
        ${renderNodeHtml(root || scopeMap.get(this.scopes[0].id))}
      </div>
    `;
  }

  /**
   * Render Compiler Internal Hash Table (Buckets)
   */
  renderHashTable() {
    const container = document.getElementById('hash-table-container');
    if (!container) return;

    if (!this.hashTable || this.hashTable.length === 0) {
      container.innerHTML = '<div class="empty-state">No hash table data available.</div>';
      return;
    }

    const totalSymbols = this.symbols.length;
    const totalBuckets = this.hashTable.length;
    const occupiedBuckets = this.hashTable.filter(b => b.entries.length > 0).length;
    const loadFactor = (totalSymbols / totalBuckets).toFixed(2);

    let html = `
      <div class="hash-metrics-banner">
        <div class="metric-item">
          <span class="metric-label">Hash Algorithm</span>
          <span class="metric-val font-mono">H(k) = (∑ c_i * 31) % 16</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Buckets (M)</span>
          <span class="metric-val font-mono">${totalBuckets}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Occupied</span>
          <span class="metric-val font-mono">${occupiedBuckets} / ${totalBuckets}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Load Factor (α)</span>
          <span class="metric-val font-mono ${parseFloat(loadFactor) > 1.5 ? 'load-high' : 'load-optimal'}">${loadFactor}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Collision Resolution</span>
          <span class="metric-val">Separate Chaining</span>
        </div>
      </div>
      
      <div class="hash-buckets-grid">
    `;

    for (const b of this.hashTable) {
      const count = b.entries.length;
      html += `
        <div class="bucket-box ${count > 0 ? 'bucket-filled' : 'bucket-empty'}">
          <div class="bucket-header">
            <span class="bucket-idx font-mono">Bucket [${b.bucketIndex}]</span>
            <span class="bucket-count ${count > 1 ? 'collision-warn' : ''}">${count} ${count === 1 ? 'entry' : 'entries'}</span>
          </div>
          <div class="bucket-chain">
            ${count === 0 ? '<div class="empty-bucket-slot">NULL (empty)</div>' : b.entries.map((entry, i) => `
              <div class="chain-node" onclick="window.app.onSymbolRowClick(${entry.line}, ${entry.col})">
                <div class="node-content">
                  <span class="node-name font-mono font-bold">${this.escapeHtml(entry.symbolName)}</span>
                  <span class="node-hash font-mono">${entry.hashCode}</span>
                </div>
                <div class="node-sub">
                  <span class="node-type font-mono">${this.escapeHtml(entry.type)}</span>
                  <span class="node-scope">${this.escapeHtml(entry.scopeName)}</span>
                </div>
                ${i < b.entries.length - 1 ? '<div class="chain-link">⬇ next ptr</div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Render Memory Layout / Stack Frame
   */
  renderMemoryLayout() {
    const container = document.getElementById('memory-layout-container');
    if (!container) return;

    const globals = this.symbols.filter(s => s.scopeLevel === 0 && s.kind !== 'function');
    const localSymbols = this.symbols.filter(s => s.scopeLevel > 0 && ['variable', 'parameter', 'constant'].includes(s.kind));

    let html = `
      <div class="memory-segments-view">
        <!-- Global Data Segment -->
        <div class="memory-card segment-data">
          <div class="memory-card-header">
            <span class="segment-badge font-mono">.DATA / .BSS SECTION</span>
            <h4>Global Memory Segment (Static Allocation)</h4>
          </div>
          <div class="segment-items">
            ${globals.length > 0 ? globals.map(g => `
              <div class="memory-slot slot-global" onclick="window.app.onSymbolRowClick(${g.line}, ${g.col})">
                <div class="slot-addr font-mono">${this.escapeHtml(g.offset || '+0x0000')}</div>
                <div class="slot-info">
                  <span class="slot-name font-mono">${this.escapeHtml(g.name)}</span>
                  <span class="slot-type">${this.escapeHtml(g.type)}</span>
                </div>
                <div class="slot-size font-mono">${g.size || 4} Bytes</div>
              </div>
            `).join('') : '<div class="no-mem-items">No global variables declared</div>'}
          </div>
        </div>

        <!-- Stack Frame Segment -->
        <div class="memory-card segment-stack">
          <div class="memory-card-header">
            <span class="segment-badge font-mono">STACK FRAME (RBP / RSP)</span>
            <h4>Activation Record (Local Variables & Parameters)</h4>
          </div>
          
          <div class="stack-frame-diagram">
            <div class="stack-boundary high-mem">[High Address Memory]</div>
            
            <div class="stack-block block-control">
              <div class="block-title font-mono">[Caller Saved Frame: RBP & Return Addr]</div>
              <div class="block-desc">Return Instruction Pointer (RIP) + Saved Base Pointer (RBP)</div>
            </div>

            ${localSymbols.map(sym => `
              <div class="stack-block ${sym.kind === 'parameter' ? 'block-param' : 'block-local'}" 
                   onclick="window.app.onSymbolRowClick(${sym.line}, ${sym.col})">
                <div class="block-addr font-mono">${this.escapeHtml(sym.offset || 'N/A')}</div>
                <div class="block-info">
                  <span class="block-name font-mono font-bold">${this.escapeHtml(sym.name)}</span>
                  <span class="block-type font-mono">(${this.escapeHtml(sym.type)})</span>
                  <span class="block-scope">${this.escapeHtml(sym.scopeName)}</span>
                </div>
                <div class="block-size font-mono">${sym.size || 4}B</div>
              </div>
            `).join('')}

            <div class="stack-boundary low-mem">[Low Address Memory - Current RSP (Stack Pointer)]</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Render Diagnostics List
   */
  renderDiagnostics() {
    const container = document.getElementById('diagnostics-list');
    const badgeEl = document.getElementById('diag-tab-badge');
    if (!container) return;

    if (badgeEl) {
      badgeEl.textContent = this.diagnostics.length;
      badgeEl.className = this.diagnostics.some(d => d.severity === 'error') ? 'badge badge-error' : (this.diagnostics.length > 0 ? 'badge badge-warning' : 'badge badge-neutral');
    }

    if (this.diagnostics.length === 0) {
      container.innerHTML = `
        <div class="diagnostics-clean">
          <svg width="24" height="24" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <span>All checks passed! No compiler errors or warnings detected.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = this.diagnostics.map(d => {
      const isError = d.severity === 'error';
      const icon = isError ? '❌' : (d.severity === 'warning' ? '⚠️' : 'ℹ️');
      return `
        <div class="diag-item diag-${d.severity}" onclick="window.app.onSymbolRowClick(${d.line}, ${d.col})">
          <span class="diag-icon">${icon}</span>
          <div class="diag-msg">${this.escapeHtml(d.message)}</div>
          <span class="diag-pos font-mono">Line ${d.line}:${d.col}</span>
        </div>
      `;
    }).join('');
  }

  setFilterKind(kind) {
    this.activeFilterKind = kind;
    this.renderSymbolTable();
  }

  setSearchQuery(q) {
    this.searchQuery = q;
    this.renderSymbolTable();
  }

  setScopeFilter(scopeId) {
    this.activeScopeFilter = scopeId;
    this.renderSymbolTable();
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

window.Visualizer = Visualizer;
