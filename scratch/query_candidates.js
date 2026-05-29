// Script to inspect election candidates
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ELECTION_ID = 'b80a33c6-a11e-4171-ac6d-f2de550a402b';

async function run() {
  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('*')
    .in('id', (
      await supabase
        .from('election_candidates')
        .select('candidate_id')
        .eq('election_id', ELECTION_ID)
    ).data.map(ec => ec.candidate_id));

  console.log(`Loaded ${candidates?.length || 0} candidates.`);
  
  const grouped = {};
  candidates.forEach(c => {
    const parts = (c.party || '').split(' — ');
    const syndicat = parts[0]?.trim() || 'Autre';
    const college = parts[1]?.trim() || 'Général';
    
    if (!grouped[college]) grouped[college] = {};
    if (!grouped[college][syndicat]) grouped[college][syndicat] = [];
    grouped[college][syndicat].push(c.name);
  });

  console.log(JSON.stringify(grouped, null, 2));
}

run();
