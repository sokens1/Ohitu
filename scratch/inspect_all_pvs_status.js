import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

async function run() {
  const { data: pvs, error } = await supabase
    .from('procès_verbaux')
    .select('id, status, college_type, voting_bureaux(name)')
    .eq('election_id', ELECTION_ID);

  if (error) {
    console.error('Error fetching PVs:', error);
    return;
  }

  console.log(`Total PVs for election ${ELECTION_ID}: ${pvs.length}`);
  
  const statusCounts = {};
  pvs.forEach(pv => {
    statusCounts[pv.status] = (statusCounts[pv.status] || 0) + 1;
    console.log(`- PV ID: ${pv.id} | Status: ${pv.status} | College: ${pv.college_type} | Bureau: ${pv.voting_bureaux?.name}`);
  });
  
  console.log('\nStatus counts:', statusCounts);
}

run();
