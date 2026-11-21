import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def add_callout(doc, text, title="NOTE", fill="F0F4F8", border_color="1F497D"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, fill)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>
            <w:top w:val="none"/>
            <w:right w:val="none"/>
            <w:bottom w:val="none"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    r_title = p.add_run(f"[{title}] ")
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(10)
    r_title.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)
    
    r_text = p.add_run(text)
    r_text.font.name = "Calibri"
    r_text.font.size = Pt(10)
    r_text.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F8F9FA")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="D0D5DD"/>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="D0D5DD"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="D0D5DD"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="D0D5DD"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(code_text)
    r.font.name = "Consolas"
    r.font.size = Pt(9)
    r.font.color.rgb = RGBColor(0x24, 0x29, 0x2F)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, headers, data):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], "1F497D")
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(title)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    for r_idx, row_data in enumerate(data):
        row_cells = table.add_row().cells
        bg_color = "F9FAFB" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            row_cells[c_idx].width = col_widths[c_idx]
            set_cell_background(row_cells[c_idx], bg_color)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=140, right=140)
            p = row_cells[c_idx].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(str(val))
            run.font.name = "Calibri"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
            
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="1F497D"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def build_report():
    global doc
    doc = docx.Document()
    
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        
    footer = doc.sections[0].footer
    f_p = footer.paragraphs[0]
    f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    f_run = f_p.add_run("Symbol Table Generator & Compiler Analyzer — Senior Engineering Report")
    f_run.font.name = "Calibri"
    f_run.font.size = Pt(8.5)
    f_run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
    
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("Symbol Table Generator & Compiler Analyzer")
    run_title.bold = True
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(24)
    run_title.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)
    
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(16)
    run_sub = sub_p.add_run("Comprehensive Technical Specification & Senior Developer Project Report")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(13)
    run_sub.font.color.rgb = RGBColor(0x59, 0x59, 0x59)
    
    meta_table = doc.add_table(rows=1, cols=4)
    meta_widths = [Inches(1.5), Inches(1.8), Inches(1.4), Inches(1.8)]
    meta_headers = ["Project Lead", "Stack", "Test Suite", "Target Environment"]
    meta_data = [
        ["Senior Developer", "Node.js 24, Monaco, Express", "26/26 Passing (100%)", "Web / Desktop (Local)"]
    ]
    format_table(meta_table, meta_widths, meta_headers, meta_data)
    
    def add_h1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(16)
        r.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)
        return h

    def add_h2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(0x2E, 0x75, 0xB6)
        return h

    def add_p(text, bold_prefix=None):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            bp = p.add_run(bold_prefix)
            bp.bold = True
            bp.font.name = "Calibri"
            bp.font.size = Pt(10.5)
            bp.font.color.rgb = RGBColor(0x26, 0x26, 0x26)
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(0x26, 0x26, 0x26)
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            bp = p.add_run(bold_prefix)
            bp.bold = True
            bp.font.name = "Calibri"
            bp.font.size = Pt(10.5)
            bp.font.color.rgb = RGBColor(0x26, 0x26, 0x26)
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(0x26, 0x26, 0x26)
        return p

    # --- Section 1: Executive Summary ---
    add_h1("1. Executive Summary")
    add_p("The Symbol Table Generator & Compiler Scope / Memory Analyzer is a high-performance full-stack compiler engineering application designed for systems engineers, compiler students, and developers. It bridges interactive source code editing in Monaco Editor with deep semantic compilation analysis: lexical tokenization, hierarchical lexical scope tree generation, semantic diagnostic verification, x86-64 memory layout simulation, and closed-addressing hash table collision tracking.")
    add_p("The system is engineered as an ultra-lightweight, zero-database architecture with instantaneous startup and zero setup overhead, making it immediately portable across any standard Node.js development environment.")

    add_callout(doc, "The application achieves 100% test coverage across its core components with 26 passing regression tests spanning API endpoints, lexing, semantic diagnostics, memory layout, multi-language grammar, and multi-format exports executing in under 2 seconds.", "KEY MILESTONE")

    # --- Section 2: System Architecture ---
    add_h1("2. System Architecture & Component Design")
    add_p("The system is engineered as a decoupled, asynchronous client-server architecture:")
    
    add_bullet(" Client UI based on vanilla ES6+ and CSS3, integrating the VS Code Monaco Editor via AMD loader and a 4-tab compiler visualizer.", "Frontend Tier:")
    add_bullet(" Express v5 application running on Node.js v24. Exposes REST endpoints for real-time compilation analysis and multi-format exporting.", "Backend API Tier:")
    add_bullet(" Multi-pass analyzer featuring a regex-based tokenizer, lexical scope tree builder, reference resolution engine, and x86-64 memory layout calculator.", "Compiler Subsystem:")

    add_h2("Component Interaction Flow")
    add_code_block(doc, 
"""[User Types Code in Monaco Editor]
         │ (Debounced / On-Click)
         ▼
[POST /api/analyze] ──► [Lexical Tokenizer (tokenizer.js)]
                             │ (Tokens Stream)
                             ▼
                        [Scope Tree Builder & Semantic Verifier]
                             │ (Hierarchical Scopes & Symbol Map)
                             ▼
                        [Memory Layout & Hash Table Simulator]
                             │ (ABI Offsets & Hash Buckets)
                             ▼
[Frontend Visualizer] ◄── [JSON Payload: Symbols, Scopes, Diagnostics, Memory]
         │
         ├──► Updates Monaco Error/Warning Squiggles
         ├──► Renders Filterable Symbol Table & Scope Tree
         ├──► Visualizes 16 Closed-Addressing Hash Buckets
         └──► Renders x86-64 Memory Map (.data, Stack, Registers)""")

    # --- Section 3: Compiler Engine & Semantic Verification ---
    add_h1("3. Compiler Engine & Semantic Verification")
    add_p("The compiler engine performs multi-language lexical analysis and deep semantic verification across C, C++, Java, JavaScript, and Python.")

    add_h2("Semantic Diagnostic Matrix")
    diag_table = doc.add_table(rows=1, cols=4)
    diag_widths = [Inches(1.5), Inches(1.0), Inches(2.0), Inches(2.0)]
    diag_headers = ["Diagnostic Type", "Severity", "Trigger Condition", "Engine Resolution"]
    diag_data = [
        ["Redeclaration", "Error", "Duplicate identifier declaration within same scope level.", "Flags exact previous declaration line/col."],
        ["Variable Shadowing", "Warning", "Inner scope variable matches an identifier in an outer scope.", "Identifies outer scope name and line."],
        ["Undeclared Identifier", "Error", "Identifier referenced without prior declaration in scope chain.", "Exempts standard library built-ins."],
        ["Unused Identifier", "Notice", "Variable declared but reference count equals zero.", "Exempts struct members and typedefs."]
    ]
    format_table(diag_table, diag_widths, diag_headers, diag_data)

    # --- Section 4: Memory Layout & Stack Frame Calculation ---
    add_h1("4. Memory Layout & Architecture Simulation")
    add_p("The engine implements x86-64 System V AMD64 ABI memory alignment and offset rules:")
    add_bullet(" Global variables are allocated with cumulative positive byte offsets (+0x0000, +0x0004, etc.) in the initialized data (.data) or uninitialized (.bss) segment.", "Data Segment (.data / .bss):")
    add_bullet(" Local function variables are assigned negative base pointer offsets [rbp - 4], [rbp - 8], [rbp - 16] respecting natural primitive alignments.", "Stack Frame ([rbp - offset]):")
    add_bullet(" First 6 integer/pointer parameters map directly to AMD64 calling convention registers: %rdi, %rsi, %rdx, %rcx, %r8, %r9.", "Register Passing:")
    add_bullet(" Struct fields receive zero-indexed cumulative offsets (Member: +0x0000, +0x0004) without stack-pointer displacement.", "Struct Member Offsets:")

    add_h2("Compiler Hash Table Simulation")
    add_p("To demonstrate compiler symbol table indexing, the engine hashes all symbol names into 16 closed-addressing buckets using a deterministic string hashing algorithm, visualizing collision chain depth and distribution efficiency in the UI.")

    # --- Section 5: Quality Assurance & Test Suite ---
    add_h1("5. Quality Assurance & Regression Testing Suite")
    add_p("The project features a comprehensive regression test suite implemented with the Node.js native test runner (node:test and node:assert). All 26 tests pass deterministically in under 2 seconds:")

    test_table = doc.add_table(rows=1, cols=3)
    test_widths = [Inches(3.2), Inches(1.3), Inches(2.0)]
    test_headers = ["Test Suite", "Tests Passed", "Execution Speed"]
    test_data = [
        ["REST API Endpoints Regression Suite", "4 / 4", "< 25 milliseconds"],
        ["Compiler Core (Lexer, Memory, Hash)", "8 / 8", "< 10 milliseconds"],
        ["Multi-Format Export Formats", "4 / 4", "< 10 milliseconds"],
        ["Multi-Language Grammar & Parsing", "4 / 4", "< 10 milliseconds"],
        ["Semantic Diagnostics & Scope Hierarchy", "6 / 6", "< 10 milliseconds"],
        ["TOTAL REGRESSION SUITE", "26 / 26 (100%)", "< 1.7 seconds total"]
    ]
    format_table(test_table, test_widths, test_headers, test_data)

    # --- Section 6: UI & Responsive Design Breakpoints ---
    add_h1("6. Frontend UX & Responsive Design")
    add_p("The user interface features a sleek dark-theme aesthetic optimized across device classes:")
    add_bullet(" Side-by-side split pane layout with a draggable horizontal resizer divider. Real-time Monaco editor on the left; 4 tabbed visualizer views on the right.", "Desktop (> 860px):")
    add_bullet(" Dedicated mobile workspace navigation bar with 'Code Editor' and 'Visualizer & Tables' view switching buttons, sticky table column headers, and auto-jump to editor on symbol click.", "Tablet & Mobile (≤ 860px):")
    add_bullet(" Responsive wrapped header with icon-only action buttons, horizontal scrolling for view tabs, and touch-friendly modal dialogs.", "Compact Phone (≤ 640px):")

    # --- Section 7: Multi-Format Export ---
    add_h1("7. Multi-Format Export Capabilities")
    add_p("Generated symbol tables and compiler metrics can be exported in 4 standard formats:")
    add_bullet(" Full structured JSON AST and symbol payload for external tooling.", "JSON Data (.json):")
    add_bullet(" Comma-separated values for spreadsheet audits.", "CSV Spreadsheet (.csv):")
    add_bullet(" Formatted markdown table for GitHub PRs and technical documentation.", "GitHub Markdown (.md):")
    add_bullet(" Academic booktabs table syntax for research papers and reports.", "LaTeX Table (.tex):")

    # --- Section 8: Operational Guide ---
    add_h1("8. Operational & Deployment Guide")
    add_p("To run the application locally in any development environment:")
    add_code_block(doc,
"""# 1. Navigate to Project Directory
cd "c:\\Users\\DELL\\OneDrive\\Desktop\\Symbol Table"

# 2. Start Web Server (Runs on http://localhost:3000)
npm start

# 3. Development Mode (Watch / Auto-reload)
npm run dev

# 4. Execute Full Regression Test Suite
npm test""")

    desktop_path = r"c:\Users\DELL\OneDrive\Desktop\Symbol Table\Symbol_Table_Generator_Project_Report.docx"
    doc.save(desktop_path)
    print(f"Successfully generated DOCX at: {desktop_path}")

if __name__ == "__main__":
    build_report()
