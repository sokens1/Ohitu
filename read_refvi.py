import pdfplumber
import os
import glob
import sys

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

# Find Ref VI by wildcard
downloads_dir = r"C:\Users\HP VICTUS AMD RYZEN5\Downloads"
pattern = os.path.join(downloads_dir, "*0007*")
matches = glob.glob(pattern)

output_file = r"c:\Users\HP VICTUS AMD RYZEN5\Desktop\CNX 4-0\OHITU\Ohitu\pdf_content_refVI.txt"

with open(output_file, "w", encoding="utf-8") as out:
    if matches:
        pdf_path = matches[0]
        out.write(f"FILE: {pdf_path}\n\n")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                out.write(f"Total pages: {len(pdf.pages)}\n\n")
                for i, page in enumerate(pdf.pages):
                    out.write(f"--- Page {i+1} ---\n")
                    text = page.extract_text()
                    if text:
                        out.write(text)
                    else:
                        out.write("[No text]")
                    out.write("\n\n")
            out.write("\nDONE\n")
        except Exception as e:
            out.write(f"ERROR: {e}\n")
    else:
        out.write("Ref VI not found with pattern *0007*\n")
        # Also extract ARRETE 0010
        pattern2 = os.path.join(downloads_dir, "ARRETE*0010*")
        matches2 = glob.glob(pattern2)
        out.write(f"ARRETE 0010 matches: {matches2}\n")

print("Done - check pdf_content_refVI.txt")
