const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  try {
    console.log('Inspecting voting_centers table...');
    const { data: centers, error: centersErr } = await supabase
      .from('voting_centers')
      .select('*')
      .limit(1);
    
    if (centersErr) {
      console.error('Error fetching centers:', centersErr);
    } else {
      console.log('voting_centers columns:', Object.keys(centers[0] || {}));
    }

    console.log('\nInspecting voting_bureaux table...');
    const { data: bureaux, error: bureauxErr } = await supabase
      .from('voting_bureaux')
      .select('*')
      .limit(1);
    
    if (bureauxErr) {
      console.error('Error fetching bureaux:', bureauxErr);
    } else {
      console.log('voting_bureaux columns:', Object.keys(bureaux[0] || {}));
    }
  } catch (err) {
    console.error(err);
  }
}

inspectSchema();
