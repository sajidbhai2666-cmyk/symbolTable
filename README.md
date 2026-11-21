# Web-Based Symbol Table Generator & Compiler Analyzer

A fast, lightweight, web-based compiler engineering tool and Symbol Table generator powered by **Monaco Editor** (VS Code engine), a multi-language lexical & scope analysis engine, interactive multi-view visualizers, and zero external database overhead.

---

## 🌟 Key Features

### 1. Monaco Editor (VS Code Engine) Integration
- **Syntax Highlighting & Formatting**: Full support for **C, C++, Java, JavaScript, and Python**.
- **Bidirectional Interactivity**:
  - Click any row in the Symbol Table or Scope Tree to **jump Monaco's cursor to the line & column** and highlight the identifier.
  - Selecting scopes highlights the entire code block.
- **In-Editor Diagnostics Squiggles**: True compiler squiggles (`monaco.editor.setModelMarkers`) highlighting duplicate declarations, shadowing, and undeclared identifiers.
- **Pre-configured Code Presets**:
  - *C Comprehensive Compiler Test* (Global data segment, structs, functions, parameters, nested blocks).
  - *Lexical Scoping & Shadowing Demo* (Multi-level block scoping).
  - *Object-Oriented Classes & Methods* (C++/Java classes, access modifiers).
  - *Pointers, Arrays & Memory Sizing* (Dynamic pointers, BSS/Data buffer arrays).
  - *Python Scoping* (Functions, loops, parameters).
  - *Semantic Errors Showcase* (Intentional redeclarations and undeclared identifiers).

### 2. Compiler Scope & Symbol Table Engine
- **Tokenization**: Accurate lexical analysis capturing keywords, types, identifiers, storage qualifiers (`const`, `static`, `extern`), literals, and operators.
- **Hierarchical Scope Tree**: Constructs parent-child scope relationships from Global Scope (Level 0) down to functions, blocks, loops, and classes.
- **Identifier Attributes Tracked**:
  - Identifier Name & Kind (`variable`, `function`, `parameter`, `constant`, `struct`, `class`, `typedef`)
  - Data Type (e.g. `int`, `Point2D`, `char*`, `double[10]`)
  - Scope Level & Enclosing Scope Name
  - Memory Offset (`+0x0000` in `.data/.bss`, `[rbp - 4]` in stack frame, `%RDI` calling convention registers)
  - Memory Size in Bytes (`sizeof` calculation with 64-bit alignment)
  - Exact Line and Column Definition
  - Usages / Reference Tracking with occurrence counts
  - Semantic Status (`Valid`, `Duplicate Redeclaration`, `Shadowed Variable`, `Unused Notice`)
- **Semantic Analysis & Error Detection**:
  - Detects duplicate declarations in the same scope (**Error**).
  - Detects out-of-scope / undeclared identifier usages (**Error**).
  - Detects lexical variable shadowing (**Warning**).
  - Detects declared but unreferenced variables (**Warning**).

### 3. Multi-View Visualizer
1. **📊 Tabular View**: Searchable, filterable table with kind badges, type coloring, offset annotations, and quick jump links.
2. **🌲 Hierarchical Scope Tree**: Interactive visual diagram showing scope nesting and symbols declared in each environment.
3. **📦 Compiler Hash Table (Buckets)**: Simulates the internal compiler symbol table implementation using polynomial rolling hash $H(k) = \left(\sum \text{char}_i \times 31\right) \pmod{16}$ and collision chaining.
4. **🧱 Memory Layout & Stack Frame**: Activation record diagram showing return address, saved RBP, parameters, local variables, and static data segments.

### 4. Multi-Format Exporter
- **JSON (`.json`)**: Complete AST, scopes, and symbol graph.
- **CSV (`.csv`)**: Tabular export ready for Excel or analysis.
- **Markdown (`.md`)**: Formatted GitHub Flavored Markdown table.
- **LaTeX (`.tex`)**: Ready-to-use table code for academic compiler lab reports.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start instantly and listen on:  
**`http://localhost:3000`**

### 3. Run Development Mode
```bash
npm run dev
```

### 4. Run Regression Test Suite
```bash
npm test
```

---

## 📁 Project Structure

```
Symbol Table/
├── package.json
├── server/
│   ├── index.js              # Express REST API & static server
│   ├── compiler/
│   │   ├── tokenizer.js      # Lexical analyzer / Tokenizer
│   │   ├── symbolTable.js    # Scope tree, symbol table builder, type checker
│   │   └── memoryLayout.js   # Type sizing, stack offsets, hash buckets
│   └── routes/
│       └── api.js            # REST endpoint (/analyze)
├── public/
│   ├── index.html            # Main web UI
│   ├── css/
│   │   └── styles.css        # IDE dark theme styling & responsive layout
│   └── js/
│       ├── app.js            # Main frontend coordinator
│       ├── editor.js         # Monaco editor controller & squiggles
│       ├── visualizer.js     # Tabular, scope tree, bucket, and stack views
│       ├── samples.js        # Built-in code presets
│       └── export.js         # Multi-format exports (JSON, CSV, MD, LaTeX)
└── tests/
    ├── compiler.test.js      # Lexer, memory sizing & hash buckets tests
    ├── semanticDiagnostics.test.js # Semantic checks & scope hierarchy tests
    ├── multiLanguage.test.js # C, C++, JS, and Python parsing tests
    ├── export.test.js        # JSON, CSV, Markdown, LaTeX export tests
    └── apiEndpoints.test.js  # REST API endpoint tests
```
