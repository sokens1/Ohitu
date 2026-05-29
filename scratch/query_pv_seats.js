// Script to inspect bureaux with PVs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

async function run() {
  const { data: pvs } = await supabase
    .from('procès_verbaux')
    .select('id, bureau_id, college_type, status')
    .eq('election_id', ELECTION_ID)
    .in('status', ['validated', 'published']);

  const bureauIds = pvs.map(pv => pv.bureau_id);

  const { data: bureaux } = await supabase
    .from('voting_bureaux')
    .select('id, name, center_id, college_type, college, seats_to_fill')
    .in('id', bureauIds);

  console.log('Bureaux with PVs:');
  const list = pvs.map(pv => {
    const b = bureaux.find(x => x.id === pv.bureau_id);
    return {
      pv_id: pv.id,
      bureau_id: pv.bureau_id,
      bureau_name: b?.name,
      college: pv.college_type,
      seats_to_fill: b?.seats_to_fill,
      status: pv.status
    };
  });
  console.table(list);
}

run();
