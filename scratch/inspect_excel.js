const XLSX = require('xlsx');
const path = 'C:\\Users\\HP VICTUS AMD RYZEN5\\Downloads\\etablissements (2).xlsx';

try {
  console.log('Loading workbook...');
  const workbook = XLSX.readFile(path);
  console.log('Sheets found:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (rows.length > 0) {
      console.log('Headers:', Object.keys(rows[0]));
      console.log('Sample Row 1:', rows[0]);
      if (rows.length > 1) {
        console.log('Sample Row 2:', rows[1]);
      }
    } else {
      console.log('Sheet is empty.');
    }
  });
} catch (err) {
  console.error('Error reading file:', err);
}
