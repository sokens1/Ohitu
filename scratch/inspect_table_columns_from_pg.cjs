const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
  try {
    // Querying PostgreSQL information schema via RPC isn't possible directly unless there is an RPC, 
    // but we can execute a simple select on voting_bureaux where id = '00000000-0000-0000-0000-000000000000' (non-existent) and check if we can get all columns or just run a query.
    // Wait! Let's insert a dummy row or just retrieve a single row if any exists.
    // Or we can try to run a query to check if 'college' and 'lieu_vote' exist.
    const { data: colCheck, error: colCheckErr } = await supabase
      .from('voting_bureaux')
      .select('*')
      .limit(1);

    if (colCheckErr) {
      console.log('Error checking columns:', colCheckErr.message);
    } else if (colCheck && colCheck.length > 0) {
      console.log('Existing columns on voting_bureaux:', Object.keys(colCheck[0]));
    } else {
      console.log('No rows returned, but query succeeded.');
    }
  } catch (err) {
    console.error(err);
  }
}

inspectColumns();
