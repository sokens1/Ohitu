import fs from 'fs';
import * as xlsx from 'xlsx';

const filePath = 'C:\\Users\\HP VICTUS AMD RYZEN5\\Downloads\\modele_configuration_professional (3).xlsx';

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const result = {};
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        result[sheetName] = {
            columns: json[0] || [],
            rows: json.slice(1, 10)
        };
    }
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error);
}
