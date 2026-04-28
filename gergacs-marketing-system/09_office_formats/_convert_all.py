"""
Batch convert all marketing-system files into PDF, DOCX, and XLSX formats.

Outputs into 09_office_formats/{pdf,docx,xlsx}/...

Run from repo root:
    python gergacs-marketing-system/09_office_formats/_convert_all.py
"""
import os
import re
import sys
import subprocess
import tempfile
import shutil
from pathlib import Path

# ============ PATHS ============
ROOT = Path(__file__).resolve().parent.parent  # gergacs-marketing-system/
OUT = ROOT / "09_office_formats"
PDF_DIR = OUT / "pdf"
DOCX_DIR = OUT / "docx"
XLSX_DIR = OUT / "xlsx"

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PANDOC = "pandoc"

# Brand CSS injected into every HTML used for PDF generation
BRAND_CSS = """
@page { size: Letter; margin: 0.85in; }
body {
    font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #141414;
    line-height: 1.65;
    font-size: 11pt;
    background: #FFFFFF;
    max-width: 100%;
}
h1, h2, h3, h4 { font-family: 'Trocchi', 'Georgia', serif; color: #1E2A44; font-weight: 400; }
h1 { font-size: 26pt; line-height: 1.1; margin: 0 0 .8em 0; border-bottom: 3px solid #7A5B2E; padding-bottom: .3em; }
h2 { font-size: 18pt; line-height: 1.15; margin: 1.6em 0 .6em 0; color: #7A5B2E; }
h3 { font-size: 14pt; line-height: 1.2; margin: 1.2em 0 .4em 0; color: #1E2A44; }
h4 { font-size: 12pt; margin: 1em 0 .3em 0; color: #5C4422; }
p { margin: 0 0 .8em 0; }
strong { color: #1E2A44; }
em { color: #5C4422; }
ul, ol { margin: 0 0 1em 1.5em; }
li { margin-bottom: .35em; }
code { font-family: 'Consolas', 'Courier New', monospace; background: #F6F0E6; padding: 1px 5px; border-radius: 3px; font-size: 9.5pt; }
pre { background: #F6F0E6; border-left: 3px solid #7A5B2E; padding: .8em 1em; border-radius: 4px; overflow-x: auto; font-size: 9.5pt; line-height: 1.4; page-break-inside: avoid; }
pre code { background: transparent; padding: 0; }
blockquote { border-left: 3px solid #7A5B2E; padding: .2em 1em; margin: 1em 0; color: #3A3530; font-style: italic; background: #FFFBF4; page-break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; page-break-inside: avoid; }
th { background: #1E2A44; color: #F6F0E6; text-align: left; padding: .55em .8em; font-weight: 700; font-size: 9.5pt; letter-spacing: .04em; text-transform: uppercase; }
td { border-bottom: 1px solid #D8CFBF; padding: .5em .8em; vertical-align: top; }
tr:nth-child(even) td { background: #FFFBF4; }
hr { border: 0; border-top: 1px solid #D8CFBF; margin: 1.6em 0; }
a { color: #7A5B2E; text-decoration: underline; }
.brand-footer { position: fixed; bottom: -.6in; left: 0; right: 0; text-align: center; font-size: 8pt; color: #7A6E5E; font-style: italic; }
"""

GOOGLE_FONTS = '<link href="https://fonts.googleapis.com/css2?family=Trocchi:wght@400&family=Noto+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">'

# ============ CHROME HELPERS ============

def chrome_print(html_path: Path, pdf_path: Path) -> bool:
    """Use Chrome headless to print an HTML file to PDF."""
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    # file:// URL
    file_url = "file:///" + str(html_path).replace("\\", "/")
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        file_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return pdf_path.exists() and pdf_path.stat().st_size > 0
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT: {html_path.name}")
        return False

# ============ MD CONVERSIONS ============

