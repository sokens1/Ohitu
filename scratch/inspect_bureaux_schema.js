// Script to inspect voting bureaux columns and values (Plain JS)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

async function run() {
  const { data: centers } = await supabase
    .from('election_centers')
    .select('center_id')
    .eq('election_id', ELECTION_ID);
  
  const centerIds = (centers || []).map(c => c.center_id);
  
  const { data: bureaux, error } = await supabase
    .from('voting_bureaux')
    .select('*')
    .in('center_id', centerIds);

  if (error) {
    console.error('Error fetching bureaux:', error);
    return;
  }

  console.log(`Fetched ${bureaux.length} bureaux.`);
  console.log('Sample bureau schema:', Object.keys(bureaux[0] || {}));
  
  // Show breakdown of seats_to_fill and college in voting_bureaux
  const breakdown = bureaux.map(b => ({
    id: b.id,
    name: b.name,
    center_id: b.center_id,
    college: b.college || b.college_type,
    seats_to_fill: b.seats_to_fill,
    registered_voters: b.registered_voters
  }));
  
  console.log('Bureaux Breakdown:');
  console.table(breakdown.slice(0, 15));
}

run();
