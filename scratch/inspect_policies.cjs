const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPolicies() {
  try {
    console.log('Fetching policies from pg_policies via custom RPC or query...');
    // We can query pg_policies by selecting from pg_catalog.pg_policies if allowed.
    // If not allowed, we will get an error.
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*');
    
    if (error) {
      console.log('Error querying pg_policies directly:', error.message);
    } else {
      console.log('Policies:', data);
    }
  } catch (err) {
    console.error(err);
  }
}

inspectPolicies();