def md_to_docx(md_path: Path, docx_path: Path) -> bool:
    docx_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [PANDOC, str(md_path), "-o", str(docx_path), "--toc", "--toc-depth=2"]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
        return docx_path.exists()
    except Exception as e:
        print(f"  DOCX FAIL: {md_path.name}: {e}")
        return False

def md_to_pdf(md_path: Path, pdf_path: Path) -> bool:
    """Render MD as styled HTML in a temp file, then Chrome headless print to PDF."""
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert MD to HTML body via pandoc — pipe through a file to avoid Windows cp1252 stdout issues
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as bf:
        body_html_path = Path(bf.name)
    cmd = [PANDOC, str(md_path), "-t", "html", "--no-highlight", "-o", str(body_html_path)]
    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=30)
        body = body_html_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  HTML FAIL: {md_path.name}: {e}")
        body_html_path.unlink(missing_ok=True)
        return False
    finally:
        body_html_path.unlink(missing_ok=True)

    # Wrap in styled HTML doc
    title = md_path.stem.replace("_", " ").title()
    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>{title}</title>
{GOOGLE_FONTS}
<style>{BRAND_CSS}</style>
</head><body>
{body}
</body></html>"""

    # Write to temp file (Chrome can't read stdin)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(html)
        temp_html = Path(f.name)

    try:
        ok = chrome_print(temp_html, pdf_path)
    finally:
        temp_html.unlink(missing_ok=True)
    return ok

# ============ HTML → PDF ============

def html_to_pdf(html_path: Path, pdf_path: Path) -> bool:
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    return chrome_print(html_path, pdf_path)

# ============ XLSX BUILDS ============

def build_xlsx_outputs():
    """Build select tabular Excel files from CSVs and key MD tables."""
    import pandas as pd
    XLSX_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Notion databases — combine 4 CSVs from ops package into one workbook
    ops_pkg = Path("C:/Users/Administrator/OneDrive/Desktop/Zillion/nikki_realty_system/notion_databases")
    if ops_pkg.exists():
        notion_xlsx = XLSX_DIR / "notion_databases.xlsx"
        with pd.ExcelWriter(notion_xlsx, engine='openpyxl') as writer:
            for csv in sorted(ops_pkg.glob("*.csv")):
                sheet = csv.stem[:31]  # excel sheet name limit
                try:
                    df = pd.read_csv(csv)
                    df.to_excel(writer, sheet_name=sheet, index=False)
                    print(f"  XLSX: {sheet} ({len(df)} rows)")
                except Exception as e:
                    print(f"  XLSX FAIL: {csv.name}: {e}")

    # 2. Extract tables from key MDs
    extract_md_tables_to_xlsx(
        ROOT / "00_audit" / "seo_audit.md",
        XLSX_DIR / "seo_audit_tables.xlsx",
        "SEO Audit Tables"
    )
    extract_md_tables_to_xlsx(
        ROOT / "01_strategy" / "kpi_framework.md",
        XLSX_DIR / "kpi_framework_tables.xlsx",
        "KPI Framework"
    )
    extract_md_tables_to_xlsx(
        ROOT / "05_wording_matrices" / "hook_bank.md",
        XLSX_DIR / "hook_bank.xlsx",
        "Hook Bank"
    )
    extract_md_tables_to_xlsx(
        ROOT / "05_wording_matrices" / "cta_bank.md",
        XLSX_DIR / "cta_bank.xlsx",
        "CTA Bank"
    )
    extract_md_tables_to_xlsx(
        ROOT / "00_audit" / "competitive_landscape.md",
        XLSX_DIR / "competitive_landscape.xlsx",
        "Competitive Landscape"
    )

def extract_md_tables_to_xlsx(md_path: Path, xlsx_path: Path, workbook_title: str):
    """Parse markdown tables from a file and write each as its own sheet."""
    import pandas as pd
    if not md_path.exists():
        print(f"  XLSX SKIP (not found): {md_path}")
        return

    text = md_path.read_text(encoding='utf-8')
    # Find markdown tables: a header row and dash separator
    table_pattern = re.compile(
        r'(\|[^\n]+\|\n\|[\s:|-]+\|\n(?:\|[^\n]+\|\n)+)',
        re.MULTILINE
    )
    tables = table_pattern.findall(text)
    if not tables:
        print(f"  XLSX SKIP (no tables): {md_path.name}")
        return

    with pd.ExcelWriter(xlsx_path, engine='openpyxl') as writer:
        for i, raw in enumerate(tables):
            try:
                lines = [l.strip() for l in raw.strip().split('\n') if l.strip()]
                if len(lines) < 3:
                    continue
                headers = [c.strip() for c in lines[0].strip('|').split('|')]
                rows = []
                for line in lines[2:]:
                    cells = [c.strip() for c in line.strip('|').split('|')]
                    if len(cells) == len(headers):
                        rows.append(cells)
                if not rows:
                    continue
                df = pd.DataFrame(rows, columns=headers)
                sheet = f"Table_{i+1}"[:31]
                df.to_excel(writer, sheet_name=sheet, index=False)
            except Exception as e:
                print(f"  TABLE FAIL ({md_path.name} #{i+1}): {e}")
    print(f"  XLSX: {xlsx_path.name} ({len(tables)} tables)")

# ============ MAIN ============

def main():
    print("=" * 60)
    print("Gergacs Marketing System · Batch Convert")
    print("=" * 60)
    print(f"Source: {ROOT}")
    print(f"Output: {OUT}")
    print()

    # 1. Convert all .md files (except this script's folder) to PDF + DOCX
    md_files = []
    for p in ROOT.rglob("*.md"):
        if "09_office_formats" in p.parts:
            continue
        md_files.append(p)

    md_files.sort()
    print(f"Found {len(md_files)} MD files to convert")
    print()

    md_ok = 0
    pdf_ok = 0
    docx_ok = 0
    for md in md_files:
        rel = md.relative_to(ROOT)
        rel_no_ext = rel.with_suffix("")
        pdf_path = PDF_DIR / rel.with_suffix(".pdf")
        docx_path = DOCX_DIR / rel.with_suffix(".docx")

        print(f"  [{md_ok+1}/{len(md_files)}] {rel}")
        if md_to_docx(md, docx_path):
            docx_ok += 1
        if md_to_pdf(md, pdf_path):
            pdf_ok += 1
        md_ok += 1

    print()
    print(f"MD complete: {pdf_ok}/{len(md_files)} PDFs · {docx_ok}/{len(md_files)} DOCX")
    print()

    # 2. Convert all .html files (pitch decks + email templates) to PDF
    html_files = []
    for p in ROOT.rglob("*.html"):
        if "09_office_formats" in p.parts:
            continue
        html_files.append(p)
    html_files.sort()

    print(f"Found {len(html_files)} HTML files to convert to PDF")
    print()
    html_ok = 0
    for html in html_files:
        rel = html.relative_to(ROOT)
        pdf_path = PDF_DIR / rel.with_suffix(".pdf")
        print(f"  [{html_ok+1}/{len(html_files)}] {rel}")
        if html_to_pdf(html, pdf_path):
            html_ok += 1

    print()
    print(f"HTML complete: {html_ok}/{len(html_files)} PDFs")
    print()

    # 3. Build XLSX outputs
    print("Building XLSX outputs...")
    try:
        build_xlsx_outputs()
    except Exception as e:
        print(f"  XLSX BUILD FAIL: {e}")
    print()

    # Summary
    print("=" * 60)
    print(f"DONE")
    print(f"  PDFs:  {pdf_ok + html_ok} files in {PDF_DIR}")
    print(f"  DOCX:  {docx_ok} files in {DOCX_DIR}")
    print(f"  XLSX:  {len(list(XLSX_DIR.glob('*.xlsx')))} files in {XLSX_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
