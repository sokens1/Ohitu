import fitz
import os

pdf_path = r"C:\Users\HP VICTUS AMD RYZEN5\Downloads\PV CENTRALISATION DOS CANDIDAT.pdf"
output_dir = r"c:\Users\HP VICTUS AMD RYZEN5\Desktop\CNX 4-0\OHITU\Ohitu\pdf_images"

doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")

# Save pages 4-10
for i in range(3, min(10, len(doc))):
    page = doc[i]
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
    img_path = os.path.join(output_dir, f"PV_CENTRALISATION_page{i+1}.png")
    pix.save(img_path)
    print(f"Saved: page {i+1}")

doc.close()
print("Done!")
