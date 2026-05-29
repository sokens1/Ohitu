// Script to query voting bureaux details
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

async function run() {
  // Get voting bureaux for this election
  // We first get the election centers
  const { data: centers } = await supabase
    .from('election_centers')
    .select('center_id')
    .eq('election_id', ELECTION_ID);
  
  const centerIds = (centers || []).map(c => c.center_id);
  
  const { data: bureaux } = await supabase
    .from('voting_bureaux')
    .select('id, name, center_id, registered_voters')
    .in('center_id', centerIds);

  console.log(`Total centers: ${centerIds.length}`);
  console.log(`Total voting bureaux: ${bureaux?.length || 0}`);
}

run();
