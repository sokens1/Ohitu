import XLSX from 'xlsx';

const filePath = 'C:\\Users\\HP VICTUS AMD RYZEN5\\Downloads\\listes.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n================ Sheet: ${sheetName} ================`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    // Find all headers across all rows
    const allHeaders = new Set();
    rows.forEach(r => {
      Object.keys(r).forEach(k => allHeaders.add(k));
    });
    console.log('All Headers in Sheet:', Array.from(allHeaders));
    
    console.log(`All rows (${rows.length}):`);
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  });
} catch (error) {
  console.error('Error reading file:', error);
}

