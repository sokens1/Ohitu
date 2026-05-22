const XLSX = require('xlsx');
const path = 'C:\\Users\\HP VICTUS AMD RYZEN5\\Downloads\\etablissements (2).xlsx';

try {
  const workbook = XLSX.readFile(path);
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const keys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
    console.log('All unique columns:', Array.from(keys));
    console.log('Total rows:', rows.length);
    if (rows.length > 0) {
      console.log('First 5 rows:');
      console.log(rows.slice(0, 5));
    }
  });
} catch (err) {
  console.error(err);
}
