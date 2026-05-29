// Script to inspect election data, electoral colleges, and PVs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Get professional elections
  const { data: elections, error: elError } = await supabase
    .from('elections')
    .select('id, title, type, status, seats_available');
  
  if (elError) {
    console.error('Error fetching elections:', elError);
    return;
  }

  console.log('Elections:');
  console.log(JSON.stringify(elections, null, 2));

  for (const el of elections) {
    if (el.type === 'Élection Professionnelle') {
      console.log(`\n========================================`);
      console.log(`Checking professional election: ${el.title} (${el.id})`);
      console.log(`========================================`);

      // Get colleges
      const { data: colleges, error: colError } = await supabase
        .from('electoral_colleges')
        .select('*')
        .eq('election_id', el.id);

      if (colError) {
        console.error('Error fetching colleges:', colError);
      } else {
        console.log('\nElectoral Colleges:');
        console.table(colleges);
      }

      // Get PVs
      const { data: pvs, error: pvsError } = await supabase
        .from('procès_verbaux')
        .select('id, bureau_id, college_type, total_registered, total_voters, status')
        .eq('election_id', el.id);

      if (pvsError) {
        console.error('Error fetching PVs:', pvsError);
      } else {
        console.log('\nPVs:');
        console.table(pvs);
      }
    }
  }
}

run();
