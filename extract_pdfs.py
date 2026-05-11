import fitz  # PyMuPDF
import os
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

downloads_dir = r"C:\Users\HP VICTUS AMD RYZEN5\Downloads"
output_dir = r"c:\Users\HP VICTUS AMD RYZEN5\Desktop\CNX 4-0\OHITU\Ohitu\pdf_images"
os.makedirs(output_dir, exist_ok=True)

pdf_files = {
    "PV_CENTRALISATION": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\PV CENTRALISATION DOS CANDIDAT.pdf",
    "COMMUNIQUE011": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\COMMUNIQUE011PDF_260423_152448_260423_155657.pdf",
    "REF_IV_8775": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\8775807779666.pdf",
    "REF_V_NEWDOC30": r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\New Document(30).pdf",
}

# Also find Ref VI 
matches = glob.glob(os.path.join(downloads_dir, "*0007*"))
if matches:
    pdf_files["REF_VI_ARRETE_0007"] = matches[0]

for ref_name, pdf_path in pdf_files.items():
    print(f"\nProcessing: {ref_name}")
    if not os.path.exists(pdf_path):
        print(f"  NOT FOUND: {pdf_path}")
        continue
    
    try:
        doc = fitz.open(pdf_path)
        print(f"  Pages: {len(doc)}")
        
        # Extract text using PyMuPDF (better at OCR-scanned PDFs)
        with open(os.path.join(output_dir, f"{ref_name}_text.txt"), "w", encoding="utf-8") as out:
            out.write(f"SOURCE: {pdf_path}\nPages: {len(doc)}\n\n")
            for i, page in enumerate(doc):
                out.write(f"--- PAGE {i+1} ---\n")
                # Try text extraction
                text = page.get_text("text")
                if text.strip():
                    out.write(text)
                else:
                    # Try blocks
                    blocks = page.get_text("blocks")
                    if blocks:
                        for block in blocks:
                            if block[6] == 0:  # text block
                                out.write(block[4])
                    else:
                        out.write("[No text - scanned image page]\n")
                out.write("\n")
        
        # Save first 3 pages as images for visual inspection
        for i in range(min(3, len(doc))):
            page = doc[i]
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
            img_path = os.path.join(output_dir, f"{ref_name}_page{i+1}.png")
            pix.save(img_path)
            print(f"  Saved image: {img_path}")
        
        doc.close()
    except Exception as e:
        print(f"  ERROR: {e}")

print("\nDone!")
