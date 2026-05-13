import pdfplumber
import os

pdf_files = {
    "Ref II - PV Centralisation": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\PV CENTRALISATION DOS CANDIDAT.pdf",
    "Ref III - Communique": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\COMMUNIQUE011PDF_260423_152448_260423_155657.pdf",
    "Ref IV - 8775807779666": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\8775807779666.pdf",
    "Ref V - New Document 30": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\New Document(30).pdf",
    "Ref VI - Arrete Delegues": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\Arrêté n° 0007-MTPEDSFP portant dérogation à titre exceptionnel, au délai d'organisation des élections des Délégués du Personnel dans les entreprises.pdf",
    "Ref VII - Circulaire": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\CIRCULAIRE.pdf",
}

output_file = r"c:\Users\HP VICTUS AMD RYZEN5\Desktop\CNX 4-0\OHITU\Ohitu\pdf_content.txt"

with open(output_file, "w", encoding="utf-8") as out:
    for ref_name, pdf_path in pdf_files.items():
        out.write(f"\n{'='*80}\n")
        out.write(f"REFERENCE: {ref_name}\n")
        out.write(f"FILE: {pdf_path}\n")
        out.write(f"{'='*80}\n\n")
        
        if not os.path.exists(pdf_path):
            out.write(f"[FILE NOT FOUND: {pdf_path}]\n\n")
            print(f"NOT FOUND: {pdf_path}")
            continue
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                out.write(f"Total pages: {len(pdf.pages)}\n\n")
                for i, page in enumerate(pdf.pages):
                    out.write(f"--- Page {i+1} ---\n")
                    text = page.extract_text()
                    if text:
                        out.write(text)
                    else:
                        out.write("[No text extracted from this page]")
                    out.write("\n\n")
            print(f"OK: {ref_name}")
        except Exception as e:
            out.write(f"[ERROR reading PDF: {e}]\n\n")
            print(f"ERROR {ref_name}: {e}")

print(f"\nOutput written to: {output_file}")
