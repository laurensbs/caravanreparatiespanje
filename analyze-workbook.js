const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, 'data', 'source-workbook.xlsx'));
console.log('=== SHEETS ===');
console.log(wb.SheetNames);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== SHEET: ${name} ===`);
  console.log('Ref:', ws['!ref']);
  console.log('Total rows:', rows.length);
  
  // Print all rows (truncated cell values)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => String(c).substring(0, 80));
    console.log(`  [${i}] ${JSON.stringify(r)}`);
  }
}
