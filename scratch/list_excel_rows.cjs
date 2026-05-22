const XLSX = require('xlsx');
const path = 'C:\\Users\\HP VICTUS AMD RYZEN5\\Downloads\\etablissements (2).xlsx';

try {
  const workbook = XLSX.readFile(path);
  
  console.log('--- SHEET: Etablissements ---');
  const estRows = XLSX.utils.sheet_to_json(workbook.Sheets['Etablissements']);
  console.log(`Total rows in Etablissements: ${estRows.length}`);
  estRows.forEach((r, idx) => {
    console.log(`[${idx}]`, r.Nom_Etablissement__Site, ' | ', r.Region__Localisation, ' | ', r.Lieu_vote);
  });
  
  console.log('\n--- SHEET: Bureaux ---');
  const burRows = XLSX.utils.sheet_to_json(workbook.Sheets['Bureaux']);
  console.log(`Total rows in Bureaux: ${burRows.length}`);
  burRows.forEach((r, idx) => {
    console.log(`[${idx}]`, r.Nom_Etablissement__Site, ' -> ', r.Bureau);
  });

} catch (err) {
  console.error(err);
}
