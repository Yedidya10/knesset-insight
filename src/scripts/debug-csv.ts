import { config } from 'dotenv';
config({ path: '.env.local' });

import { fetchOKnessetCSV } from '../lib/knesset/oknesset-client';

async function main() {
  const rows = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/mk_individual.csv',
  );
  
  const dan = rows.filter(r => r.mk_individual_name === 'אילוז');
  console.log('Dan Illouz rows in CSV:', dan.length);
  if (dan.length > 0) {
    for (const d of dan) {
      console.log({
        mk_individual_id: d.mk_individual_id,
        PersonID: d.PersonID,
        name: d.mk_individual_first_name + ' ' + d.mk_individual_name,
      });
    }
  } else {
    console.log('NOT FOUND in CSV');
  }
  
  const total = rows.length;
  const withPersonId = rows.filter(r => Number(r.PersonID)).length;
  console.log(`Total CSV rows: ${total}, with PersonID: ${withPersonId}`);

  // Check what keys are available
  console.log('Sample CSV keys:', Object.keys(rows[0]).join(', '));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
