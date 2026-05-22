const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  try {
    console.log('Running select on voting_centers...');
    const { data, error } = await supabase
      .from('voting_centers')
      .select('id');
    
    if (error) {
      console.error('Error details:', error);
    } else {
      console.log('Success! Fetched count:', data.length);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testQuery();
