import os
import subprocess
import shutil

def generate_pdf():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(script_dir, "project_report.html")
    pdf_path = os.path.join(script_dir, "Symbol_Table_Generator_Project_Report.pdf")

    scratch_html = r"C:\Users\DELL\.gemini\antigravity\brain\8988cc9e-63cf-4398-94b9-57855ea825e1\scratch\project_report.html"
    if os.path.exists(scratch_html) and not os.path.exists(html_path):
        shutil.copyfile(scratch_html, html_path)

    chrome_candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    
    browser_bin = None
    for c in chrome_candidates:
        if os.path.exists(c):
            browser_bin = c
            break

    if not browser_bin:
        print("Error: Neither Google Chrome nor Microsoft Edge was found to render the PDF.")
        return False

    cmd = [
        browser_bin,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path if os.path.exists(html_path) else scratch_html
    ]

    print(f"Rendering PDF using {os.path.basename(browser_bin)}...")
    subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(pdf_path):
        print(f"Successfully generated PDF: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
        return True
    else:
        print("PDF compilation failed.")
        return False

if __name__ == "__main__":
    generate_pdf()
